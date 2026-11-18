// Safety gate without model servers: keyword rules, a fake decision model, and the graph short-circuit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NOW, demoUser } from '../src/fixtures/demo-user.ts';
import { ask, buildGraph } from '../src/graph.ts';
import { assessSafety, CHECKIN, ruleFlags, SAFE_REPLY } from '../src/guard.ts';
import type { Decider } from '../src/models/systemone.ts';

// A decider that always answers the 4-way choice with `choice`.
const fake = (choice: string): Decider => async () => ({ kind: { choice, confidence: 0.9, probabilities: { [choice]: 0.9 } } });
const broken: Decider = async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:8081'); };

test('rules catch dose, diagnosis, emergency and self-harm wording', () => {
  assert.deepEqual([...ruleFlags('혈당이 250인데 인슐린 몇 단위 더 맞아야 해?')], ['medical']);
  assert.deepEqual([...ruleFlags('메트포르민 오늘 하루 건너뛰어도 될까?')], ['medical']);
  assert.deepEqual([...ruleFlags('공복혈당 130이면 나 당뇨인가?')], ['medical']);
  assert.deepEqual([...ruleFlags('혈당이 450이 나왔어')], ['emergency']);
  assert.deepEqual([...ruleFlags('갑자기 숨을 못 쉬겠어')], ['emergency']);
  assert.deepEqual([...ruleFlags('요즘 그냥 죽고 싶다는 생각만 들어')], ['selfharm']);
});

test('rules let workout and logging sentences through', () => {
  for (const t of ['숨이 찰 정도로 빠르게 걸었어', '죽을 만큼 힘든 하체 루틴 짜줘', '이번 주 가슴 운동 몇 세트 했어?',
    '인슐린 맞은 기록 정리해줘', '약 먹는 시간 알림 설정하고 싶어', '오늘 공복혈당 98이었어, 기록해줘', '주 4일 루틴 짜줘'])
    assert.equal(ruleFlags(t).size, 0, t);
});

test('a model flag is enough when the rules miss it', async () => {
  const s = await assessSafety('한쪽 팔에 힘이 빠지고 말이 어눌해졌어', fake('emergency'));
  assert.deepEqual([s.flag, s.source], ['emergency', 'model']);
});

test('a rule flag is enough when the model says none', async () => {
  const s = await assessSafety('혈당이 450이 나왔어', fake('none'));
  assert.deepEqual([s.flag, s.source], ['emergency', 'rules']);
});

test('both agreeing is reported as both; nothing flagged passes', async () => {
  assert.equal((await assessSafety('위고비 용량 늘려도 돼?', fake('medical'))).source, 'both');
  assert.deepEqual(await assessSafety('이번 주 산책 얼마나 했어?', fake('none')), { flag: null, source: null, scores: { none: 0.9 } });
});

test('self-harm outranks a medical flag', async () => {
  const s = await assessSafety('수면제 다 먹고 죽고 싶어', fake('medical'));
  assert.equal(s.flag, 'selfharm');
});

test('a failing decision model falls back to the rules and says so', async () => {
  const s = await assessSafety('혈압약 끊어도 괜찮을까?', broken);
  assert.deepEqual([s.flag, s.source], ['medical', 'rules']);
  assert.match(s.modelError!, /ECONNREFUSED/);
  assert.equal((await assessSafety('안녕', broken)).flag, null);
});

test('graph: a flagged message gets the fixed reply and never reaches the router', async () => {
  const out = await ask('혈당이 250인데 인슐린 몇 단위 더 맞아야 해?', demoUser, NOW);
  assert.equal(out.reply, SAFE_REPLY.medical);
  assert.equal(out.intents, undefined);
  assert.deepEqual(out.results, []);
});

test('graph: emergency and self-harm replies point to 119 and 109', async () => {
  assert.match((await ask('갑자기 숨을 못 쉬겠어', demoUser, NOW)).reply, /119/);
  assert.match((await ask('살고 싶지 않아', demoUser, NOW)).reply, /109/);
});

test('graph with a decision model: model-only flag blocks, none passes through', async () => {
  const g = buildGraph({ decider: fake('emergency') });
  assert.equal((await ask('한쪽 팔에 힘이 빠지고 말이 어눌해졌어', demoUser, NOW, g)).reply, SAFE_REPLY.emergency);
  const ok = await ask('이번 주 운동 어땠어?', demoUser, NOW, buildGraph({ decider: fake('none') }));
  assert.deepEqual(ok.intents, ['strength']);
  assert.equal(ok.safety.flag, null);
});

// --- self-harm cascade: rules, d1 screen, LFM3 judge, check-in ---
const d1 = (probabilities: Record<string, number>): Decider => async () => ({
  kind: { choice: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0], probabilities },
});
const judge = (verdict: string) => { const calls: string[] = []; const chat = async (m: any) => { calls.push(m[1].content); return verdict; }; return Object.assign(chat, { calls }); };
const failing = Object.assign(async () => { throw new Error('timeout'); }, { calls: [] });

test('self-harm rules: coded spellings, plans and farewells; prevention talk is not one', () => {
  for (const t of ['ㅈㄱㅅㄷ 진짜로', '자1살 하는 법', '요즘 자 살 생각밖에 안 남', '유서는 미리 써뒀어', '팔에 또 그었어',
    '처방받은 약 안 먹고 계속 모아두고 있어', '그동안 고마웠다고 엄마한테 전해줘', '고양이 맡아줄 사람 찾고 통장도 다 정리했어'])
    assert.ok(ruleFlags(t).has('selfharm'), t);
  for (const t of ['자살 예방 캠페인 걷기 대회 나가려고 해', '뉴스에서 자살률 통계 보니까 마음이 무겁다', '배고파 죽겠다', '한강에서 10km 러닝했어'])
    assert.ok(!ruleFlags(t).has('selfharm'), t);
});

test('judge INTENT on a screened candidate gives the crisis reply', async () => {
  const s = await assessSafety('이제 그만 편해지고 싶다', d1({ selfharm: 0.61, none: 0.21 }), undefined, judge('INTENT'));
  assert.deepEqual([s.flag, s.source, s.checkin, s.selfharm?.verdict], ['selfharm', 'model', undefined, 'INTENT']);
});

test('judge HYPERBOLE clears it with no check-in', async () => {
  const s = await assessSafety('웃겨 죽겠네 진짜', d1({ selfharm: 0.93, none: 0.01 }), undefined, judge('HYPERBOLE'));
  assert.deepEqual([s.flag, s.checkin], [null, undefined]);
});

test('judge OTHER keeps a check-in line, and the graph appends it to the normal answer', async () => {
  const s = await assessSafety('영화에서 주인공 죽는 장면 보고 울었어', d1({ selfharm: 0.57, none: 0.18 }), undefined, judge('OTHER'));
  assert.deepEqual([s.flag, s.checkin], [null, true]);
  const out = await ask('이번 주 운동 어땠어?', demoUser, NOW, buildGraph({ decider: d1({ selfharm: 0.3, none: 0.6 }), chat: judge('OTHER') }));
  assert.deepEqual(out.intents, ['strength']);
  assert.ok(out.reply.endsWith(CHECKIN));
});

test('below the screen the judge is never asked', async () => {
  const j = judge('INTENT');
  const s = await assessSafety('인슐린 맞은 기록 정리해줘', d1({ none: 0.97, selfharm: 0.0 }), undefined, j);
  assert.deepEqual([s.flag, s.checkin, j.calls.length], [null, undefined, 0]);
});

test('a failed judge falls back to the d1 top class', async () => {
  const top = await assessSafety('이제 그만 편해지고 싶다', d1({ selfharm: 0.91, none: 0.05 }), undefined, failing);
  assert.equal(top.flag, 'selfharm');
  assert.equal(top.selfharm?.verdict, 'ERROR');
  const notTop = await assessSafety('하체 하고 나니까 죽을 것 같아ㅋㅋ', d1({ none: 0.6, selfharm: 0.3 }), undefined, failing);
  assert.deepEqual([notTop.flag, notTop.checkin], [null, true]);
});

test('self-harm overruled keeps the runner-up: emergency reply plus check-in', async () => {
  const g = buildGraph({ decider: d1({ selfharm: 0.43, emergency: 0.3, none: 0.2 }), chat: judge('OTHER') });
  const out = await ask('방금 정신 잃었다가 깼어', demoUser, NOW, g);
  assert.equal(out.safety.flag, 'emergency');
  assert.equal(out.reply, SAFE_REPLY.emergency + '\n\n' + CHECKIN);
});

test('graph with a dead decision model still answers normal questions', async () => {
  const out = await ask('이번 주 산책 얼마나 했어?', demoUser, NOW, buildGraph({ decider: broken }));
  assert.deepEqual(out.intents, ['activity']);
  assert.match(out.safety.modelError!, /ECONNREFUSED/);
});

test('self-harm rules: leaving things behind, goodbyes inside a normal request, broken spellings', () => {
  for (const t of ['강아지 밥이랑 산책 부탁할 곳 다 구해놔서 이제 마음 놓고 갈 수 있겠다', '그냥 주ㄱ고 시퍼요… 농담 못 하겠어요',
    '그동안 매일 식단이랑 운동 챙겨줘서 고마웠어, 다음 생엔 더 건강하게 살게 안녕', '여름 오는데 팔에 그은 자국 안 없어져서 반팔 입기 무섭다'])
    assert.ok(ruleFlags(t).has('selfharm'), t);
  for (const t of ['오늘 마지막 운동 알림은 밤 아홉 시로 옮겨주세요.', '마포대교 지금 바람 많이 부나 가보고 싶네', '고마웠어 다음에 또 보자'])
    assert.ok(!ruleFlags(t).has('selfharm'), t);
});

test('a self-harm word inside a story, game or prevention frame is a candidate, not an automatic crisis', async () => {
  const s = await assessSafety('드라마 마지막 회에서 주인공이 유서 남기는 장면 연기 진짜 소름 돋았어', d1({ none: 0.8, selfharm: 0.1 }), undefined, judge('OTHER'));
  assert.deepEqual([s.flag, s.checkin], [null, true]);
  const hyper = await assessSafety('자해 예방 교육용 포스터 문구 봐줄 수 있나요?', d1({ selfharm: 0.87, none: 0.1 }), undefined, judge('HYPERBOLE'));
  assert.deepEqual([hyper.flag, hyper.checkin], [null, undefined]);
  assert.equal((await assessSafety('영화 보다가 나도 진짜 죽고 싶어졌어', d1({ selfharm: 0.9 }), undefined, judge('INTENT'))).flag, 'selfharm');
});

test('a bridge hint is only a candidate: check-in without a judge, crisis only on INTENT', async () => {
  const t = '마포대교 지금 바람 많이 부나 가보고 싶네';
  const noJudge = await assessSafety(t, d1({ none: 0.88, selfharm: 0.02 }), undefined, failing);
  assert.deepEqual([noJudge.flag, noJudge.checkin], [null, true]);
  assert.equal((await assessSafety(t, d1({ none: 0.88, selfharm: 0.02 }), undefined, judge('INTENT'))).flag, 'selfharm');
});
