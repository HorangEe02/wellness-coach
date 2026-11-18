import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { NOW, demoUser } from '../src/fixtures/demo-user.ts';
import { createHandler } from '../src/server.ts';
import { openStore } from '../src/store.ts';

const DEMO = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';
const store = openStore(':memory:');
store.save(DEMO, structuredClone(demoUser));

let base = '';
const srv = createServer(createHandler({ decision: 'rules', store, clock: () => NOW }));
before(() => new Promise<void>(r => srv.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; r(); })));
after(() => srv.close());

const post = (path: string, body: unknown, device = DEMO) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'x-device': device }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const today = async (device: string) => (await fetch(`${base}/api/today`, { headers: { 'x-device': device } })).json();

test('chat answers from the stored user\'s core numbers', async () => {
  const j = await (await post('/api/chat', { text: '이번 주 운동 어땠어?' })).json();
  assert.deepEqual(j.intents, ['strength']);
  assert.match(j.reply, /이번 주 2번 운동했어요/);
  assert.equal(j.flag, null);
});

test('chat returns the fixed crisis reply for self-harm', async () => {
  const j = await (await post('/api/chat', { text: '요즘 그냥 죽고 싶다는 생각만 들어' })).json();
  assert.equal(j.flag, 'selfharm');
  assert.match(j.reply, /109/);
});

test('a new device starts empty and keeps its own records', async () => {
  const t0 = await today(NEW);
  assert.deepEqual([t0.steps, t0.walks.n, t0.strength.n], [0, 0, 0]);
  const walk = { start: NOW - 3600000, distM: 2500, activeSec: 1800 };
  assert.equal((await post('/api/walks', walk, NEW)).status, 200);
  await post('/api/walks', walk, NEW); // retried upload is not counted twice
  await post('/api/steps', { date: '2026-11-17', steps: 4200 }, NEW);
  await post('/api/steps', { date: '2026-11-17', steps: 3000 }, NEW); // stale lower count is ignored
  const t1 = await today(NEW);
  assert.deepEqual([t1.walks.n, t1.walks.distM, t1.steps], [1, 2500, 4200]);
  const j = await (await post('/api/chat', { text: '이번 주 산책 얼마나 했어?' }, NEW)).json();
  assert.match(j.reply, /이번 주 1번 걸었어요\. 2\.5km/);
  assert.equal((await today(DEMO)).walks.n, 2); // the demo user is untouched
});

test('strength plan suggests the next load and a saved workout moves the plan on', async () => {
  const S = '33333333-3333-4333-8333-333333333333';
  store.save(S, structuredClone(demoUser));
  const s0 = await (await fetch(`${base}/api/strength`, { headers: { 'x-device': S } })).json();
  assert.equal(s0.dayName, '미는 날');
  const bench = s0.items.find((i: any) => i.exId === 'bench_bb');
  assert.deepEqual([bench.kg, bench.reps, bench.action], [65, 8, 'weight']); // 62.5 × 8 all done last time → +2.5
  const workout = {
    start: NOW - 1800000, end: NOW - 600000, name: '미는 날', dayIndex: 0,
    items: [{ exId: 'bench_bb', sets: [{ kg: 65, reps: 8, done: true }, { kg: 65, reps: 8, done: true }, { kg: 65, reps: 6, done: false }] }],
  };
  const r = await (await post('/api/workouts', workout, S)).json();
  assert.ok(r.prs.some((p: string) => p === '바벨 벤치프레스 최고 무게 65kg'), r.prs.join());
  assert.equal(r.strength.dayName, '당기는 날'); // plan moved to day 2
  assert.equal(r.strength.recent[0].sets, 2); // the unfinished set is kept but not counted
  const again = await (await post('/api/workouts', workout, S)).json();
  assert.deepEqual(again.prs, []); // retried upload is not saved twice
  assert.equal(again.strength.recent.filter((w: any) => w.start === workout.start).length, 1);
  const chat = await (await post('/api/chat', { text: '이번 주 운동 어땠어?' }, S)).json();
  assert.match(chat.reply, /이번 주 3번 운동했어요/);
});

test('rejects bad workouts', async () => {
  const ok = { start: NOW - 3600000, end: NOW, name: 'x', dayIndex: null, items: [{ exId: 'bench_bb', sets: [{ kg: 60, reps: 8, done: true }] }] };
  assert.equal((await post('/api/workouts', { ...ok, items: [{ exId: 'nope', sets: ok.items[0].sets }] })).status, 400);
  assert.equal((await post('/api/workouts', { ...ok, items: [{ exId: 'bench_bb', sets: [{ kg: 900, reps: 8, done: true }] }] })).status, 400);
  assert.equal((await post('/api/workouts', { ...ok, items: [{ exId: 'bench_bb', sets: [{ kg: 60, reps: 8, done: false }] }] })).status, 400); // nothing finished
  assert.equal((await post('/api/workouts', { ...ok, end: ok.start - 1 })).status, 400);
});

test('today reports tired muscles and the weekly strength count', async () => {
  const t = await today(DEMO);
  assert.deepEqual(t.strength, { n: 2, goal: 3 });
  assert.ok(t.tired.every((m: any) => m.pct === 0)); // squats (quads, glutes, low back) ended at NOW
});

test('rejects bad input', async () => {
  assert.equal((await post('/api/chat', 'not json')).status, 400);
  assert.equal((await post('/api/chat', { text: '' })).status, 400);
  assert.equal((await post('/api/chat', { text: 'x'.repeat(20000) })).status, 413);
  assert.equal((await post('/api/chat', { text: '안녕' }, 'me')).status, 400); // device id must be a random UUID
  assert.equal((await fetch(`${base}/api/chat`, { headers: { 'x-device': DEMO } })).status, 405);
  assert.equal((await post('/api/walks', { start: NOW, distM: -1, activeSec: 10 })).status, 400);
  assert.equal((await post('/api/walks', { start: NOW - 30 * 86400000, distM: 100, activeSec: 10 })).status, 400);
  assert.equal((await post('/api/steps', { date: 'today', steps: 10 })).status, 400);
});

test('serves the app screen and nothing outside docs/mockups', async () => {
  const home = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(home.headers.get('location'), '/floating-coach.html?app=1');
  const page = await fetch(`${base}/floating-coach.html`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /text\/html/);
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/img/web/icons/ic-coach.png`)).status, 200);
  assert.equal((await fetch(`${base}/..%2f..%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e/%2e%2e/.data-go-kr-key`)).status, 404);
});
