// Pure walking logic. Loaded as a classic script in the browser, and via require() in core.test.js.
// Point shape everywhere: { t: ms, lat, lon, acc: m|null, alt: m|null, seg: int } — seg changes after each pause.
(function (root) {
  const { rad, haversine, speedMet, ymd, weekStart } = typeof module !== 'undefined' ? require('./shared.js') : root.Shared; // merged copies, see shared.js


  // Whole-walk numbers from GPS points.
  // - Drops fixes worse than maxAcc, jitter under 3 m, and stretches faster than maxSpeed (a vehicle or a glitch).
  // - A gap over stopGap at under 0.5 m/s is a rest: its time goes to restSec, not movingSec.
  // - No distance is counted across a pause (segment change).
  // - Elevation gain/loss uses an eleStep hysteresis so GPS altitude noise doesn't add up.
  function analyze(points, { maxAcc = 50, maxSpeed = 7, stopGap = 60000, eleStep = 5 } = {}) {
    const pts = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.t) && (p.acc == null || p.acc <= maxAcc));
    const fast = (a, b) => { const dt = (b.t - a.t) / 1000; return dt > 0 && haversine(a, b) / dt > maxSpeed; };
    let dist = 0, moving = 0, clock = 0, dropped = 0, gain = 0, loss = 0, ref = null, maxAlt = null, minAlt = null;
    let last = null, suspect = null, splitAt = 0, lastMoveT = pts[0]?.t ?? null;
    const splits = [], profile = [];
    const ele = p => {
      if (!Number.isFinite(p.alt)) return;
      maxAlt = maxAlt == null ? p.alt : Math.max(maxAlt, p.alt); minAlt = minAlt == null ? p.alt : Math.min(minAlt, p.alt);
      if (ref == null) ref = p.alt;
      else if (p.alt >= ref + eleStep) { gain += p.alt - ref; ref = p.alt; }
      else if (p.alt <= ref - eleStep) { loss += ref - p.alt; ref = p.alt; }
      profile.push({ d: Math.round(dist), alt: p.alt });
    };
    for (const p of pts) {
      if (!last || p.seg !== last.seg) { last = p; suspect = null; ele(p); continue; }
      if (p.t <= last.t) continue;
      // A too-fast fix is held as `suspect`: if the next fix continues from `last` it was a glitch and is dropped;
      // if it continues from the suspect, the person really moved (e.g. by car) and that stretch is skipped.
      if (fast(last, p)) {
        if (suspect && !fast(suspect, p)) { last = suspect; suspect = null; if (p.t <= last.t) continue; }
        else { dropped++; suspect = p; continue; }
      } else suspect = null;
      const dt = (p.t - last.t) / 1000, d = haversine(last, p);
      if (d < 3) continue; // standing still: wait for real movement
      clock += dt;
      if (dt * 1000 > stopGap && d / dt < 0.5) { last = p; ele(p); continue; } // a rest
      const before = dist; dist += d; moving += dt;
      // Each km crossed inside this step gets an interpolated split time (walking clock, rests included).
      for (let k = Math.floor(before / 1000) + 1; k * 1000 <= dist; k++) {
        const at = clock - dt + dt * (k * 1000 - before) / d;
        splits.push({ km: k, sec: Math.round(at - splitAt) }); splitAt = at;
      }
      lastMoveT = p.t; last = p; ele(p);
    }
    // Active time = time inside segments (pauses excluded); rest = active time not spent moving.
    // Only time moving past the segment's latest timestamp counts, so out-of-order fixes can't add time twice.
    let active = 0, maxT = null, seg = null;
    for (const p of points) {
      if (!Number.isFinite(p.t)) continue;
      if (p.seg !== seg) { seg = p.seg; maxT = p.t; continue; }
      if (p.t > maxT) { active += (p.t - maxT) / 1000; maxT = p.t; }
    }
    return { distM: Math.round(dist), movingSec: Math.round(moving), activeSec: Math.round(active), restSec: Math.max(0, Math.round(active - moving)),
      gainM: Math.round(gain), lossM: Math.round(loss), maxAlt: maxAlt == null ? null : Math.round(maxAlt), minAlt: minAlt == null ? null : Math.round(minAlt),
      splits, profile, lastMoveT, dropped, rejected: points.length - pts.length };
  }

  // MET by speed (km/h), from the Compendium of Physical Activities ranges.
  const walkKcal = (distM, movingSec, kg) => movingSec > 0 ? Math.round(speedMet(distM / 1000 / (movingSec / 3600)) * kg * movingSec / 3600) : 0;
  // Step length ≈ 41.5% of height walking, 65% running (common rule of thumb).
  const estSteps = (distM, heightCm, run = false) => Math.round(distM / ((heightCm || 165) / 100 * (run ? 0.65 : 0.415)));

  // Spoken cues: due when a new everyKm distance mark or everyMin time mark is passed since `last`.
  // If an interval was changed mid-walk, that mark is re-based silently instead of muting or double-firing.
  function cueDue(last, distM, sec, { everyKm = 1, everyMin = 0 } = {}) {
    const k = everyKm > 0 ? Math.floor(distM / (everyKm * 1000)) : 0, m = everyMin > 0 ? Math.floor(sec / (everyMin * 60)) : 0;
    const same = (prev, cur) => prev === undefined || prev === cur;
    const due = (same(last.ek, everyKm) && k > (last.k || 0)) || (same(last.em, everyMin) && m > (last.m || 0));
    return { due, next: { k, m, ek: everyKm, em: everyMin } };
  }

  // ---------- course following ----------
  function course(points) {
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
    return { pts: points, cum, totalM: Math.round(cum.at(-1) || 0) };
  }
  // Nearest spot on the course line. Spots far along the course from the last match (the start, before any match)
  // are penalised, so a loop or out-and-back course doesn't snap to its end/return leg.
  // shortcut: full scan O(n) per fix, fine up to a few thousand course points; window the search if courses get huge.
  function courseMatch(c, pos, prevDone = 0) {
    const kx = Math.cos(rad(pos.lat)) * 111320, ky = 110574;
    let best = null;
    for (let i = 0; i < c.pts.length - 1; i++) {
      const a = c.pts[i], b = c.pts[i + 1];
      const ax = (a.lon - pos.lon) * kx, ay = (a.lat - pos.lat) * ky, vx = (b.lon - a.lon) * kx, vy = (b.lat - a.lat) * ky, L2 = vx * vx + vy * vy;
      const u = L2 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / L2)) : 0;
      const off = Math.hypot(ax + u * vx, ay + u * vy), done = c.cum[i] + u * (c.cum[i + 1] - c.cum[i]);
      const score = off + 0.02 * Math.abs(done - (prevDone ?? 0));
      if (!best || score < best.score) best = { score, off, done };
    }
    if (!best) return { offM: c.pts[0] ? Math.round(haversine(c.pts[0], pos)) : 0, doneM: 0, leftM: c.totalM, pct: 0 };
    return { offM: Math.round(best.off), doneM: Math.round(best.done), leftM: Math.round(c.totalM - best.done), pct: c.totalM ? best.done / c.totalM : 0 };
  }
  // Off-route alarm with hysteresis: 'off' once beyond limit for hold ms, 'back' once within limit/2 again.
  function routeAlert(st, offM, t, { limit = 40, hold = 30000 } = {}) {
    if (!st.off) {
      if (offM <= limit) return { st: { off: false, since: null }, event: null };
      const since = st.since ?? t;
      return t - since >= hold ? { st: { off: true, since }, event: 'off' } : { st: { off: false, since }, event: null };
    }
    return offM <= limit / 2 ? { st: { off: false, since: null }, event: 'back' } : { st, event: null };
  }

  // Douglas–Peucker: drop points that stay within tolM of the simplified line (keeps the shape, shrinks the file).
  function simplify(points, tolM = 5) {
    if (points.length < 3) return points.slice();
    const lat0 = points[0].lat, kx = Math.cos(rad(lat0)) * 111320, ky = 110574;
    const xy = points.map(p => [p.lon * kx, p.lat * ky]), keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) { // iterative, so long courses can't overflow the call stack
      const [a, b] = stack.pop(), [ax, ay] = xy[a], [bx, by] = xy[b], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
      let worst = -1, wd = tolM;
      for (let i = a + 1; i < b; i++) {
        const [px, py] = xy[i], u = L2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2)) : 0;
        const d = Math.hypot(px - ax - u * vx, py - ay - u * vy);
        if (d > wd) { wd = d; worst = i; }
      }
      if (worst > 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
    }
    return points.filter((_, i) => keep[i]);
  }
  // Metres from pos to the closest point of a course (points, not segments: courses are dense enough for ranking).
  const nearestDist = (pos, points) => points.reduce((m, p) => Math.min(m, haversine(pos, p)), Infinity);

  // ---------- offline map tiles (slippy-map numbering) ----------
  const tileX = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
  const tileY = (lat, z) => { const r = rad(Math.max(-85.0511, Math.min(85.0511, lat))); return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
  // Bounding box {s, w, n, e} of points, grown by padM metres on every side.
  function bboxOf(points, padM = 0) {
    if (!points.length) return null;
    const lats = points.map(p => p.lat), lons = points.map(p => p.lon), dLat = padM / 110574;
    const s = Math.min(...lats) - dLat, n = Math.max(...lats) + dLat, dLon = padM / (111320 * Math.cos(rad((s + n) / 2)));
    return { s, w: Math.min(...lons) - dLon, n, e: Math.max(...lons) + dLon };
  }
  // Every tile {z, x, y} covering the box from zmin to zmax.
  function tilesIn(b, zmin, zmax) {
    const out = [];
    for (let z = zmin; z <= zmax; z++) {
      const max = 2 ** z - 1, cl = v => Math.max(0, Math.min(max, v));
      for (let x = cl(tileX(b.w, z)); x <= cl(tileX(b.e, z)); x++) for (let y = cl(tileY(b.n, z)); y <= cl(tileY(b.s, z)); y++) out.push({ z, x, y });
    }
    return out;
  }

  // ---------- GPX ----------
  const xmlEsc = s => String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
  const xmlUnesc = s => s.replace(/&(lt|gt|amp|quot|apos);/g, (_, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[e]);
  function toGPX(name, points) {
    const segs = [];
    for (const p of points) { if (!segs.length || segs.at(-1)[0].seg !== p.seg) segs.push([]); segs.at(-1).push(p); }
    const pt = p => `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${Number.isFinite(p.alt) ? `<ele>${p.alt.toFixed(1)}</ele>` : ''}${Number.isFinite(p.t) ? `<time>${new Date(p.t).toISOString()}</time>` : ''}</trkpt>`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Pace-Coach" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>${xmlEsc(name)}</name>\n`
      + segs.map(s => `<trkseg>\n${s.map(pt).join('\n')}\n</trkseg>`).join('\n') + '\n</trk>\n</gpx>\n';
  }
  // Track points, else route points, from an untrusted GPX file. Invalid coordinates are skipped; at most `max` points.
  // Linear time even on malformed files: attributes are length-capped and a point's body ends at its closing tag
  // or the next opening tag, whichever comes first (the closing-tag search is cached, not repeated per point).
  function parseGPX(text, max = 50000) {
    if (typeof text !== 'string') return null;
    const grab = (tag, kind) => {
      const out = [], open = new RegExp(`<${tag}\\b([^>]{0,500}?)(/?)>`, 'g'), close = `</${tag}>`;
      let m, end = -2;
      while ((m = open.exec(text)) && out.length < max) {
        let body = '';
        if (!m[2]) {
          if (end !== -1 && end < open.lastIndex) end = text.indexOf(close, open.lastIndex);
          const next = text.indexOf(`<${tag}`, open.lastIndex), stop = end < 0 ? -1 : next >= 0 && next < end ? next : end;
          if (stop >= 0) body = text.slice(open.lastIndex, stop);
        }
        const lat = +(/\blat\s*=\s*["']([^"']+)["']/.exec(m[1]) || [])[1], lon = +(/\blon\s*=\s*["']([^"']+)["']/.exec(m[1]) || [])[1];
        if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) continue;
        const alt = +(/<ele>\s*([^<]+)<\/ele>/.exec(body) || [])[1], t = Date.parse((/<time>\s*([^<]+)<\/time>/.exec(body) || [])[1]);
        out.push({ lat, lon, alt: Number.isFinite(alt) ? alt : null, t: Number.isFinite(t) ? t : null, kind });
      }
      return out;
    };
    let pts = grab('trkpt', 'trk');
    if (!pts.length) pts = grab('rtept', 'rte');
    const nm = /<name>\s*(?:<!\[CDATA\[)?([^<\]]*)/.exec(text);
    return { name: nm ? xmlUnesc(nm[1]).trim().slice(0, 60) : '', points: pts };
  }

  // ---------- storage packing ----------
  // [seconds since start (0.1 s), lat, lon, alt|null, acc|null, seg] keeps a 2-hour walk around 200 KB.
  const r = (x, n) => x == null || !Number.isFinite(x) ? null : +x.toFixed(n);
  const pack = (start, pts) => pts.map(p => [r((p.t - start) / 1000, 1), r(p.lat, 6), r(p.lon, 6), r(p.alt, 1), r(p.acc, 0), p.seg]);
  const unpack = (start, rows) => rows.map(([s, lat, lon, alt, acc, seg]) => ({ t: start + s * 1000, lat, lon, alt, acc, seg }));

  // ---------- dates and summaries ----------
  // walks: [{ start, distM, activeSec }] → this week vs last week.
  function weekStats(walks, now = Date.now()) {
    const w0 = weekStart(now), w1 = weekStart(w0 - 1), sum = (a, b) => walks.filter(w => w.start >= a && w.start < b)
      .reduce((s, w) => ({ n: s.n + 1, distM: s.distM + (w.distM || 0), sec: s.sec + (w.activeSec || 0) }), { n: 0, distM: 0, sec: 0 });
    return { thisWeek: sum(w0, Infinity), lastWeek: sum(w1, w0) };
  }

  const api = { haversine, analyze, speedMet, walkKcal, estSteps, cueDue, course, courseMatch, routeAlert, simplify, nearestDist, tileX, tileY, bboxOf, tilesIn, toGPX, parseGPX, pack, unpack, ymd, weekStart, weekStats };
  if (typeof module !== 'undefined') module.exports = api; else root.Core = api;
})(this);
