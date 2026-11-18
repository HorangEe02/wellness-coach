// Safety gate before routing (docs/DESIGN.md principle 3, docs/MODELS.md §4).
// Emergency and medical: flagged if the decision model OR the keyword rules flag them.
// Self-harm needs more, because Korean voices it indirectly and also says "죽겠다" about lunch (docs/MODELS.md §7):
//   1. strong wording (slang, initials, plans, farewells, self-injury) → crisis reply, no model needed
//   2. d1-2B's selfharm probability in the 4-way choice ≥ SCREEN → candidate
//   3. a candidate goes to LFM3 with thinking: INTENT → crisis reply; OTHER → normal answer plus a one-line
//      109 check-in; HYPERBOLE → normal answer; no judge or a failed one → d1-2B's top class decides.
// With no model, or when it fails, the rules decide alone.
import type { Chat } from './models/chat.ts';
import type { Decider, Question } from './models/systemone.ts';
import type { GraphState } from './state.ts';

export type Flag = 'selfharm' | 'emergency' | 'medical';
export const FLAGS: Flag[] = ['selfharm', 'emergency', 'medical']; // priority order
export type Verdict = 'INTENT' | 'HYPERBOLE' | 'OTHER' | 'ERROR';
export type Safety = {
  flag: Flag | null;
  source: 'rules' | 'model' | 'both' | null;
  scores: Partial<Record<Flag | 'none', number>>;
  checkin?: true; // self-harm was possible but not judged a crisis: answer normally and add the 109 line
  selfharm?: { screen: number; verdict?: Verdict };
  modelError?: string;
};

// One 4-way choice, not three yes/no questions: on d1-2B the separate noul questions scored 12/30 and 22/30
// (an emergency yes/no fired at 0.8-0.98 on almost everything); this choice scored 29/30 (docs/MODELS.md §7).
// "none" spells out record/reminder requests because the app logs insulin and medicines.
export const QUESTION: Question = {
  type: 'choice',
  instructions: '이 메시지는 어떤 종류인가?',
  criteria: {
    selfharm: '자해나 자살 생각, 충동, 계획을 말한다',
    // "수치만 말해도" added after Gemini/Codex review: a bare 450 reading now matches the label without hurting other cases.
    // Their fuller rewrites scored lower on d1-2B (43/46 vs 45/46): longer criteria confuse the small model.
    emergency: '지금 몸에 위급한 증상이 생겼다고 말한다 (가슴 통증, 숨을 못 쉼, 실신, 마비, 아주 높거나 낮은 혈당과 그 증상). 증상 없이 아주 높거나 낮은 혈당 수치만 말해도 포함한다. 운동하며 숨이 찬 것은 아니다',
    medical: '병을 진단해 달라고 하거나, 약이나 인슐린을 얼마나 쓸지, 건너뛰거나 끊어도 되는지 판단해 달라고 한다',
    none: '운동, 걷기, 식단, 일반 건강 정보 질문, 그리고 약·인슐린·혈당을 기록하거나 정리하거나 알림을 맞추는 요청',
  },
};

// Who goes to the LFM3 judge: d1-2B's selfharm probability from the 4-way choice. On the tuning sentences it is
// ≥ 0.4 for 23 of 31 positives and ≥ 0.2 for only 8 of 38 negatives. A dedicated second d1 question was tried and
// dropped: its scores overlapped completely (negatives 0.28-0.85, positives 0.31-0.92), so it sent nearly every
// message to the judge, and the judge then called "인슐린 맞은 기록 정리해줘" INTENT (docs/MODELS.md §7).
export const SCREEN = 0.2;

export const JUDGE_PROMPT = `너는 한국어 메시지 분류기다. 메시지 하나를 읽고 아래 중 하나만 답한다. 다른 말은 쓰지 않는다.
INTENT: 자기 삶을 끝내거나 스스로를 해치려는 생각, 준비, 행동. 돌려 말하기, 비유, 은어, 초성, 어순을 바꾼 말, 농담인 척하다가 뒤에서 진심을 말하는 경우도 포함한다.
HYPERBOLE: 배고프다, 웃기다, 힘들다, 창피하다, 피곤하다를 "죽겠다", "죽는 줄", "숨고 싶다"처럼 과장한 일상 표현.
OTHER: 영화, 게임, 뉴스, 캠페인, 운동, 다이어트, 여행 등 그 밖의 이야기.

예시:
"배고파 죽겠다" -> HYPERBOLE
"요즘 그냥 다 내려놓고 영원히 잠들고 싶어" -> INTENT
"한강 공원에서 자전거 탔어" -> OTHER
"ㅋㅋ 농담이야. 근데 진짜 사라지면 편할까" -> INTENT`;
// Tried on dev: a line saying "quitting an activity or wanting to travel is OTHER" plus two such examples cut the
// crisis reply for real positives from 26/28 to 21/28 (the judge read euphemisms as quitting). Not used.

export async function judgeSelfharm(chat: Chat, text: string): Promise<Verdict> {
  try {
    // Usual judgements take 2.7-4 s. On some hyperbole LFM3 reasons for ~5,000 tokens (26-30 s), and Ollama's
    // reasoning_effort does not shorten it for LFM3, so cap the wait; a timeout is handled like no judge at all.
    const out = await chat([{ role: 'system', content: JUDGE_PROMPT }, { role: 'user', content: `메시지: "${text}"` }], { thinking: true, timeoutMs: 12000 });
    return /INTENT/.test(out) ? 'INTENT' : /HYPERBOLE/.test(out) ? 'HYPERBOLE' : /OTHER/.test(out) ? 'OTHER' : 'ERROR';
  } catch {
    return 'ERROR';
  }
}

// Mentions of suicide that are about prevention, statistics or news, not the speaker's wish.
const ABOUT_SUICIDE = /자살\s*(예방|률|방지|통계|기사|뉴스)\S*|(예방|캠페인|뉴스|기사|통계)\S*\s*\S*\s*자살/g;
const MEDS = '(약|알약|인슐린|메트포르민|위고비|마운자로|오젬픽|삭센다|GLP|혈압약|당뇨약|수면제|진통제|항생제|스테로이드)';
// Talking about a story, a game, the news or prevention work: a self-harm word there is a mention, not a disclosure.
// A rule hit in that frame goes to the models like any candidate (at worst a check-in) instead of the crisis reply.
const MENTION = /드라마|영화|소설|웹툰|게임|기사|뉴스|장면|주인공|등장인물|포스터|교육|예방|캠페인|표현|독후감/;
// Hints too ambiguous to decide alone ("마포대교 근처 맛집 가보고 싶다"): they make a candidate, like MENTION.
const SH_HINT = /마포대교.{0,20}(가\s*보고\s*싶|가고\s*싶|난간)/;
const RULES: Record<Flag, RegExp[]> = {
  selfharm: [
    /자살|자해|(죽|주ㄱ)고\s*(싶|시[퍼프])|살고\s*싶지\s*않|목숨을?\s*끊|사라지고\s*싶/,
    // coded and broken spellings, plans, self-injury (eval/selfharm-cases.ts dev)
    /ㅈㄱㅅㄷ|ㅈㅅ\s*각|자\s*[\d.·_\-]\s*살|자\s+살\s*(생각|하고|할)|극단적\s*선택|유서|뛰어내리|그었|긋고\s*싶|그은\s*(자국|상처|흉터)|한강\s*물\s*온도/,
    /약을?\s*(안\s*먹고\s*)?(계속\s*)?모아\s*(두|놓)/,
    // farewells and putting affairs in order: known warning signs that d1-2B scores near 0 (dev: 0.02-0.08)
    /(고마웠|미안했)다고\s*\S*\s*전해|미련\s*(이\s*)?없|(맡아\s*줄|맡길)\s*사람|통장\S*\s*(다\s*)?정리|신변\s*정리/,
    // leaving things behind, "won't be back alive", goodbyes tacked onto a normal request (eval ext-dev: d1 0.01-0.11)
    /남은\s*사람들|남길\s*(말|편지)|살아서\s*(다시|만날)|살아\s*돌아올|(마음\s*놓고|편히)\s*갈\s*수|(물건|짐)\S*\s*(다\s*)?나눠\s*(주|줬)|인생\s*마지막\s*\S+\s*(이|가)?\s*될|(고마웠|즐거웠)\S*.*안녕\s*[.!~]*$/,
  ],
  emergency: [
    /가슴.{0,6}(통증|아파|아프|조여|답답|짓눌)/, /숨(을|이)?\s*(못\s*쉬|쉬기\s*(가\s*)?힘들|막혀|막힌|안\s*쉬어)/, // not "숨이 찰 정도로 뛰었어": normal in a workout app
    /의식(을|이)?.{0,4}(잃|없|흐려)|기절|실신|쓰러(졌|질)/, /(팔|다리|얼굴|한쪽).{0,6}(마비|저리고\s*힘이)/,
    /혈당.{0,8}([4-9]\d\d)/, /저혈당.{0,10}(떨|식은땀|어지러|의식)/,
  ],
  medical: [
    new RegExp(`${MEDS}.{0,12}(몇|얼마나|더\\s*(맞|먹)|늘려|줄여|끊어|끊어도|바꿔|빼도|건너뛰어|용량)`),
    /(무슨|어떤)\s*병|병인가|진단(해|을|좀)|(당뇨|암|고혈압)인가|처방(해|좀)/,
  ],
};

export const ruleFlags = (text: string): Set<Flag> => {
  const t = { selfharm: text.replace(ABOUT_SUICIDE, ' '), emergency: text, medical: text };
  return new Set(FLAGS.filter(f => RULES[f].some(re => re.test(t[f]))));
};

export async function assessSafety(text: string, decider: Decider | null, question: Question = QUESTION, chat: Chat | null = null): Promise<Safety> {
  const byRules = ruleFlags(text);
  let scores: Safety['scores'] = {}, modelFlag: Flag | null = null, modelError: string | undefined;
  if (decider) {
    try {
      const a = (await decider(text, { kind: question })).kind;
      scores = a?.probabilities ?? {};
      modelFlag = FLAGS.find(f => f === a?.choice) ?? null; // the model's top class; "none" or anything else = no flag
    } catch (e) {
      modelError = (e as Error).message; // fall back to the rules alone
    }
  }

  // self-harm: rules decide outright; otherwise a model-screened candidate goes to the judge
  const mentioned = (byRules.has('selfharm') && MENTION.test(text)) || SH_HINT.test(text);
  if (mentioned) byRules.delete('selfharm');
  const shRule = byRules.has('selfharm');
  const screen = scores.selfharm ?? 0;
  const shCandidate = shRule || mentioned || (!modelError && (modelFlag === 'selfharm' || screen >= SCREEN));
  let shCrisis = shRule, verdict: Verdict | undefined;
  if (!shRule && shCandidate) {
    if (chat) verdict = await judgeSelfharm(chat, text);
    // no judge, or it failed: fall back to d1-2B alone (on SH_TEST: 0 missed, 0 false crisis). Treating a failure
    // as a crisis instead sent the crisis reply to hyperbole the judge timed out on.
    shCrisis = verdict && verdict !== 'ERROR' ? verdict === 'INTENT' : modelFlag === 'selfharm';
  }
  // HYPERBOLE clears it: on dev every HYPERBOLE verdict was a true negative, and both positives the judge
  // missed came back OTHER, so OTHER keeps the 109 line.
  const checkin = shCandidate && !shCrisis && verdict !== 'HYPERBOLE';

  const byModel = new Set<Flag>(modelFlag && modelFlag !== 'selfharm' ? [modelFlag] : []);
  if (shCrisis && !shRule) byModel.add('selfharm');
  if (modelFlag === 'selfharm' && !shCrisis) {
    // self-harm overruled: keep the model's runner-up instead of dropping it. "러닝머신에서 정신 잃었다가 깼는데"
    // came out selfharm first, emergency second; without this it lost the emergency reply too.
    const next = (['emergency', 'medical', 'none'] as const).reduce((a, b) => ((scores[b] ?? 0) > (scores[a] ?? 0) ? b : a));
    if (next !== 'none') byModel.add(next);
  }
  const flag = FLAGS.find(f => byRules.has(f) || byModel.has(f)) ?? null;
  const source = !flag ? null : byRules.has(flag) && byModel.has(flag) ? 'both' : byRules.has(flag) ? 'rules' : 'model';
  return {
    flag, source, scores,
    ...(checkin ? { checkin: true as const } : {}),
    ...(shCandidate && decider && !modelError ? { selfharm: { screen, ...(verdict ? { verdict } : {}) } } : {}),
    ...(modelError ? { modelError } : {}),
  };
}

export const CHECKIN = '혹시 요즘 혼자 감당하기 힘들 만큼 지친 날이 있다면, 자살예방 상담전화 109(24시간, 문자 가능)나 카카오톡 \'마들랜\'에서 언제든 이야기를 나눌 수 있어요.';

// Fixed replies: no LLM on this path. Merged from the Gemini/Codex review (eval/reviews/*.json).
// 109 is the unified suicide-prevention line (call or text); 마들랜 is its official KakaoTalk channel, both 24 h (checked 2026-11-17).
export const SAFE_REPLY: Record<Flag, string> = {
  selfharm: '많이 힘드신 것 같아요. 혼자 견디지 않으셨으면 해요. 자살예방 상담전화 109(24시간)에 전화하거나, 통화가 어려우면 109 문자나 카카오톡 \'마들랜\'으로 바로 이야기를 나눌 수 있어요. 지금 스스로를 다치게 할 위험이 있거나 이미 다쳤다면 119에 연락하고, 가능하면 믿을 만한 사람에게 곁에 있어 달라고 해 주세요.',
  emergency: '말씀하신 증상이나 수치는 바로 진료가 필요할 수 있어요. 운동이나 하던 일을 멈추고 지금 119에 전화하거나 가까운 응급실로 가 주세요. 증상이 있는 분은 직접 운전하지 마세요. 이 앱은 응급 상황을 판단할 수 없어요.',
  medical: '진단이나 약·인슐린 용량은 제가 판단할 수 없어요. 임의로 약이나 인슐린을 바꾸거나 끊지 마시고, 처방한 의사나 약사에게 꼭 확인해 주세요. 대신 기록된 혈당·혈압·운동 수치를 정리해 드릴 수는 있어요.',
};

export const guardNode = (decider: Decider | null, chat: Chat | null = null) => async (s: GraphState) => {
  const safety = await assessSafety(s.input, decider, QUESTION, chat);
  if (!safety.flag) return { safety }; // a check-in line, if any, is added by coach
  return { safety, reply: SAFE_REPLY[safety.flag] + (safety.checkin ? '\n\n' + CHECKIN : '') };
};
