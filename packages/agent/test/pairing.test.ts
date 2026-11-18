import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { NOW, demoUser } from '../src/fixtures/demo-user.ts';
import { open, seal } from '../src/pairing.ts';
import { createHandler } from '../src/server.ts';
import { openStore } from '../src/store.ts';

const DEVICE = '44444444-4444-4444-8444-444444444444';
const key = randomBytes(32);
const store = openStore(':memory:');
store.save(DEVICE, structuredClone(demoUser));
let base = '';
const srv = createServer(createHandler({ decision: 'rules', store, clock: () => NOW, key }));
before(() => new Promise<void>(r => srv.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; r(); })));
after(() => srv.close());

// What the Android bridge (WebBridge.api) sends
const envelope = (path: string, method: string, body: unknown = null, o: object = {}) =>
  ({ ts: NOW, nonce: randomBytes(16).toString('hex'), method, path, device: DEVICE, body, ...o });
const call = (path: string, sealed: string) => fetch(`${base}${path}`, { method: 'POST', body: sealed });

test('a sealed request gets a sealed reply bound to its nonce', async () => {
  const env = envelope('/api/chat', 'POST', { text: '이번 주 운동 어땠어?' });
  const r = await call('/api/chat', seal(key, env));
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.doesNotMatch(text, /운동/); // nothing readable on the wire
  const reply = open(key, text);
  assert.equal(reply.nonce, env.nonce);
  assert.equal(reply.status, 200);
  assert.match(reply.body.reply, /이번 주 2번 운동했어요/);
  const g = open(key, await (await call('/api/today', seal(key, envelope('/api/today', 'GET')))).text());
  assert.equal(g.body.steps, 6812); // GET routes travel the same way
});

test('API errors come back sealed too', async () => {
  const reply = open(key, await (await call('/api/chat', seal(key, envelope('/api/chat', 'POST', { text: '' })))).text());
  assert.equal(reply.status, 400);
});

test('refuses plain, tampered, replayed, stale, misrouted and wrong-key requests', async () => {
  const plain = await fetch(`${base}/api/today`, { headers: { 'x-device': DEVICE } });
  assert.equal(plain.status, 401);
  assert.equal((await call('/api/today', 'not sealed')).status, 401);

  const good = seal(key, envelope('/api/today', 'GET'));
  const buf = Buffer.from(good, 'base64'); buf[20] ^= 1;
  assert.equal((await call('/api/today', buf.toString('base64'))).status, 401); // one flipped bit

  const once = seal(key, envelope('/api/today', 'GET'));
  assert.equal((await call('/api/today', once)).status, 200);
  assert.equal((await call('/api/today', once)).status, 401); // replay

  assert.equal((await call('/api/today', seal(key, envelope('/api/today', 'GET', null, { ts: NOW - 10 * 60000 })))).status, 401);
  assert.equal((await call('/api/walks', seal(key, envelope('/api/today', 'GET')))).status, 401); // sealed for another path
  assert.equal((await call('/api/today', seal(randomBytes(32), envelope('/api/today', 'GET')))).status, 401);
});

test('health stays open and says the API is paired', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, decision: 'rules', paired: true });
});
