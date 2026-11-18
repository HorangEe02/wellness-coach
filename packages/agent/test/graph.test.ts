// Run: node --test "test/*.test.ts"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NOW, demoUser } from '../src/fixtures/demo-user.ts';
import { ask } from '../src/graph.ts';
import { route, strengthTopic } from '../src/router.ts';

test('router: keyword rules', () => {
  assert.deepEqual(route('이번 주 운동 어땠어?'), ['strength']);
  assert.deepEqual(route('이번 주 산책 얼마나 했어?'), ['activity']);
  assert.deepEqual(route('걷기 운동 기록 보여줘'), ['activity']); // "운동" alone does not pull in strength
  assert.deepEqual(route('이번 주 운동이랑 산책 정리해줘'), ['strength', 'activity']);
  assert.deepEqual(route('스쿼트 하고 5km 걸었어'), ['strength', 'activity']);
  assert.deepEqual(route('안녕'), []);
  assert.equal(strengthTopic('주 4일 루틴 짜줘'), 'plan');
  assert.equal(strengthTopic('회복 덜 된 근육 있어?'), 'recovery');
  assert.equal(strengthTopic('이번 주 운동 어땠어?'), 'week');
});

test('strength week summary comes from core numbers', async () => {
  const out = await ask('이번 주 운동 어땠어?', demoUser, NOW);
  assert.deepEqual(out.intents, ['strength']);
  assert.equal(out.results.length, 1);
  assert.match(out.reply, /이번 주 2번 운동했어요\. 주간 목표까지 1번 남았어요\./);
  assert.deepEqual(out.results[0].data.streak, { weeks: 1, thisWeek: 2 });
});

test('strength recovery: muscles trained an hour ago are not recovered', async () => {
  const out = await ask('회복 덜 된 근육 있어?', demoUser, NOW);
  const rec = out.results[0].data.recovery as Record<string, number>;
  assert.equal(rec.quads, 0); // squats ended at 20:00 = now
  assert.ok(rec.chest > 0 && rec.chest < 100); // bench yesterday
  assert.equal(rec.biceps, 100); // not trained in 7 days
});

test('strength plan honours the day count in the question', async () => {
  const out = await ask('주 4일 루틴 짜줘', demoUser, NOW);
  const plan = out.results[0].data.plan as any;
  assert.equal(plan.split, '상체·하체 2회');
  assert.equal(plan.days.length, 4);
  assert.match(out.reply, /^상체·하체 2회 계획이에요\./);
});

test('activity week: walks, kcal and steps', async () => {
  const out = await ask('이번 주 산책 얼마나 했어?', demoUser, NOW);
  const d = out.results[0].data as any;
  assert.deepEqual(d.thisWeek, { n: 2, distM: 5400, sec: 4000 });
  assert.equal(d.kcal, 304);
  assert.match(out.reply, /지난주는 2번, 8\.3km였어요 \(2\.9km 덜 걸었어요\)\./);
});

test('both domains run in parallel and coach orders them strength → activity', async () => {
  const out = await ask('이번 주 운동이랑 산책 정리해줘', demoUser, NOW);
  assert.deepEqual(out.results.map(r => r.domain).sort(), ['activity', 'strength']);
  const [a, b] = out.reply.split('\n\n');
  assert.match(a, /운동했어요/);
  assert.match(b, /걸었어요/);
});

test('unmatched input gets the help reply; course is not built yet', async () => {
  const help = await ask('안녕', demoUser, NOW);
  assert.deepEqual(help.results, []);
  assert.match(help.reply, /근력 운동과 걷기 기록만/);
  const course = await ask('근처 걷기 코스 추천해줘', demoUser, NOW);
  assert.equal(course.reply, '코스 추천은 아직 준비 중이에요.');
});

test('empty user data does not crash', async () => {
  const empty = { ...demoUser, strength: { ...demoUser.strength, workouts: [] }, walks: [] };
  const out = await ask('이번 주 운동이랑 산책 정리해줘', empty, NOW);
  assert.match(out.reply, /아직 운동 기록이 없어요/);
  assert.match(out.reply, /아직 걷기 기록이 없어요/);
});
