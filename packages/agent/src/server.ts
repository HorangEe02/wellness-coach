// HTTP server for the Android shell (docs/DESIGN.md §7, stage 6). Runs in WSL: tools/wsl/serve.sh
//   GET  /              → the coach screen in app mode (docs/mockups/floating-coach.html?app=1, wired by app.js)
//   GET  /api/health    → { ok, decision }
//   GET  /api/today     → numbers for the home and walk screens, from core functions
//   POST /api/chat      → { text } → { reply, flag, checkin, intents }
//   POST /api/walks     → { start, distM, activeSec }   a walk recorded by the phone's GPS service
//   POST /api/steps     → { date: 'YYYY-MM-DD', steps } today's count from the phone's step sensor
//   GET  /api/strength  → today's plan day with suggested loads, recent workouts
//   POST /api/workouts  → { start, end, name, dayIndex, items: [{ exId, sets: [{ kg, reps, done }] }] } → { prs, strength }
// Every /api call except health names its user with a device id (a random id the app keeps).
// Binds 127.0.0.1 only: the phone reaches it through `adb reverse tcp:8787 tcp:8787`, so nothing is open to the LAN.
// The app's API calls are sealed with the pairing key (pairing.ts): a program squatting on port 8787 can neither read
// nor answer them. The screens themselves ship inside the APK; GET / here is for desktop development only.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import core from '@wellness/core';
import { ask, buildGraph } from './graph.ts';
import { modelsFromEnv } from './models/config.ts';
import { activityTools } from './modules/activity.ts';
import { exerciseById, strengthTools } from './modules/strength.ts';
import type { UserData } from './state.ts';
import { openStore } from './store.ts';
import type { Store } from './store.ts';
import { loadOrCreateKey, open, seal } from './pairing.ts';

// shortcut: the screen is the design mockup itself plus app.js; move to packages/web when it outgrows that.
const WEB = fileURLToPath(new URL('../../../docs/mockups/', import.meta.url));
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };
const MAX_BODY = 16384; // a long workout: 20 exercises × 10 sets fits
const MAX_TEXT = 1000;
const DEVICE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STEP_GOAL = 7000;
const DAY = 86400000;

class HttpError extends Error { code: number; constructor(code: number, msg: string) { super(msg); this.code = code; } }

const send = (res: ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readJson(req: IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new HttpError(413, 'body too large');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'invalid JSON'); }
}

const num = (v: unknown, min: number, max: number, name: string) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new HttpError(400, `${name}: number ${min}-${max}`);
  return v;
};

export function today(u: UserData, now: number) {
  const walks = activityTools.week(u, now);
  const { streak } = strengthTools.week(u, now);
  const rec = strengthTools.recovery(u, now);
  const tired = Object.entries(rec).filter(([, v]) => v < 70).sort((a, b) => a[1] - b[1]).slice(0, 2)
    .map(([m, v]) => ({ muscle: core.strength.MUSCLES[m] as string, pct: v }));
  return {
    steps: u.steps?.[core.shared.ymd(now)] ?? 0,
    stepGoal: STEP_GOAL,
    walks: { n: walks.thisWeek.n, distM: walks.thisWeek.distM, sec: walks.thisWeek.sec, kcal: walks.kcal },
    strength: { n: streak.thisWeek, goal: u.strength.settings.weeklyGoal },
    tired,
  };
}

const PR_LABEL: Record<string, string> = { weight: '최고 무게', e1rm: '최고 1RM(어림)', volume: '최고 세트 볼륨', reps: '최다 횟수' };
const prText = (p: any) => `${exerciseById[p.exId]?.name ?? p.exId} ${PR_LABEL[p.type]} ${p.type === 'reps' ? `${p.kg ? `${p.kg}kg × ` : ''}${p.value}회` : `${p.value}kg`}`;

export function strengthView(u: UserData) {
  const recent = [...u.strength.workouts].sort((a, b) => b.start - a.start).slice(0, 5).map(w => {
    const work = w.items.flatMap((it: any) => it.sets.filter((s: any) => s.done && s.type !== 'warmup'));
    return { start: w.start, name: w.name, sets: work.length, volume: Math.round(work.reduce((a: number, s: any) => a + (s.kg || 0) * (s.reps || 0), 0)), prs: (w.prs ?? []).map(prText) };
  });
  return { ...strengthTools.today(u), recent };
}

// Checks a workout from the app; exercises must exist in the catalogue and every number has a sane range.
function parseWorkout(b: any, now: number) {
  const start = num(b?.start, now - 2 * DAY, now + 60000, 'start');
  const end = num(b?.end, start, now + 60000, 'end');
  if (typeof b?.name !== 'string' || !b.name.trim() || b.name.length > 40) throw new HttpError(400, 'name: 1-40 chars');
  const dayIndex = b.dayIndex == null ? null : num(b.dayIndex, 0, 6, 'dayIndex');
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 20) throw new HttpError(400, 'items: 1-20');
  const items = b.items.map((it: any) => {
    if (!exerciseById[it?.exId]) throw new HttpError(400, `unknown exercise: ${String(it?.exId).slice(0, 40)}`);
    if (!Array.isArray(it.sets) || !it.sets.length || it.sets.length > 10) throw new HttpError(400, 'sets: 1-10 per exercise');
    return { exId: it.exId, sets: it.sets.map((s: any) => ({ kg: num(s?.kg, 0, 500, 'kg'), reps: Math.round(num(s?.reps, 0, 100, 'reps')), done: s?.done === true })) };
  });
  if (!items.some((it: any) => it.sets.some((s: any) => s.done && s.reps > 0))) throw new HttpError(400, 'no finished sets');
  return { start, end, name: b.name.trim(), dayIndex, items };
}

// Sealed API messages carry { ts, nonce, method, path, device, body }; the reply is sealed { nonce, status, body }.
const MAX_SKEW = 120000; // a sealed request older or newer than 2 minutes is refused
const MAX_SEALED = Math.ceil(MAX_BODY * 4 / 3) + 512;

async function readText(req: IncomingMessage, max: number): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > max) throw new HttpError(413, 'body too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createHandler({ graph = buildGraph(modelsFromEnv()), decision = process.env.DECISION_BACKEND ?? 'rules', store = openStore(), clock = Date.now, key = null }:
  { graph?: ReturnType<typeof buildGraph>; decision?: string; store?: Store; clock?: () => number; key?: Buffer | null } = {}) {
  const nonces = new Map<string, number>(); // nonce → time seen, so a captured request cannot be replayed

  // The API itself, independent of how the request arrived. Returns [status, body].
  async function api(method: string, path: string, device: unknown, body: any, now: number): Promise<[number, unknown]> {
    try {
      if (typeof device !== 'string' || !DEVICE.test(device)) throw new HttpError(400, 'x-device: random UUID required');
      if (path === '/api/today' && method === 'GET') return [200, today(store.get(device), now)];
      if (path === '/api/strength' && method === 'GET') return [200, strengthView(store.get(device))];
      if (method !== 'POST') throw new HttpError(405, 'method not allowed');
      if (path === '/api/chat') {
        const text = body?.text;
        if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) throw new HttpError(400, `text: 1-${MAX_TEXT} chars`);
        const out = await ask(text.trim(), store.get(device), now, graph);
        return [200, { reply: out.reply, flag: out.safety.flag, checkin: !!out.safety.checkin, intents: out.intents ?? [] }];
      }
      if (path === '/api/walks') {
        const walk = { start: num(body?.start, now - 2 * DAY, now + 60000, 'start'), distM: num(body?.distM, 0, 100000, 'distM'), activeSec: num(body?.activeSec, 0, DAY / 1000, 'activeSec') };
        const u = store.get(device);
        // the phone retries on a dropped connection: the start time identifies a walk
        if (!u.walks.some(w => w.start === walk.start)) { u.walks.push(walk); store.save(device, u); }
        return [200, today(u, now)];
      }
      if (path === '/api/steps') {
        const date = body?.date;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date: YYYY-MM-DD');
        const steps = Math.round(num(body?.steps, 0, 200000, 'steps'));
        const u = store.get(device);
        u.steps = { ...u.steps, [date]: Math.max(u.steps?.[date] ?? 0, steps) }; // counts only grow within a day
        store.save(device, u);
        return [200, today(u, now)];
      }
      if (path === '/api/workouts') {
        const w = parseWorkout(body, now);
        const u = store.get(device);
        let prs: string[] = [];
        if (!u.strength.workouts.some((x: any) => x.start === w.start)) { // a retried upload is saved once
          const workout = strengthTools.record(u, w);
          u.strength.workouts.push(workout);
          if (w.dayIndex !== null && w.dayIndex === strengthTools.today(u).dayIndex) u.strength.planNext = w.dayIndex + 1;
          store.save(device, u);
          prs = workout.prs.map(prText);
        }
        return [200, { prs, strength: strengthView(u) }];
      }
      throw new HttpError(404, 'not found');
    } catch (e: any) {
      if (e instanceof HttpError) return [e.code, { error: e.message }];
      throw e;
    }
  }

  // With a key, every /api call must be a sealed POST to the same path; anything else gets a bare 401.
  async function sealedApi(req: IncomingMessage, res: ServerResponse, path: string) {
    const now = clock();
    let msg: any;
    try {
      if (req.method !== 'POST') throw new Error('sealed calls are POST');
      msg = open(key!, await readText(req, MAX_SEALED));
      if (msg.path !== path || typeof msg.method !== 'string' || typeof msg.nonce !== 'string' || !/^[0-9a-f]{32}$/.test(msg.nonce)) throw new Error('bad envelope');
      if (typeof msg.ts !== 'number' || Math.abs(now - msg.ts) > MAX_SKEW) throw new Error('stale');
      for (const [n, t] of nonces) if (now - t > 2 * MAX_SKEW) nonces.delete(n);
      if (nonces.has(msg.nonce)) throw new Error('replayed');
      nonces.set(msg.nonce, now);
    } catch (e: any) {
      if (e instanceof HttpError && e.code === 413) return send(res, 413, { error: 'body too large' });
      return send(res, 401, { error: 'unpaired or invalid request' });
    }
    const [status, body] = await api(msg.method, path, msg.device, msg.body ?? null, now);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(seal(key!, { nonce: msg.nonce, status, body })); // the nonce ties this reply to that request
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/api/health') return send(res, 200, { ok: true, decision, paired: !!key });
      if (url.pathname.startsWith('/api/')) {
        if (key) return await sealedApi(req, res, url.pathname);
        const body = req.method === 'POST' ? await readJson(req) : null;
        const [status, out] = await api(req.method ?? 'GET', url.pathname, req.headers['x-device'], body, clock());
        return send(res, status, out);
      }
      if (req.method !== 'GET') throw new HttpError(405, 'GET only');
      if (url.pathname === '/') { res.writeHead(302, { location: '/floating-coach.html?app=1' }); return res.end(); }
      const file = normalize(join(WEB, decodeURIComponent(url.pathname)));
      if (!file.startsWith(WEB.endsWith(sep) ? WEB : WEB + sep) || !TYPES[extname(file)]) throw new HttpError(404, 'not found');
      const data = await readFile(file).catch(() => null);
      if (!data) throw new HttpError(404, 'not found');
      res.writeHead(200, { 'content-type': TYPES[extname(file)], 'cache-control': 'no-cache' });
      res.end(data);
    } catch (e: any) {
      if (e instanceof HttpError) return send(res, e.code, { error: e.message });
      console.error(e);
      send(res, 500, { error: 'server error' });
    }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  const models = modelsFromEnv();
  // INSECURE_DEV=1: plain JSON API for trying the screens in a desktop browser; never with the phone.
  const key = process.env.INSECURE_DEV === '1' ? null : loadOrCreateKey();
  // Load LFM3 into memory now: a cold first call took 13 s, past the 12 s judge limit, and fell back to d1's top class.
  if (models.chat) models.chat([{ role: 'user', content: '안녕' }], { timeoutMs: 120000 })
    .then(() => console.log('LFM3 warm'), e => console.error(`LFM3 warm-up failed: ${e.message}`));
  createServer(createHandler({ graph: buildGraph(models), key })).listen(port, host,
    () => console.log(`wellness server on http://${host}:${port} (decision: ${process.env.DECISION_BACKEND ?? 'rules'}, ${key ? 'sealed API: run "npm run pair" once per phone' : 'INSECURE_DEV plain API'})`));
}
