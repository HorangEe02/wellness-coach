// Stands in for packages/agent/src/server.ts when the mockup runs without it (opened as a file or as an artifact).
// Answers /api/* from demo-data.js, which tools/mockup/build-demo.mts makes by running the real server code on the
// demo user. Nothing is saved: a logged workout lives until the page is reloaded.
(() => {
  const D = window.DEMO;
  let strength = structuredClone(D.strengthDays[0]);
  const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const realFetch = window.fetch.bind(window);
  const list = D.questions.map(q => `"${q}"`).join(', ');

  window.fetch = async (input, opts = {}) => {
    // app.js asks for "/api/<name>"; match the string itself, since under file:// it would resolve to /C:/api/...
    const path = typeof input === 'string' ? input : '';
    if (!path.startsWith('/api/')) return realFetch(input, opts);
    const body = opts.body ? JSON.parse(opts.body) : null;
    await new Promise(r => setTimeout(r, 350)); // let the typing dots show, as with the server
    if (path === '/api/today' || path === '/api/steps' || path === '/api/walks') return json(D.today);
    if (path === '/api/strength') return json(strength);
    if (path === '/api/chat') return json(D.chat[body.text.trim()] ?? { reply: `시안에서는 미리 계산해 둔 질문만 답할 수 있어요: ${list}`, flag: null, checkin: false, intents: [] });
    if (path === '/api/workouts') {
      const work = body.items.flatMap(it => it.sets.filter(s => s.done));
      const entry = { start: body.start, name: body.name, sets: work.length, volume: Math.round(work.reduce((a, s) => a + s.kg * s.reps, 0)), prs: [] };
      const next = D.strengthDays[(strength.dayIndex + 1) % D.strengthDays.length];
      strength = { ...structuredClone(next), recent: [entry, ...strength.recent].slice(0, 5) };
      return json({ prs: [], strength });
    }
    return new Response('{"error":"not found"}', { status: 404 });
  };
  document.documentElement.classList.add('voice'); // show the mic and read-aloud buttons as designed
})();
