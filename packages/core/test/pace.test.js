// Run: node core.test.js
const assert = require('assert');
const C = require('../pace.core.js');

// ~1.11 m per 0.00001° latitude. A straight walk north at ~1.4 m/s, one fix every 10 s.
const north = (n, { t0 = 0, lat0 = 37.5, seg = 0, dt = 10000, step = 0.000126, alt = null } = {}) =>
  Array.from({ length: n }, (_, i) => ({ t: t0 + i * dt, lat: lat0 + i * step, lon: 127, acc: 5, alt: alt ? alt(i) : null, seg }));

assert.ok(Math.abs(C.haversine({ lat: 37.5, lon: 127 }, { lat: 37.501, lon: 127 }) - 111.2) < 0.5);

// Plain walk: 100 fixes × 14 m ≈ 1.39 km, ~990 s moving, one split.
let a = C.analyze(north(101));
assert.ok(Math.abs(a.distM - 1401) < 5, a.distM);
assert.strictEqual(a.movingSec, 1000);
assert.strictEqual(a.restSec, 0);
assert.strictEqual(a.splits.length, 1);
assert.ok(Math.abs(a.splits[0].sec - 714) < 3, a.splits[0].sec); // 1000 m at 1.401 m/s

// Pause: the jump between segments adds no distance and no time.
const p1 = north(11), p2 = north(11, { t0: 600000, lat0: 37.51, seg: 1 });
a = C.analyze([...p1, ...p2]);
assert.ok(Math.abs(a.distM - 280) < 3, a.distM);
assert.strictEqual(a.activeSec, 200);

// Rest: standing 5 min (jitter < 3 m), then walking on. The stop counts as rest, not moving time.
const walk1 = north(11), lastP = walk1.at(-1);
const stand = Array.from({ length: 30 }, (_, i) => ({ ...lastP, t: lastP.t + (i + 1) * 10000, lat: lastP.lat + (i % 2) * 0.00001 }));
const walk2 = north(11, { t0: stand.at(-1).t + 10000, lat0: lastP.lat + 0.000126 });
a = C.analyze([...walk1, ...stand, ...walk2]);
assert.ok(a.restSec >= 290 && a.restSec <= 320, a.restSec);
assert.ok(Math.abs(a.movingSec - 200) <= 10, a.movingSec);
assert.strictEqual(a.lastMoveT, walk2.at(-1).t);

// A single glitch fix 2 km away is dropped; the walk distance is unchanged.
const g = north(21); g.splice(10, 0, { ...g[9], t: g[9].t + 5000, lat: g[9].lat + 0.02 });
assert.ok(Math.abs(C.analyze(g).distM - C.analyze(north(21)).distM) < 2);
// Inaccurate fixes are rejected.
assert.strictEqual(C.analyze(north(5).map(p => ({ ...p, acc: 200 }))).distM, 0);

// Elevation: a steady 0.5 m climb per fix → 50 m gain; ±2 m noise on flat ground → no gain.
a = C.analyze(north(101, { alt: i => 100 + i * 0.5 }));
assert.ok(a.gainM >= 45 && a.gainM <= 50, a.gainM);
assert.strictEqual(a.maxAlt, 150);
a = C.analyze(north(101, { alt: i => 100 + (i % 2 ? 2 : -2) }));
assert.strictEqual(a.gainM, 0);

// Calories and steps.
assert.strictEqual(C.speedMet(5), 3.8);
assert.strictEqual(C.walkKcal(5000, 3600, 70), 266); // 5 km/h → 3.8 MET × 70 kg × 1 h
assert.strictEqual(C.walkKcal(100, 0, 70), 0);
assert.strictEqual(C.estSteps(1000, 170), 1417);

// Cues.
assert.deepStrictEqual(C.cueDue({ k: 0, m: 0 }, 999, 100), { due: false, next: { k: 0, m: 0, ek: 1, em: 0 } });
// Changing the interval mid-walk re-bases silently: 0.5 km → 2 km at 3.2 km neither mutes until 14 km nor fires now.
let cn = C.cueDue({ k: 6, m: 0, ek: 0.5, em: 0 }, 3200, 0, { everyKm: 2 });
assert.strictEqual(cn.due, false);
assert.strictEqual(C.cueDue(cn.next, 4000, 0, { everyKm: 2 }).due, true);
assert.strictEqual(C.cueDue({ k: 1, m: 0, ek: 2, em: 0 }, 3200, 0, { everyKm: 0.5 }).due, false);
assert.strictEqual(C.cueDue({ k: 0, m: 0 }, 1000, 100).due, true);
assert.strictEqual(C.cueDue({ k: 1, m: 0 }, 1500, 300, { everyKm: 1, everyMin: 5 }).due, true);
assert.strictEqual(C.cueDue({ k: 1, m: 1 }, 1500, 300, { everyKm: 1, everyMin: 5 }).due, false);
assert.strictEqual(C.cueDue({}, 5000, 5000, { everyKm: 0, everyMin: 0 }).due, false);

// Course: an out-and-back line. Progress follows the leg you're on.
const out = north(11, { step: 0.0009 }), crs = C.course([...out, ...out.slice(0, -1).reverse()]);
assert.ok(Math.abs(crs.totalM - 2002) < 5, crs.totalM);
const mid = { lat: out[5].lat, lon: 127.0001 };
let m = C.courseMatch(crs, mid);
assert.ok(m.offM >= 8 && m.offM <= 10, m.offM);
m = C.courseMatch(crs, mid, 1500);
assert.ok(Math.abs(m.doneM - 1501) < 5, m.doneM); // return leg, not the outbound one
assert.ok(Math.abs(m.pct - 0.75) < 0.01);
assert.strictEqual(C.courseMatch(C.course([out[0]]), out[0]).offM, 0);
// Loop course (start == end): standing at the start is 0%, not finished.
const sq = [[0, 0], [0.004, 0], [0.004, 0.005], [0, 0.005], [0, 0]].map(([a, b]) => ({ lat: 37.5 + a, lon: 127 + b }));
const loop = C.course(sq);
assert.ok(C.courseMatch(loop, { lat: 37.50001, lon: 127.00001 }).pct < 0.01);
assert.ok(C.courseMatch(loop, { lat: 37.50001, lon: 127.00001 }, null).pct < 0.01); // the app starts with prevDone = null
assert.ok(C.courseMatch(loop, { lat: 37.50001, lon: 127.00001 }, loop.totalM - 20).pct > 0.98); // arriving at the end
// Out-of-order timestamps don't add active time twice.
assert.strictEqual(C.analyze([0, 100, 50, 150].map((s, i) => ({ t: s * 1000, lat: 37.5 + i * 0.001, lon: 127, acc: 5, seg: 0 }))).activeSec, 150);

// Off-route alarm: needs `hold` ms beyond the limit; comes back only within half the limit.
let s = { off: false, since: null }, ev;
({ st: s, event: ev } = C.routeAlert(s, 60, 0)); assert.strictEqual(ev, null);
({ st: s, event: ev } = C.routeAlert(s, 60, 20000)); assert.strictEqual(ev, null);
({ st: s, event: ev } = C.routeAlert(s, 60, 30000)); assert.strictEqual(ev, 'off');
({ st: s, event: ev } = C.routeAlert(s, 30, 31000)); assert.strictEqual(ev, null); // still off: 30 > 20
({ st: s, event: ev } = C.routeAlert(s, 10, 32000)); assert.strictEqual(ev, 'back');
({ st: s, event: ev } = C.routeAlert(s, 60, 33000)); ({ st: s, event: ev } = C.routeAlert(s, 10, 40000));
assert.strictEqual(ev, null); assert.strictEqual(s.since, null); // brief excursion resets

// GPX round trip keeps segments, elevation and time; names are escaped.
const pts = [...north(3, { alt: () => 12.5 }), ...north(2, { t0: 99000, seg: 1 })].map(p => ({ ...p, t: p.t + Date.UTC(2026, 10, 9) }));
const gpx = C.toGPX('산책 <A&B>', pts);
assert.ok(gpx.includes('산책 &lt;A&amp;B&gt;'));
assert.strictEqual((gpx.match(/<trkseg>/g) || []).length, 2);
const back = C.parseGPX(gpx);
assert.strictEqual(back.name, '산책 <A&B>');
assert.strictEqual(back.points.length, 5);
assert.strictEqual(back.points[0].alt, 12.5);
assert.strictEqual(back.points[0].t, pts[0].t);
// Route points, self-closing tags, bad coordinates, CDATA names.
const rte = C.parseGPX(`<gpx><rte><name><![CDATA[둘레길]]></name><rtept lat="37.1" lon="127.1"/><rtept lat='37.2' lon='127.2'></rtept><rtept lat="999" lon="1"/></rte></gpx>`);
assert.strictEqual(rte.name, '둘레길');
assert.deepStrictEqual(rte.points.map(p => [p.lat, p.lon, p.kind]), [[37.1, 127.1, 'rte'], [37.2, 127.2, 'rte']]);
assert.strictEqual(C.parseGPX('<gpx></gpx>').points.length, 0);
assert.strictEqual(C.parseGPX(null), null);
assert.strictEqual(C.parseGPX(gpx, 2).points.length, 2);
// Malformed input stays fast: unclosed tags, tags without '>', and a closing tag only at the very end.
for (const bad of ['<trkpt lat="1" lon="1">'.repeat(200000), '<trkpt lat="1"'.repeat(200000), '<trkpt lat="1" lon="1"><ele>1</ele>'.repeat(100000) + '</trkpt>']) {
  const t0 = Date.now(), res = C.parseGPX(bad);
  assert.ok(Date.now() - t0 < 1500, `slow GPX parse: ${Date.now() - t0} ms`);
  assert.ok(res.points.length <= 50000);
}
// An unclosed point doesn't swallow the next point's elevation.
assert.deepStrictEqual(C.parseGPX('<trkpt lat="1" lon="1"><trkpt lat="2" lon="2"><ele>9</ele></trkpt>').points.map(p => p.alt), [null, 9]);

// Tiles: 산길샘's saved pack for 우이동 sat at z17 x≈3493·32, y≈1584·32 (its file names), so the same spot must land there.
assert.strictEqual(C.tileX(127.0121, 17) >> 5, 3493);
assert.strictEqual(C.tileY(37.655, 17) >> 5, 1584);
assert.deepStrictEqual([C.tileX(-180, 0), C.tileY(85, 0), C.tileX(179.99, 1), C.tileY(-85, 1)], [0, 0, 1, 1]);
const bb = C.bboxOf([{ lat: 37.6476, lon: 127.0118 }, { lat: 37.6625, lon: 127.0124 }], 300);
assert.ok(Math.abs((bb.n - bb.s) * 110574 - (0.0149 * 110574 + 600)) < 1);
assert.strictEqual(C.bboxOf([]), null);
const tl = C.tilesIn(bb, 12, 16);
assert.ok(tl.every(t => t.z >= 12 && t.z <= 16));
assert.strictEqual(new Set(tl.map(t => `${t.z}/${t.x}/${t.y}`)).size, tl.length);
assert.ok(tl.length > 10 && tl.length < 200, tl.length); // ~2.3 × 0.6 km box
assert.strictEqual(C.tilesIn({ s: -90, w: -180, n: 90, e: 180 }, 0, 1).length, 5); // world: 1 + 4, clamped at the poles

// Simplify: a straight line collapses to its ends; a sharp corner survives; tiny wiggles under tolerance go.
const line = Array.from({ length: 50 }, (_, i) => ({ lat: 37.5 + i * 0.0001, lon: 127 }));
assert.strictEqual(C.simplify(line, 5).length, 2);
const corner = [...line, ...Array.from({ length: 50 }, (_, i) => ({ lat: 37.5049, lon: 127 + (i + 1) * 0.0001 }))];
const sc = C.simplify(corner, 5);
assert.strictEqual(sc.length, 3); assert.deepStrictEqual(sc[1], corner[49]);
const wig = line.map((p, i) => ({ ...p, lon: 127 + (i % 2 ? 0.00002 : 0) })); // ±1.8 m
assert.strictEqual(C.simplify(wig, 5).length, 2);
assert.strictEqual(C.simplify(wig, 1).length > 10, true);
assert.deepStrictEqual(C.simplify(line.slice(0, 2), 5), line.slice(0, 2));
const big = Array.from({ length: 200000 }, (_, i) => ({ lat: 37 + i * 1e-5, lon: 127 + Math.sin(i / 50) * 0.001 }));
assert.ok(C.simplify(big, 5).length < big.length); // no stack overflow on long tracks
assert.ok(Math.abs(C.nearestDist({ lat: 37.5, lon: 127.001 }, line) - 88.4) < 1);
assert.strictEqual(C.nearestDist({ lat: 0, lon: 0 }, []), Infinity);

// Packing round trip.
const st = 1_700_000_000_000, raw = [{ t: st + 1234, lat: 37.1234567, lon: 127.7654321, alt: null, acc: 4.6, seg: 2 }];
assert.deepStrictEqual(C.unpack(st, C.pack(st, raw)), [{ t: st + 1200, lat: 37.123457, lon: 127.765432, alt: null, acc: 5, seg: 2 }]);

// Weeks start on Monday (local time).
const wed = new Date(2026, 10, 11, 12).getTime(); // Wed 11 Nov 2026
assert.strictEqual(C.ymd(new Date(C.weekStart(wed))), '2026-11-09');
const ws = C.weekStats([{ start: new Date(2026, 10, 9, 7).getTime(), distM: 3000, activeSec: 1800 },
  { start: new Date(2026, 10, 8, 23).getTime(), distM: 1000, activeSec: 600 }, { start: new Date(2026, 10, 1).getTime(), distM: 9, activeSec: 9 }], wed);
assert.deepStrictEqual(ws.thisWeek, { n: 1, distM: 3000, sec: 1800 });
assert.deepStrictEqual(ws.lastWeek, { n: 1, distM: 1000, sec: 600 });

console.log('core ok');
