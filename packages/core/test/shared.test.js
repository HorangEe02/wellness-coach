// Run: node test/shared.test.js
const assert = require('assert');
const S = require('../shared.js');

// haversine: 0.001° of latitude ≈ 111.2 m.
assert.ok(Math.abs(S.haversine({ lat: 37.5, lon: 127 }, { lat: 37.501, lon: 127 }) - 111.19) < 0.05);
assert.strictEqual(S.haversine({ lat: 37.5, lon: 127 }, { lat: 37.5, lon: 127 }), 0);

assert.strictEqual(S.speedMet(3), 2.5);
assert.strictEqual(S.speedMet(5), 3.8);
assert.strictEqual(S.speedMet(12), 10.5);
assert.strictEqual(S.workoutKcal(3.5, 70, 60), 257); // 3.5×3.5×70/200×60

// ymd must match diet-coach's original (timezone-offset + toISOString) for Date, ms and 'YYYY-MM-DD' inputs.
const dietYmd = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
for (const x of [new Date(2026, 10, 17, 0, 0), new Date(2026, 10, 17, 23, 59), new Date(2026, 0, 1).getTime(), '2026-11-17', '2026-11-17T00:00:00'])
  assert.strictEqual(S.ymd(x), dietYmd(x), String(x));

const wed = new Date(2026, 10, 11, 12).getTime(); // Wed 11 Nov 2026
assert.strictEqual(S.ymd(S.weekStart(wed)), '2026-11-09');
assert.strictEqual(S.weekStart(new Date(2026, 10, 9).getTime()), new Date(2026, 10, 9).getTime()); // Monday stays

console.log('shared ok');
