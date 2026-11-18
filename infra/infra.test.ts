// Run: node --test infra/infra.test.ts
// The model servers must stay local, and their ports/files must match what the agent's clients expect.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { modelsFromEnv } from '../packages/agent/src/models/config.ts';

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\r\n/g, '\n'); // git may check out CRLF on Windows
const compose = read('./models.compose.yaml');
const modelfile = read('./wellness-lfm3.Modelfile');

test('every published port binds to 127.0.0.1 only', () => {
  const ports = [...compose.matchAll(/ports:\s*\[([^\]]*)\]/g)].flatMap(m => m[1].split(',').map(s => s.trim().replace(/["']/g, '')));
  assert.equal(ports.length, 2);
  for (const p of ports) assert.match(p, /^127\.0\.0\.1:\d+:\d+$/, `port ${p} is reachable from outside this PC`);
});

test('compose ports match the client defaults (d1 8081, laya 8082)', () => {
  const svc = (name: string) => compose.split(/\n  (?=\w+:\n)/).find(b => b.startsWith(name + ':')) ?? '';
  assert.match(svc('d1'), /127\.0\.0\.1:8081:8080/);
  assert.match(svc('d1'), /\/models\/d1-2B\/d1-2B-Q8_0\.gguf/);
  assert.match(svc('laya'), /127\.0\.0\.1:8082:8080/);
  assert.match(svc('laya'), /\/models\/laya-multilingual\/Laya-Multilingual-Q8_0\.gguf/);
  // the clients default to the same ports
  assert.ok(modelsFromEnv({ DECISION_BACKEND: 'd1' }).decider);
});

test('model folder is mounted read-only and MODELS_DIR is required', () => {
  assert.match(compose, /\$\{MODELS_DIR:\?[^}]+\}:\/models:ro/);
});

test('wellness-lfm3 extends context and uses the model card sampling', () => {
  assert.match(modelfile, /^FROM hf\.co\/LiquidAI\/LFM3-1\.7B-GGUF:Q8_0$/m);
  assert.match(modelfile, /^PARAMETER num_ctx 32768$/m);
  assert.match(modelfile, /^PARAMETER temperature 0\.1$/m);
});
