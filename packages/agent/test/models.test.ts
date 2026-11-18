// Model clients against a throwaway local HTTP server standing in for llama.cpp / Ollama.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { openAIChat } from '../src/models/chat.ts';
import { modelsFromEnv } from '../src/models/config.ts';
import { llmChoice } from '../src/models/llmchoice.ts';
import { systemOne } from '../src/models/systemone.ts';

const seen: any[] = [];
const server = createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body || '{}') });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/v1/systemone') return res.end(JSON.stringify({ answers: { strength: { noul: 0.93 } }, usage: { input_tokens: 9 } }));
    if (req.url === '/llm/chat/completions') return res.end(JSON.stringify({ choices: [{ logprobs: { content: [{ top_logprobs: [{ token: '4', logprob: Math.log(0.6) }, { token: '1', logprob: Math.log(0.2) }, { token: '번호', logprob: Math.log(0.1) }] }] } }] }));
    if (req.url === '/v1/chat/completions') return res.end(JSON.stringify({ choices: [{ message: { content: '  이번 주 2번 운동했어요.  ' } }] }));
    res.statusCode = 500;
    res.end('{"error":"boom"}');
  });
});
let base = '';
before(() => new Promise<void>(ok => server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; ok(); })));
after(() => new Promise<void>(ok => server.close(() => ok())));

test('systemOne posts state + questions and returns answers', async () => {
  const decide = systemOne({ baseUrl: base + '/' });
  const a = await decide('이번 주 운동 어땠어?', { strength: { type: 'noul', instructions: '근력 운동에 대한 질문인가?' } });
  assert.equal(a.strength.noul, 0.93);
  const req = seen.at(-1);
  assert.equal(req.url, '/v1/systemone');
  assert.deepEqual(Object.keys(req.body), ['state', 'questions']);
  assert.equal(req.auth, undefined);
});

test('systemOne refuses non-string state (records must not reach the decider)', async () => {
  const decide = systemOne({ baseUrl: base });
  await assert.rejects(decide({ glucose: 180 } as any, {}), /state must be the user sentence/);
});

test('systemOne surfaces HTTP errors', async () => {
  await assert.rejects(systemOne({ baseUrl: base + '/broken' })('x', {}), /systemone 500/);
});

test('openAIChat sends LFM3 sampling settings with thinking off and trims the reply', async () => {
  const chat = openAIChat({ baseUrl: base + '/v1', model: 'wellness-lfm3' });
  assert.equal(await chat([{ role: 'user', content: '요약해줘' }]), '이번 주 2번 운동했어요.');
  const { body } = seen.at(-1);
  assert.equal(body.model, 'wellness-lfm3');
  assert.equal(body.temperature, 0.1);
  assert.equal(body.reasoning_effort, 'none');
});

test('openAIChat with thinking drops reasoning_effort and uses temperature 0', async () => {
  await openAIChat({ baseUrl: base + '/v1', model: 'wellness-lfm3' })([{ role: 'user', content: '판정' }], { thinking: true });
  const { body } = seen.at(-1);
  assert.equal(body.temperature, 0);
  assert.equal('reasoning_effort' in body, false);
});

test('modelsFromEnv defaults to rules and template replies', () => {
  assert.deepEqual(modelsFromEnv({}), { decider: null, chat: null });
  assert.ok(modelsFromEnv({ DECISION_BACKEND: 'd1' }).decider);
  assert.ok(modelsFromEnv({ DECISION_BACKEND: 'laya', LLM_MODEL: 'wellness-lfm3' }).chat);
  // hosted d1.2-ultra is deliberately not a backend, even with a key set
  assert.throws(() => modelsFromEnv({ DECISION_BACKEND: 'd1-ultra', LIQUID_API_KEY: 'liquid_x' }), /unknown DECISION_BACKEND/);
  assert.throws(() => modelsFromEnv({ DECISION_BACKEND: 'gpt' }), /unknown DECISION_BACKEND/);
});

test('llmChoice numbers the options, prefills the answer and renormalises the option logprobs', async () => {
  const q = { type: 'choice' as const, instructions: '종류?', criteria: { selfharm: '자해', emergency: '응급', medical: '의료', none: '일반' } };
  const a = (await llmChoice({ baseUrl: base + '/llm', model: 'wellness-lfm3' })('오늘 3km 걸었어', { kind: q })).kind;
  assert.equal(a.choice, 'none');
  assert.ok(Math.abs(a.probabilities!.none - 0.75) < 1e-9 && Math.abs(a.probabilities!.selfharm - 0.25) < 1e-9);
  assert.equal(a.probabilities!.emergency, 0);
  const body = seen.at(-1).body;
  assert.match(body.messages[0].content, /1: 자해\n2: 응급\n3: 의료\n4: 일반/);
  assert.deepEqual([body.messages.at(-1), body.max_tokens, body.logprobs], [{ role: 'assistant', content: '답: ' }, 1, true]);
  await assert.rejects(llmChoice({ baseUrl: base + '/llm', model: 'm' })('x', { k: { type: 'noul', instructions: 'y' } }), /only choice/);
});
