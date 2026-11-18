// App mode for floating-coach.html (?app=1). Loaded after the mockup script, so it reuses its globals
// (BODY, PAGES, HELP, bot, me, qr, av, set, render, ov, tab, page, $) and only swaps sample content for live data.
// Server: packages/agent/src/server.ts. Phone features come from window.Native (apps/android WebBridge.java).
const N = window.Native ?? null;
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmtKm = m => (m / 1000).toFixed(1) + 'km';
const fmtDur = sec => { const h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60); return h ? `${h}시간 ${m}분` : `${m}분`; };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Who this phone is: a random id kept in the WebView. shortcut: losing app data starts a new user; accounts come with sync.
const DEVICE = (() => {
  try { return localStorage.getItem('device') || (localStorage.setItem('device', crypto.randomUUID()), localStorage.getItem('device')); }
  catch { return crypto.randomUUID(); }
})();
const api = async (path, body) => {
  const r = await fetch('/api/' + path, body === undefined ? { headers: { 'x-device': DEVICE } }
    : { method: 'POST', headers: { 'x-device': DEVICE, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error);
  return j;
};

// ---------- home and pages: numbers from /api/today ----------
let T = null;
const sample = el => { if (el && !el.querySelector('.sample-tag')) el.insertAdjacentHTML('beforeend', '<span class="sample-tag">예시</span>'); };
function fillHome() {
  const rows = document.querySelectorAll('.lrow');
  sample(document.querySelector('.rail')?.closest('.sec')?.querySelector('.sec-h h2')); // meals: stage 3
  sample(rows[1]?.querySelector('.pname')); // water: not recorded yet
  if (!T) return;
  const pct = Math.min(100, Math.round(T.steps / T.stepGoal * 100));
  rows[0].querySelector('.pname').textContent = `오늘 ${T.steps.toLocaleString('ko-KR')}보`;
  rows[0].querySelector('.pval').innerHTML = `<em>${pct}%</em>${T.steps >= T.stepGoal ? '목표 달성!' : `${T.stepGoal.toLocaleString('ko-KR')}보까지 ${(T.stepGoal - T.steps).toLocaleString('ko-KR')}보`}`;
  const s = T.strength, left = Math.max(0, s.goal - s.n);
  document.querySelector('.strip b').textContent = s.n ? `이번 주 근력 ${s.n}회${left ? ` · ${left}회 남음` : ' 완료!'}` : '이번 주 근력 기록이 아직 없어요';
  document.querySelector('.strip span').textContent = T.tired.length ? `${T.tired.map(t => t.muscle).join('·')} 회복 중 · 다른 부위나 산책 추천` : '모든 근육이 회복된 상태예요';
  const rank = document.querySelector('.rank');
  rank.innerHTML = rankRow(1, 'tint-b', 'ic-walking', '유산소', '걷기', T.walks.n ? `${T.walks.n}회 · ${fmtKm(T.walks.distM)}` : '아직 없어요')
    + rankRow(2, 'tint-a', 'ic-barbell', '근력', '근력 운동', s.n ? `${s.n}회 · 목표 ${s.goal}회` : '아직 없어요');
}
const rankRow = (no, tint, icon, tag, name, val) => `<div class="r"><span class="no">${no}</span><div class="thumb ${tint}"><img class="icon" src="img/web/icons/${icon}.png" alt=""></div><div><div class="tags"><span class="t1">${tag}</span></div><div class="pname">${name}</div><div class="pval">${val}</div></div></div>`;

function fillPage() {
  const pg = $('page');
  // render() runs often; draw the strength page only when it was just (re)entered, so typing keeps its focus
  if (page === 'strength' && !pg.querySelector('[data-strength]')) drawStrength();
  document.documentElement.classList.toggle('logging', page === 'strength' && !!live); // hide the coach button over the set rows
  if (page === 'walk') {
    if (T) {
      const v = pg.querySelectorAll('.stats4 b');
      if (v.length === 4) {
        v[0].textContent = `${T.walks.n}회`; v[1].textContent = fmtKm(T.walks.distM); v[2].textContent = fmtDur(T.walks.sec);
        v[3].textContent = T.walks.distM ? (s => `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, '0')}"/km`)(T.walks.sec / (T.walks.distM / 1000)) : '-';
      }
    }
    const btn = pg.querySelector('.go-btn');
    if (btn && !btn.dataset.wired) { btn.dataset.wired = '1'; btn.onclick = toggleWalk; }
    showWalk();
  }
}
async function refresh() {
  const [t, s] = await Promise.allSettled([api('today'), api('strength')]); // offline: keep what is shown
  if (t.status === 'fulfilled') T = t.value;
  if (s.status === 'fulfilled') SP = s.value;
  fillHome(); fillPage();
  if (page === 'strength' && !live) drawStrength();
}

// ---------- strength: today's plan, logging sets, recent records (egg-kim-coach) ----------
let SP = null; // GET /api/strength
let cancelArmed = false;
const LIVE_KEY = 'liveWorkout'; // the workout in progress survives closing the app, like egg-kim-coach's autosave
let live = (() => { try { return JSON.parse(localStorage.getItem(LIVE_KEY)); } catch { return null; } })();
const saveLive = () => { try { live ? localStorage.setItem(LIVE_KEY, JSON.stringify(live)) : localStorage.removeItem(LIVE_KEY); } catch { /* memory only */ } };
const exIcon = id => ICO(/^(bench|incline)/.test(id) ? 'ic-ex-bench' : /pulldown|pullup|chinup/.test(id) ? 'ic-ex-latpull' : 'ic-barbell');
const TAG = { weight: ['b', '증량'], reps: ['b', '+1회'], keep: ['ok', '유지'], first: ['warn', '첫 기록'] };
const mmdd = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`; };
PAGES.strength = ptop('근력 운동') + '<p class="p-note">불러오는 중…</p>';

function planHtml() {
  const d = SP, mins = Math.round(d.items.reduce((a, it) => a + it.sets, 0) * 2.5);
  const tired = T?.tired?.length ? `${T.tired.map(t => t.muscle).join('·')} 회복 중` : '근육이 모두 회복된 상태예요';
  const rows = d.items.map(it => `<div class="ex"><img class="exi" src="${exIcon(it.exId)}" alt=""><div class="tx"><b>${esc(it.name)}</b>
    <span>${it.sets}세트 × ${it.reps}회${it.kind === 'weight' ? (it.kg ? ` · ${it.kg}kg` : ' · 무게는 직접 입력') : ''}</span></div><span class="tg ${TAG[it.action][0]}">${TAG[it.action][1]}</span></div>`).join('');
  const musc = T?.tired?.length ? `<div class="musc">${T.tired.map(t => `<div class="low">${esc(t.muscle)}${bar(t.pct)}<span>${t.pct}%</span></div>`).join('')}</div>` : '<p class="p-note flat">모든 근육이 회복된 상태예요</p>';
  const recent = d.recent.length ? d.recent.map(w => `<div class="ex"><img class="exi" src="${ICO('ic-workout')}" alt=""><div class="tx"><b>${mmdd(w.start)} · ${esc(w.name)}</b>
    <span>${w.sets}세트 · 볼륨 ${w.volume.toLocaleString('ko-KR')}kg${w.prs.length ? ` · ${esc(w.prs[0])}` : ''}</span></div>${w.prs.length ? '<span class="tg b">신기록</span>' : ''}</div>`).join('')
    : '<p class="p-note">아직 기록이 없어요. 오늘 계획으로 시작해 보세요.</p>';
  return ptop('근력 운동') + `<div data-strength></div>
    <div class="banner dark"><img src="img/web/strength-banner.jpg" alt=""><div class="tx"><span>오늘 계획 · ${esc(d.split)} ${d.dayIndex + 1}/${d.days}일차</span><b>${esc(d.dayName)}<br>${d.items.length}종목 · 약 ${mins}분</b><em>${esc(tired)}</em></div></div>
    <div class="p-sec"><h3>종목</h3>${rows}<div style="margin-top:14px"><button class="btn-pill" data-act="start">운동 시작</button></div></div>
    <div class="p-sec"><h3>근육 회복도</h3>${musc}</div>
    <div class="p-sec"><h3>최근 기록</h3>${recent}</div>
    <p class="p-note">증량은 지난번 세트를 목표 횟수만큼 모두 채웠을 때만 제안해요 (상체 +2.5kg · 하체 +5kg). 회복도는 어림값이에요.</p>`;
}

function liveHtml() {
  const min = Math.max(0, Math.round((Date.now() - live.start) / 60000));
  const cards = live.items.map((it, i) => `<div class="p-sec lw"><h3><img class="exi" src="${exIcon(it.exId)}" alt="">${esc(it.name)}</h3>
    <div class="lset head"><span>세트</span><span>${it.kind === 'weight' ? 'kg' : ''}</span><span>횟수</span><span>완료</span></div>
    ${it.sets.map((s, j) => `<div class="lset${s.done ? ' done' : ''}"><span>${j + 1}</span>
      ${it.kind === 'weight' ? `<input type="number" inputmode="decimal" step="0.5" min="0" max="500" value="${s.kg}" data-i="${i}" data-j="${j}" data-f="kg" aria-label="${esc(it.name)} ${j + 1}세트 무게(kg)">` : '<span>맨몸</span>'}
      <input type="number" inputmode="numeric" min="0" max="100" value="${s.reps}" data-i="${i}" data-j="${j}" data-f="reps" aria-label="${esc(it.name)} ${j + 1}세트 횟수">
      <button class="chk" data-act="done" data-i="${i}" data-j="${j}" aria-pressed="${s.done}" aria-label="${esc(it.name)} ${j + 1}세트 완료">✓</button></div>`).join('')}
    ${it.sets.length < 10 ? `<button class="add-set" data-act="add" data-i="${i}">+ 세트 추가</button>` : ''}</div>`).join('');
  return ptop(`${esc(live.name)} · <span id="liveMin">${min}</span>분`) + `<div data-strength></div>${cards}
    <div class="lw-foot"><button class="pill-btn blue" data-act="finish">운동 끝내기</button><button class="lw-cancel" data-act="cancel">${cancelArmed ? '정말 취소할까요? 한 번 더 누르면 지워져요' : '운동 취소'}</button></div>`;
}

function drawStrength() {
  if (page !== 'strength') return;
  document.documentElement.classList.toggle('logging', !!live);
  $('page').innerHTML = live ? liveHtml() : SP ? planHtml() : PAGES.strength.replace('불러오는 중…', '서버에 연결하면 오늘 계획을 보여 드려요') + '<div data-strength></div>';
}

$('page').addEventListener('input', e => {
  const f = e.target.dataset.f;
  if (!live || !f) return;
  const v = Number(e.target.value);
  live.items[e.target.dataset.i].sets[e.target.dataset.j][f] = Number.isFinite(v) ? Math.max(0, Math.min(f === 'kg' ? 500 : 100, v)) : 0;
  saveLive();
});
$('page').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b || page !== 'strength') return;
  const act = b.dataset.act;
  if (act !== 'cancel') cancelArmed = false;
  if (act === 'start' && SP) {
    live = { start: Date.now(), name: SP.dayName, dayIndex: SP.dayIndex,
      items: SP.items.map(it => ({ exId: it.exId, name: it.name, kind: it.kind, sets: Array.from({ length: it.sets }, () => ({ kg: it.kg, reps: it.reps, done: false })) })) };
    saveLive(); drawStrength(); $('page').scrollTop = 0;
  } else if (act === 'done') {
    const s = live.items[b.dataset.i].sets[b.dataset.j];
    s.done = !s.done; saveLive();
    b.setAttribute('aria-pressed', s.done); b.closest('.lset').classList.toggle('done', s.done);
  } else if (act === 'add') {
    const sets = live.items[b.dataset.i].sets, last = sets[sets.length - 1];
    sets.push({ kg: last.kg, reps: last.reps, done: false }); saveLive(); drawStrength();
  } else if (act === 'cancel') {
    if (!cancelArmed) { cancelArmed = true; b.textContent = '정말 취소할까요? 한 번 더 누르면 지워져요'; return; }
    cancelArmed = false; live = null; saveLive(); drawStrength();
  } else if (act === 'finish') {
    if (!live.items.some(it => it.sets.some(s => s.done && s.reps > 0))) return toast('완료(✓)한 세트가 없어요');
    b.disabled = true;
    try {
      const r = await api('workouts', { start: live.start, end: Date.now(), name: live.name, dayIndex: live.dayIndex,
        items: live.items.map(it => ({ exId: it.exId, sets: it.sets.map(({ kg, reps, done }) => ({ kg: Number(kg) || 0, reps: Math.round(Number(reps) || 0), done })) })) });
      live = null; saveLive(); SP = r.strength;
      toast(r.prs.length ? `신기록! ${r.prs[0]}` : '운동을 저장했어요');
      refresh();
    } catch { toast('저장하지 못했어요. 기록은 남아 있으니 잠시 뒤 다시 눌러 주세요'); b.disabled = false; return; }
    drawStrength();
  }
});
setInterval(() => { const m = $('liveMin'); if (m && live) m.textContent = Math.max(0, Math.round((Date.now() - live.start) / 60000)); }, 30000);

// ---------- walk recording (native GPS service) ----------
let walkTimer = null;
const walkState = () => { try { return JSON.parse(N.walkStatus()); } catch { return { recording: false }; } };
function showWalk() {
  const btn = $('page').querySelector('.go-btn');
  if (!btn) return;
  if (!N) { btn.innerHTML = '앱에서<br>기록'; btn.disabled = true; return; }
  const w = walkState();
  btn.innerHTML = w.recording ? `${fmtKm(w.distM)}<br><small>${Math.floor(w.activeSec / 60)}분 · 끝내기</small>` : '기록<br>시작';
  btn.setAttribute('aria-pressed', w.recording);
  if (w.recording && !walkTimer) walkTimer = setInterval(showWalk, 2000);
  if (!w.recording && walkTimer) { clearInterval(walkTimer); walkTimer = null; }
}
async function toggleWalk() {
  if (!walkState().recording) {
    const r = N.startWalk(); // "ok" | "permission" (asked, tap again) | "gps-off"
    if (r === 'gps-off') toast('위치(GPS)를 켜 주세요');
    if (r === 'permission') toast('위치 권한을 허용한 뒤 다시 눌러 주세요');
    return showWalk();
  }
  const w = JSON.parse(N.stopWalk());
  showWalk();
  if (w.distM < 50) return toast('50m보다 짧은 기록은 저장하지 않았어요');
  try { T = await api('walks', { start: w.start, distM: Math.round(w.distM), activeSec: Math.round(w.activeSec) }); toast(`${fmtKm(w.distM)} 저장했어요`); }
  catch { N.keepUnsent?.(JSON.stringify(w)); toast('서버에 저장하지 못했어요. 다음에 앱을 열 때 다시 보낼게요'); }
  fillHome(); fillPage();
}
async function sendUnsent() {
  if (!N?.takeUnsent) return;
  for (const w of JSON.parse(N.takeUnsent() || '[]')) {
    try { await api('walks', { start: w.start, distM: Math.round(w.distM), activeSec: Math.round(w.activeSec) }); }
    catch { N.keepUnsent(JSON.stringify(w)); }
  }
}

// ---------- steps (native step sensor) ----------
async function sendSteps() {
  if (!N) return;
  const n = N.stepsToday(); // -1: no sensor or no permission
  if (n >= 0) try { T = await api('steps', { date: ymd(new Date()), steps: n }); fillHome(); } catch { /* next tick */ }
}

function toast(text) {
  const t = Object.assign(document.createElement('div'), { className: 'toast', role: 'status', textContent: text });
  document.querySelector('.phone').append(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------- coach chat (/api/chat) and voice (on-device STT/TTS) ----------
const typingRow = `<div class="mrow">${av}<div class="typing"><i></i><i></i><i></i></div></div>`;
let log = bot('안녕하세요! 기록을 보고 답해 드릴게요. 무엇을 도와드릴까요?') + qr('이번 주 운동 어땠어?') + qr('회복 덜 된 근육 있어?') + qr('이번 주 산책 얼마나 했어?');
let busy = false;
BODY.chat = log;
BODY.voice = `<div class="listen"><span class="big">${u('i-mic')}</span><div class="wave"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="stt" id="sttText">말씀해 주세요</div>기기 안에서 알아들어요 · 말을 마치면 자동으로 보내요</div>`;
const speak = text => { if (N && $('ttsBtn').dataset.on === '1') N.speak(text); };

async function askCoach(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true; log += me(esc(text)); BODY.chat = log + typingRow; render();
  let html, plain;
  try {
    const j = await api('chat', { text });
    plain = j.reply; html = esc(j.reply).replace(/\n/g, '<br>');
    if (j.flag === 'selfharm' && !j.checkin) {
      // crisis: the guard's fixed reply plus the contact cards, never a model answer
      BODY.crisis = `${me(esc(text))}<div class="alert" role="alert"><h4>지금 이야기를 들어 줄 곳이 있어요</h4><p>${html}</p></div>${HELP}`;
      log += bot(html); BODY.chat = log; busy = false; set('crisis'); speak(plain); return;
    }
  } catch { html = plain = '서버에 연결하지 못했어요. 잠시 뒤 다시 보내 주세요.'; }
  log += bot(html); BODY.chat = log; busy = false; render(); speak(plain);
}
window.onNativeSpeech = text => { if (ov === 'voice') set('chat'); askCoach(text); };
window.onNativeSpeechPartial = text => { const el = $('sttText'); if (el) el.textContent = text; };
window.onNativeSpeechError = msg => { if (ov === 'voice') set('chat'); log += bot(esc(msg)); BODY.chat = log; render(); };

const voice = !!N && N.voiceAvailable();
if (voice) document.documentElement.classList.add('voice');

const baseRender = render;
render = () => {
  baseRender();
  if (ov === 'crisis') $('foot').innerHTML = '<a class="pill-btn" href="tel:109">지금 109에 연락하기</a>';
  const f = document.querySelector('#foot .field');
  if (f && ov === 'chat' && tab === 'chat') {
    f.outerHTML = '<input class="field" id="q" placeholder="메시지를 입력하세요" enterkeyhint="send" maxlength="1000" aria-label="메시지">';
    const q = $('q'), go = () => { const v = q.value; q.value = ''; askCoach(v); };
    q.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
    document.querySelector('#foot .send').onclick = go;
  }
  const mic = $('mic');
  if (mic && voice) mic.onclick = () => {
    if (ov === 'voice') { N.stopListening(); set('chat'); return; }
    N.speak(''); // stop a reply that is still being read out
    const r = N.listen(); // "ok" | "permission" | "unavailable"
    if (r === 'ok') set('voice');
    else toast(r === 'permission' ? '마이크 권한을 허용한 뒤 다시 눌러 주세요' : '이 기기에서는 기기 안 음성 인식을 쓸 수 없어요');
  };
  $('msgs').scrollTop = $('msgs').scrollHeight;
  if (ov === 'none') fillPage();
};
$('msgs').addEventListener('click', e => { const b = e.target.closest('.qr button'); if (b) askCoach(b.textContent); });
if (!voice) $('ttsBtn').hidden = true;

render();
sendUnsent().then(refresh);
sendSteps();
setInterval(sendSteps, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { sendSteps(); refresh(); } });
