// Run: node core.test.js
const assert = require('assert');
const C = require('../diet.core.js');

const p = { sex: 'm', age: 30, height: 175, weight: 80, target: 70, activity: 1.375 };
assert.strictEqual(C.bmr(p), 1749); // 800 + 1093.75 - 150 + 5
assert.strictEqual(C.tdee(p), 2405);
assert.strictEqual(C.goalKcal(p), 1905);
assert.strictEqual(C.goalKcal({ ...p, target: 80 }), 2405);
assert.strictEqual(C.goalKcal({ ...p, activity: 1.2, target: 60 }), 1749); // floored at BMR
assert.deepStrictEqual(C.macroTargets(2000), { carb: 250, protein: 100, fat: 67 });
assert.strictEqual(C.workoutKcal(9.8, 70, 30), 360);

const day = { meals: { lunch: [{ kcal: 315, carb: 69, protein: 6, fat: 0.6, qty: 2 }], snack: [{ kcal: 105, carb: 27, protein: 1.3, fat: 0.4 }] }, workouts: [{ kcal: 200 }] };
assert.deepStrictEqual(C.dayTotals(day), { kcal: 735, carb: 165, protein: 13.3, fat: 1.6, sugar: 0, sodium: 0, satFat: 0, burned: 200 });
assert.deepStrictEqual(C.dayTotals({}), { kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0, sodium: 0, satFat: 0, burned: 0 });

assert.strictEqual(C.glucoseStatus(65, 'after').level, 'low');
assert.strictEqual(C.glucoseStatus(110, 'fasting').level, 'warn');
assert.strictEqual(C.glucoseStatus(130, 'after').level, 'ok');
assert.strictEqual(C.glucoseStatus(210, 'after').level, 'high');

assert.strictEqual(C.addDays('2026-02-28', 1), '2026-03-01');
assert.strictEqual(C.bmi(70, 175), 22.9);
assert.ok(C.searchFoods('밥').length >= 3);
assert.strictEqual(C.weekStart('2026-11-01'), '2026-10-26'); // Sunday -> Monday
assert.strictEqual(C.weekStart('2026-10-26'), '2026-10-26');
assert.strictEqual(C.timeInRange([{ v: 60 }, { v: 100 }, { v: 180 }, { v: 200 }]), 50);

// CSV parser: quotes, escaped quotes, CRLF
assert.deepStrictEqual(C.parseCSV('a,"b,c","d""e"\r\n1,2,3'), [['a', 'b,c', 'd"e'], ['1', '2', '3']]);
assert.strictEqual(C.parseTime('10-30-2026 08:05'), new Date(2026, 9, 30, 8, 5).getTime());
assert.strictEqual(C.parseTime('2026-10-30T08:05:10'), new Date(2026, 9, 30, 8, 5, 10).getTime());

// LibreView export: title row, then header; historic + scan columns
const libre = 'Glucose Data,Generated on,10-31-2026 10:00 UTC\nDevice,Serial Number,Device Timestamp,Record Type,Historic Glucose mg/dL,Scan Glucose mg/dL\n' +
  'FreeStyle,ABC,10-30-2026 08:00,0,95,\nFreeStyle,ABC,10-30-2026 08:15,1,,190\nFreeStyle,ABC,10-30-2026 08:30,6,,\n';
let r = C.importCSV(libre);
assert.deepStrictEqual(r.glucose.map(g => g.v), [95, 190]);
assert.strictEqual(C.ymd(r.glucose[0].t), '2026-10-30');

// Dexcom Clarity: mmol/L, "Low" text, rate column must be ignored
const dex = 'Index,Timestamp (YYYY-MM-DDThh:mm:ss),Event Type,Glucose Value (mmol/L),Glucose Rate of Change (mmol/L/min)\n' +
  '1,,FirstName,,\n2,2026-10-30T09:00:00,EGV,5.5,0.1\n3,2026-10-30T09:05:00,EGV,Low,0.2\n';
assert.deepStrictEqual(C.importCSV(dex).glucose.map(g => g.v), [99]);

// Samsung Health: type line, then header; multiple rows per day -> max
const sam = 'com.samsung.health.step_daily_trend,6305005,3\ncreate_time,count,day_time\n' +
  '2026-10-30 23:00:00.000,5000,' + new Date(2026, 9, 30).getTime() + '\n2026-10-30 23:00:00.000,7200,' + new Date(2026, 9, 30).getTime() + '\n';
assert.deepStrictEqual(C.importCSV(sam).steps, { '2026-10-30': 7200 });
const samW = 'com.samsung.health.weight,6305005,3\ncom.samsung.health.weight.start_time,com.samsung.health.weight.weight\n2026-10-29 07:30:00.000,71.26\n';
assert.deepStrictEqual(C.importCSV(samW).weight, { '2026-10-29': 71.3 });
assert.deepStrictEqual(C.importCSV('no,data\n1,2'), { glucose: [], steps: {}, weight: {} });

// Apple Health export.xml
const apple = `<HealthData>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-30 08:00:00 +0900" value="3000"/>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-30 12:00:00 +0900" value="2000"/>
<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-10-30 12:00:00 +0900" value="4000"/>
<Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="lb" startDate="2026-10-30 07:00:00 +0900" value="154"/>
<Record type="HKQuantityTypeIdentifierBloodGlucose" sourceName="Meter" unit="mg/dL" startDate="2026-10-30 07:10:00 +0900" value="102"/>
</HealthData>`;
r = C.importAppleXML(apple);
const d30 = C.ymd(Date.parse('2026-10-30T08:00:00+09:00'));
assert.strictEqual(r.steps[d30], 5000);
assert.strictEqual(r.weight[C.ymd(Date.parse('2026-10-30T07:00:00+09:00'))], 69.9);
assert.deepStrictEqual(r.glucose.map(g => g.v), [102]);

// Checkup judgement
const J = Object.fromEntries(C.CHECKUP.map(c => [c.key, c.judge]));
assert.strictEqual(J.glucose(99), 'ok');
assert.strictEqual(J.glucose(110), 'warn');
assert.strictEqual(J.glucose(130), 'high');
assert.strictEqual(J.waist(88, 'm'), 'ok');
assert.strictEqual(J.waist(88, 'f'), 'high');
assert.strictEqual(J.hdl(35), 'low');
assert.strictEqual(J.hb(12.5, 'm'), 'low');
assert.strictEqual(J.egfr(50), 'warn');
assert.ok(C.shopLinks('비타민D').naver.endsWith(encodeURIComponent('비타민D')));
// ---------- diet targets & score ----------
assert.deepStrictEqual(C.macroTargets(2000, [40, 30, 30]), { carb: 200, protein: 150, fat: 67 });
const tg = C.nutrientTargets(2110, [50, 20, 30]);
assert.deepStrictEqual(tg.range.carb, [211, 277]); // matches observed 211–277 for 2,110kcal
assert.strictEqual(tg.limit.satFat, 16.4);
const p2 = { ...p, target: 80, weekendBoost: true };
assert.strictEqual(C.goalKcalOn(p2, '2026-10-31'), Math.round(2405 * 1.15)); // Saturday
assert.strictEqual(C.goalKcalOn(p2, '2026-10-27'), Math.round(2405 * (7 - 2.3) / 5)); // Tuesday
assert.strictEqual(C.goalKcal({ ...p, kcalOverride: 1500 }), 1500);
const rice = C.FOODS.find(f => f.name === '흰쌀밥');
const riceOnly = C.sumFoods([{ ...rice, qty: 1 }]);
const sc = C.dietScore(riceOnly, tg, [50, 20, 30]);
assert.ok(sc > 0 && sc < 60, 'rice-only day scores low: ' + sc);
assert.strictEqual(C.scoreMessage(riceOnly, tg, sc), '아직 칼로리에 여유가 있어요');
const balanced = { kcal: 2110, carb: 264, protein: 105, fat: 70, sugar: 20, sodium: 1500, satFat: 10 };
assert.ok(C.dietScore(balanced, tg, [50, 20, 30]) >= 95);
assert.strictEqual(C.dietScore({ kcal: 0 }, tg, [50, 20, 30]), 0);
assert.ok(C.mealFeedback(riceOnly, tg, 0.25).some(t => t.label === '단백질 적은 편'));
assert.ok(C.mealFeedback(riceOnly, tg, 0.25).some(t => t.label === '나트륨 적은 편'));
assert.strictEqual(C.rangeStatus(73, tg.range.carb), 'low');
assert.deepStrictEqual(C.topFood([{ name: 'a', protein: 5, qty: 1 }, { name: 'b', protein: 3, qty: 2 }], 'protein'), { name: 'b', v: 6 });

// ---------- workouts ----------
const squat = { kind: 'weight', met: 5.5, sets: [{ kg: 60, reps: 10 }, { kg: 60, reps: 8 }] };
assert.strictEqual(C.exVolume(squat), 1080);
assert.strictEqual(C.exMinutes(squat), 4);
assert.strictEqual(C.sessionKcal([{ kind: 'time', met: 3.5, sets: [{ min: 30 }] }], 70), 129); // matches observed 30min walk = 129kcal
assert.strictEqual(C.sessionKcal([{ kind: 'time', met: 3.5, sets: [{ min: 30 }] }], 70, 'hard'), 161);

// ---------- weight trend / sleep / fasting ----------
assert.deepStrictEqual(C.weightTrend([{ date: 'a', kg: 70 }, { date: 'b', kg: 72 }]).map(x => x.kg), [70, 70.5]);
assert.strictEqual(C.clockDiff('23:00', '07:00'), 480);
assert.strictEqual(C.sleepHours({ bed: '23:30', wake: '07:00' }), 7.5);
assert.strictEqual(C.sleepScore({ bed: '23:00', wake: '07:00', quality: 5 }, { bed: '23:00' }), 100);
assert.ok(C.sleepScore({ bed: '03:00', wake: '07:00', quality: 1 }, { bed: '23:00' }) < 40);
assert.strictEqual(C.fastStage(13)[1], '지방 사용 증가');
const now = new Date(2026, 9, 31, 9, 0).getTime(); // Sat 09:00
const w = C.nextFastWindow({ days: [0, 1, 2, 3, 4, 5, 6], start: '20:00', hours: 16 }, now);
assert.strictEqual(w.start, new Date(2026, 9, 30, 20, 0).getTime()); // Friday-night window still running
assert.ok(C.routinesOverlap({ days: [1], start: '20:00', hours: 16 }, { days: [2], start: '10:00', hours: 4 })); // Mon 20:00→Tue 12:00 vs Tue 10:00
assert.ok(!C.routinesOverlap({ days: [1], start: '20:00', hours: 12 }, { days: [3], start: '20:00', hours: 12 }));
assert.ok(C.routinesOverlap({ days: [0], start: '20:00', hours: 16 }, { days: [1], start: '08:00', hours: 2 })); // Sun night wraps into Mon

// ---------- period ----------
const ps = C.periodStats([{ start: '2026-08-01', end: '2026-08-05' }, { start: '2026-08-31', end: '2026-09-04' }, { start: '2026-09-30', end: '2026-10-04' }], '2026-10-10');
assert.deepStrictEqual([ps.cycle, ps.len, ps.next, ps.cycleDay, ps.dDay], [30, 5, '2026-10-30', 11, 20]);
assert.strictEqual(C.periodStats([], '2026-10-10'), null);

// ---------- GLP-1 ----------
const t0 = 0, wk = 7 * 864e5;
assert.strictEqual(C.glpLevel([{ t: t0, mg: 2.4 }], 'wegovy', t0 + wk), 1.2); // one half-life later
assert.strictEqual(C.nextDose([{ t: t0, mg: 2.4 }], 'wegovy'), wk);
assert.strictEqual(C.nextSite([{ t: 1, site: '복부 왼쪽' }]), '복부 오른쪽');

// ---------- supplements ----------
// magnesium: male RDA 360 > supplement UL 350 → 350 is enough, 351 is too much
const mg = v => C.suppAnalysis([{ nutrients: { magnesium: v } }], 'm').rows[0].status;
assert.deepStrictEqual([mg(300), mg(350), mg(351)], ['low', 'ok', 'high']);
const an = C.suppAnalysis([{ nutrients: { vitD: 25, magnesium: 250 } }, { nutrients: { vitD: 10, magnesium: 150, iron: 5 } }], 'f');
const byKey = Object.fromEntries(an.rows.map(r => [r.key, r]));
assert.strictEqual(byKey.vitD.status, 'ok'); assert.ok(byKey.vitD.dup);
assert.strictEqual(byKey.magnesium.status, 'high'); // 400 > UL 350
assert.strictEqual(byKey.iron.status, 'low'); // 5 < 14 (female)
assert.strictEqual(C.suppClock('MORNING_BEFORE_MEAL', { breakfast: '08:00' }, '23:00'), '07:30');
assert.strictEqual(C.suppClock('BEDTIME', {}, '00:10'), '23:40');

// ---------- glucose ----------
const tm = 1e9, cgm = [{ t: tm, v: 95 }, { t: tm + 45 * 6e4, v: 160 }, { t: tm + 90 * 6e4, v: 120 }];
assert.deepStrictEqual(C.mealSpike(cgm, tm), { base: 95, peak: 160, rise: 65, peakMin: 45 });
assert.strictEqual(C.mealSpike(cgm, tm + 10 * 36e5), null);

// ---------- streak & missions ----------
const days = { '2026-10-29': { water: 100 }, '2026-10-30': { weight: 70 } };
assert.strictEqual(C.streak(days, '2026-10-31'), 2); // today empty but streak alive
assert.strictEqual(C.streak(days, '2026-10-30'), 2);
assert.strictEqual(C.streak({ '2026-10-28': { water: 1 }, '2026-10-30': { water: 1 } }, '2026-10-30', ['2026-10-29']), 3);
const dm = C.dailyMissions('2026-10-31', false);
assert.strictEqual(dm.length, 5); assert.ok(!dm.some(m => m.id === 'supp'));
assert.deepStrictEqual(C.dailyMissions('2026-10-31', false), dm); // deterministic
assert.strictEqual(C.level(250), 3);
assert.ok(C.MISSIONS.find(m => m.id === 'class').check({ classes: 1 }));

// ---------- streak revive / milestones / monthly ----------
const rv = { '2026-10-27': { water: 1 }, '2026-10-28': { water: 1 } };
assert.deepStrictEqual(C.reviveGap(rv, '2026-11-01'), null); // 3 missed days > 2
assert.deepStrictEqual(C.reviveGap(rv, '2026-10-31'), { missed: ['2026-10-30', '2026-10-29'], before: 2 });
assert.deepStrictEqual(C.reviveGap(rv, '2026-10-30'), { missed: ['2026-10-29'], before: 2 });
assert.strictEqual(C.reviveGap(rv, '2026-10-29'), null); // yesterday recorded: streak alive
assert.strictEqual(C.reviveGap({}, '2026-10-29'), null); // nothing to revive
assert.strictEqual(C.reviveGap(rv, '2026-10-31', ['2026-10-30']), null); // yesterday shielded: not a fresh break
assert.deepStrictEqual(C.reviveGap(rv, '2026-10-30', [], 1), { missed: ['2026-10-29'], before: 2 });
assert.strictEqual(C.reviveGap(rv, '2026-10-31', [], 1), null); // over the limit
assert.strictEqual(C.streak(rv, '2026-10-31', ['2026-10-30', '2026-10-29']), 4); // after reviving
assert.ok(C.STREAK_MILESTONES.every(([d, p], i, a) => d > 0 && p > 0 && (!i || d > a[i - 1][0])));
const ms = C.monthStats({ '2026-10-01': { weight: 70, workouts: [{}, {}] }, '2026-10-02': { water: 1 }, '2026-09-30': { weight: 71 } }, '2026-10', { '2026-10-05': ['a'], '2026-09-01': ['b', 'c'] });
assert.deepStrictEqual(ms, { loggedDays: 2, weighs: 1, workouts: 2, classes: 1 });
assert.ok(!C.MONTHLY.find(m => m.id === 'days20').check(ms));

// ---------- daily lessons ----------
const ids = ['a', 'b', 'c', 'd', 'e'];
const dl = C.dailyLessons('2026-11-01', ids);
assert.strictEqual(dl.length, 3); assert.deepStrictEqual(C.dailyLessons('2026-11-01', ids), dl);
assert.strictEqual(new Set(dl).size, 3);
const dl2 = C.dailyLessons('2026-11-01', ids, { [dl[0]]: '2026-11-01' }); // finished today stays in today's set
assert.deepStrictEqual(dl2, dl);
const doneOld = Object.fromEntries(ids.slice(0, 4).map(i => [i, '2026-10-01']));
assert.strictEqual(C.dailyLessons('2026-11-01', ids, doneOld)[0], 'e'); // unfinished first
assert.strictEqual(C.dailyLessons('2026-11-01', ['x'], {}).length, 1);

// ---------- barcode ----------
assert.ok(C.validBarcode('8801043014809')); assert.ok(C.validBarcode('96385074'));
assert.ok(C.validBarcode('036000291452')); assert.strictEqual(C.normBarcode('036000291452'), '0036000291452');
assert.ok(C.validBarcode(C.normBarcode('036000291452'))); assert.strictEqual(C.normBarcode('8801043014809'), '8801043014809');
assert.ok(!C.validBarcode('8801043014808')); assert.ok(!C.validBarcode('12ab'));
const off = C.offToFood('8801043014809', { product_name: '신라면', brands: '농심', serving_size: '120 g', serving_quantity: 120,
  nutriments: { 'energy-kcal_100g': 416.7, 'energy-kcal_serving': 500, carbohydrates_100g: 65, proteins_serving: 10, fat_100g: 13.3, sugars_100g: 3.3, 'saturated-fat_100g': 6.7, sodium_100g: 1.5 } });
assert.deepStrictEqual(off, { name: '농심 신라면', barcode: '8801043014809', serving: '120 g', g: 120, kcal: 500, carb: 78, protein: 10, fat: 16, sugar: 4, satFat: 8, sodium: 1800 });
const off100 = C.offToFood('1', { product_name: 'Milk', nutriments: { energy_100g: 272, proteins_100g: 3.2 } });
assert.deepStrictEqual([off100.serving, off100.g, off100.kcal, off100.protein, off100.sodium], ['100g', 100, 65, 3.2, 0]); // kJ→kcal
assert.strictEqual(C.offToFood('1', { product_name: 'Nutella', brands: 'Nutella,Ferrero', nutriments: { 'energy-kcal_100g': 539 } }).name, 'Nutella'); // brand not doubled
assert.strictEqual(C.offToFood('1', null), null);
assert.strictEqual(C.offToFood('1', { nutriments: {} }), null);
assert.strictEqual(C.offToFood('1', { product_name: 7, brands: ['x'], nutriments: { 'energy-kcal_100g': 'n/a' } }), null); // non-string name, no kcal
const junk = C.offToFood('1', { product_name: 'Bar', brands: ['x'], serving_quantity: 'abc', nutriments: { 'energy-kcal_100g': '120', proteins_100g: -5, fat_100g: '2', sugars_100g: 'n/a' } });
assert.deepStrictEqual([junk.name, junk.kcal, junk.protein, junk.fat, junk.sugar, junk.serving], ['Bar', 120, 0, 2, 0, '100g']);

// ---------- weekly stats ----------
const wd = { '2026-10-26': { meals: { lunch: [{ name: '김밥', kcal: 480, carb: 70, protein: 14, fat: 15, qty: 1 }] } }, '2026-10-27': { meals: { lunch: [{ name: '피자', kcal: 2500, qty: 1 }] } } };
const pd = C.periodDiet(wd, C.dateRange('2026-10-26', '2026-11-01'), () => 2000);
assert.deepStrictEqual([pd.loggedDays, pd.cheatDays, pd.avgKcal, pd.top5[0].name], [2, 1, 1490, '피자']);
assert.strictEqual(C.dateRange('2026-10-30', '2026-11-01').length, 3);
assert.deepStrictEqual(C.muscleLoad({ d: { workouts: [{ items: [{ cat: '하체', kind: 'weight', sets: [{}, {}] }] }] } }, ['d'])['하체'], 2);
// ---------- walking ----------
const chD = C.CHALLENGES.find(c => c.id === 'd3_5k'), chT = C.CHALLENGES.find(c => c.id === 'w50k');
const so = m => d => m[d] || 0;
let cs = C.challengeStatus(chD, '2026-10-01', '2026-10-02', so({ '2026-10-01': 6000 }));
assert.deepStrictEqual([cs.state, cs.doneDays, cs.dayIndex, cs.daysLeft, cs.end], ['active', 1, 2, 1, '2026-10-03']); // today still open
cs = C.challengeStatus(chD, '2026-10-01', '2026-10-03', so({ '2026-10-01': 6000, '2026-10-02': 4000 }));
assert.strictEqual(cs.state, 'failed'); // a past day under goal
cs = C.challengeStatus(chD, '2026-10-01', '2026-10-03', so({ '2026-10-01': 6000, '2026-10-02': 5000, '2026-10-03': 5000 }));
assert.deepStrictEqual([cs.state, cs.progress], ['success', 1]);
cs = C.challengeStatus(chD, '2026-10-01', '2026-10-09', so({ '2026-10-01': 6000, '2026-10-02': 5000 }));
assert.strictEqual(cs.state, 'failed'); // ended without the last day
cs = C.challengeStatus(chT, '2026-10-01', '2026-10-03', so({ '2026-10-01': 30000, '2026-10-02': 21000 }));
assert.deepStrictEqual([cs.state, cs.total], ['success', 51000]); // total kind can finish early
cs = C.challengeStatus(chT, '2026-10-01', '2026-10-08', so({ '2026-10-01': 30000, '2026-10-09': 30000 }));
assert.deepStrictEqual([cs.state, cs.total], ['failed', 30000]); // steps after the end don't count
const sd = { '2026-10-20': { steps: 70000 } };
for (let i = 1; i <= 10; i++) sd[C.addDays('2026-10-20', -i)] = { steps: 5000 };
assert.strictEqual(C.stepFlag(sd, '2026-10-20'), 'over');
sd['2026-10-20'].steps = 30000; assert.strictEqual(C.stepFlag(sd, '2026-10-20'), 'spike');
sd['2026-10-20'].steps = 12000; assert.strictEqual(C.stepFlag(sd, '2026-10-20'), null);
assert.strictEqual(C.stepFlag({ '2026-10-05': { steps: 30000 } }, '2026-10-05'), null); // not enough history to call it a spike
assert.strictEqual(C.countedSteps({ '2026-10-05': { steps: 99999 } }, '2026-10-05'), C.STEP_MAX);
const rep = C.stepReport({ '2026-10-01': { steps: 9000, stepSrc: 'gps' }, '2026-10-02': { steps: 0 }, '2026-10-03': { steps: 99999 } }, C.dateRange('2026-10-01', '2026-10-03'), 8000);
assert.deepStrictEqual([rep.total, rep.avg, rep.recordedDays, rep.goalDays, rep.best.d, rep.flagged.length], [69000, 34500, 2, 2, '2026-10-03', 1]);
assert.strictEqual(C.stepCSV(rep).split('\n')[1], '2026-10-01,9000,gps,');
assert.strictEqual(C.stepCSV(rep).split('\n')[3], '2026-10-03,99999,,하루 최대치 초과');
assert.ok(Math.abs(C.haversine({ lat: 37.5665, lon: 126.978 }, { lat: 37.5665, lon: 126.9893 }) - 1000) < 15); // ~1 km east in Seoul
// 20 fixes, 10 s apart, ~14 m each (1.4 m/s walk) + one teleport + one inaccurate fix
const trk = Array.from({ length: 20 }, (_, i) => ({ lat: 37.5 + i * 0.000126, lon: 127, t: i * 10000, acc: 8 }));
trk.splice(10, 0, { lat: 37.6, lon: 127, t: 95000, acc: 8 }); trk.push({ lat: 37.51, lon: 127, t: 200000, acc: 300 });
const ts = C.trackStats(trk);
assert.ok(Math.abs(ts.distM - 266) < 10, 'dist ' + ts.distM); assert.strictEqual(ts.rejected, 1); assert.ok(ts.dropped >= 1);
assert.ok(ts.movingSec > 150 && ts.movingSec <= 190, 'moving ' + ts.movingSec);
assert.strictEqual(C.trackStats([{ lat: 37.5, lon: 127, t: 0 }, { lat: 37.50001, lon: 127, t: 10000 }]).distM, 0); // 1 m jitter
// walk 5 fixes, drive ~2.2 km in 2 min, walk 5 fixes: only the two walks count (~112 m)
const leg = (lat0, t0) => Array.from({ length: 5 }, (_, i) => ({ lat: lat0 + i * 0.000126, lon: 127, t: t0 + i * 10000 }));
const car = Array.from({ length: 4 }, (_, i) => ({ lat: 37.5005 + (i + 1) * 0.005, lon: 127, t: 40000 + (i + 1) * 30000 }));
const drive = C.trackStats([...leg(37.5, 0), ...car, ...leg(37.5205 + 0.0001, 160000 + 10000)]);
assert.ok(Math.abs(drive.distM - 112) < 20, 'drive dist ' + drive.distM);
// 5 km/h walk with a 20-minute gap in the middle (screen off, still walking): speed must stay ~5 km/h
const w5 = (i0, n, t0) => Array.from({ length: n }, (_, i) => ({ lat: 37.5 + (i0 + i) * 0.0000125 * 10, lon: 127, t: t0 + i * 10000 }));
const gapWalk = [...w5(0, 60, 0), ...w5(60 + 120, 60, 590000 + 1200000)];
const gs = C.trackStats(gapWalk), kmh = gs.distM / 1000 / (gs.movingSec / 3600);
assert.ok(kmh > 4 && kmh < 6, 'gap walk kmh ' + kmh.toFixed(1));
// standing still 20 min then walking on: the stop adds neither distance nor time
const stop = C.trackStats([...w5(0, 30, 0), { lat: 37.5 + 30 * 0.000125 + 0.0001, lon: 127, t: 290000 + 1200000 }, ...w5(31, 30, 1500000)]);
assert.ok(stop.movingSec < 700, 'stop moving ' + stop.movingSec);
assert.strictEqual(C.gpsSteps(1000, 170), 1417); assert.strictEqual(C.speedMet(5), 3.8);
// pedometer: 2 Hz walking for 10 s → ~20 steps; small noise → 0; 2 shakes → 0
const walk = C.stepDetector();
for (let t = 0; t < 10000; t += 20) walk.feed(t, 9.8 + 3 * Math.sin(2 * Math.PI * 2 * t / 1000));
assert.ok(walk.steps >= 18 && walk.steps <= 21, 'walk steps ' + walk.steps);
const still = C.stepDetector(); let seed = 1; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
for (let t = 0; t < 10000; t += 20) still.feed(t, 9.8 + (rnd() - 0.5) * 0.6);
assert.strictEqual(still.steps, 0);
const shake = C.stepDetector();
for (let t = 0; t < 3000; t += 20) shake.feed(t, 9.8 + (t > 1000 && t < 1300 ? 8 * Math.sin(Math.PI * (t - 1000) / 150) : 0));
assert.strictEqual(shake.steps, 0);

// day report: needs 2 meals; balanced day scores high, junk + late + skipped day scores low
{
  const tg = C.nutrientTargets(2000, [50, 20, 30]), F = n => ({ ...C.FOODS.find(f => f.name === n), qty: 1 });
  assert.strictEqual(C.dayReport({ meals: { breakfast: [F('계란')], lunch: [], dinner: [], snack: [] } }, tg, [50, 20, 30]), null);
  const good = C.dayReport({ meals: { breakfast: [F('현미밥'), F('계란'), F('두부')], lunch: [F('비빔밥'), F('닭가슴살')], dinner: [F('잡곡밥'), F('고등어구이'), F('시금치나물')], snack: [F('그릭요거트')] } },
    tg, [50, 20, 30], { breakfast: '08:00', lunch: '12:30', dinner: '18:30' });
  assert.ok(good.stars.satiety >= 4 && good.stars.pattern === 5 && good.total >= 4, JSON.stringify(good.stars));
  assert.deepStrictEqual(good.timeline.map(x => x.meal), ['breakfast', 'lunch', 'snack', 'dinner']); // snack defaults to 15:00
  assert.deepStrictEqual(good.fasting, { avg: 210, max: 270, min: 150 });
  const bad = C.dayReport({ meals: { breakfast: [], lunch: [F('라면'), F('콜라')], dinner: [], snack: [F('후라이드치킨'), F('후라이드치킨'), F('맥주')] }, mealTime: { snack: '22:30' } }, tg, [50, 20, 30], { lunch: '13:00' });
  assert.ok(bad.stars.pattern <= 2 && bad.notes.pattern.includes('술') && bad.notes.pattern.includes('늦은 밤'), bad.notes.pattern);
  assert.ok(bad.stars.defense <= 3, 'defense ' + bad.stars.defense);
  assert.ok(Number.isInteger(bad.total * 2) && bad.total < good.total);
  // after-midnight snack sorts last and counts as late; today at 13:00 dinner isn't "missed" yet, skipped breakfast is
  const night = C.dayReport({ meals: { breakfast: [], lunch: [F('비빔밥')], dinner: [F('불고기')], snack: [F('만두')] }, mealTime: { dinner: '23:30', snack: '00:30' }, skipped: { breakfast: true } }, tg, [50, 20, 30], { lunch: '12:00' }, 13 * 60);
  assert.deepStrictEqual(night.timeline.map(x => x.meal), ['lunch', 'dinner', 'snack']);
  assert.strictEqual(night.fasting.max, 690); assert.ok(night.notes.pattern.includes('늦은 밤'));
  const noon = C.dayReport({ meals: { breakfast: [F('계란')], lunch: [F('비빔밥')], dinner: [], snack: [] } }, tg, [50, 20, 30], {}, 13 * 60);
  assert.ok(!noon.notes.pattern.includes('거름'), noon.notes.pattern);
  assert.ok(night.notes.pattern.includes('아침 거름'), night.notes.pattern);
  assert.strictEqual(C.dayReport({ meals: { breakfast: [F('계란')], lunch: [F('비빔밥')] } }, { ...tg, kcal: 0 }, [50, 20, 30]), null);
}
// target weight guide and weeks to goal
{
  const g = C.targetGuide(60, 170);
  assert.strictEqual(g.label, '정상'); assert.ok(g.ok); assert.deepStrictEqual(g.range, [53.5, 66.1]);
  assert.strictEqual(C.targetGuide(90, 170).label, '2단계 비만'); assert.strictEqual(C.targetGuide(60, 0), null);
  assert.strictEqual(C.weeksToGoal(70, 65, -500), 11); // 5kg × 7700 / 500 / 7 = 11
  assert.strictEqual(C.weeksToGoal(70, 65, 300), null); assert.strictEqual(C.weeksToGoal(65, 65.2, 0), 0);
}

// lifestyle habit missions
{
  const ids = l => C.habitRecommend(l).map(m => m.id);
  const base = { smoke: 'never', cigs: 0, drink: 0, exercise: 4, chronic: [] };
  assert.deepStrictEqual(ids(base), ['veg']);
  assert.deepStrictEqual(ids({ ...base, smoke: 'now', cigs: 10, drink: 3, exercise: 0 }), ['nodrink', 'cigless', 'cardio']); // capped at HABIT_MAX
  assert.deepStrictEqual(ids({ ...base, chronic: ['htn', 'gout'] }), ['broth', 'purine', 'veg']);
  assert.deepStrictEqual(C.habitRecommend(null), []);
  // first pick starts today; a change starts tomorrow and keeps today's set
  let hm = C.habitPick(null, ['veg', 'broth', 'bogus'], '2026-11-09');
  assert.deepStrictEqual(hm, { ids: ['broth', 'veg'], prev: [], from: '2026-11-09' });
  assert.deepStrictEqual(C.habitActive(hm, '2026-11-09').map(m => m.id), ['broth', 'veg']);
  hm = C.habitPick(hm, ['cardio'], '2026-11-09');
  assert.deepStrictEqual(C.habitActive(hm, '2026-11-09').map(m => m.id), ['broth', 'veg']);
  assert.deepStrictEqual(C.habitActive(hm, '2026-11-10').map(m => m.id), ['cardio']);
  hm = C.habitPick(hm, ['strength'], '2026-11-09'); // second change the same day: today still the original set
  assert.deepStrictEqual(hm.prev, ['broth', 'veg']);
  assert.deepStrictEqual(C.habitActive(null, '2026-11-09'), []);
  // an empty save doesn't use up "starts today"
  assert.deepStrictEqual(C.habitPick(C.habitPick(null, [], '2026-11-09'), ['veg'], '2026-11-09'), { ids: ['veg'], prev: [], from: '2026-11-09' });
  assert.deepStrictEqual(C.habitActive({ ids: ['veg'], from: '2026-11-10' }, '2026-11-09'), []); // missing prev

  assert.strictEqual(C.lifestyleText({ smoke: 'now', cigs: 5, drink: 0, exercise: 2, chronic: ['dm'] }), '담배 하루 5개비 · 술 안 마심 · 운동 최근 1주 2회 · 만성질환: 당뇨 · 당뇨 전단계');
}

{ // supplement routine: paused / weekday filter, day completion rate
  const a = { id: 'a' }, b = { id: 'b', days: [1, 3] }, c = { id: 'c', off: true };
  assert.deepStrictEqual(C.suppDue([a, b, c], '2026-11-09').map(s => s.id), ['a', 'b']); // Monday
  assert.deepStrictEqual(C.suppDue([a, b, c], '2026-11-10').map(s => s.id), ['a']);
  assert.strictEqual(C.suppDayRate([a, b, c], ['b'], '2026-11-09'), 0.5);
  assert.strictEqual(C.suppDayRate([a, b, c], ['b'], '2026-11-10'), 0);
  assert.strictEqual(C.suppDayRate([c], [], '2026-11-10'), null);
  assert.deepStrictEqual(C.suppDue([{ id: 'n', since: '2026-11-09' }], '2026-11-08'), []);
  assert.strictEqual(C.suppDue([{ id: 'n', since: '2026-11-09' }], '2026-11-09').length, 1);
  assert.strictEqual(C.suppAnalysis([{ nutrients: { vitD: 70 }, days: [1] }], 'f').rows[0].v, 10); // weekly dose → daily average
  assert.deepStrictEqual(C.suppMonth([null, 1, 1, 0.5, 1, null]), { avg: 88, best: 2 });
  assert.deepStrictEqual(C.suppMonth([null]), { avg: null, best: 0 });
  assert.ok(Object.keys(C.NUTRIENTS).every(k => C.NUTRIENT_INFO[k]), 'every nutrient has info');
  assert.strictEqual(C.suppClock('NIGHT', {}, '23:00'), '21:00');
  assert.deepStrictEqual(C.suppTimeFields('NIGHT'), { time: 'BEDTIME', time2: 'NIGHT' });
  assert.deepStrictEqual(C.suppTimeFields('BEDTIME'), { time: 'BEDTIME', time2: undefined });
  assert.strictEqual(C.suppCode({ time: 'BEDTIME', time2: 'NIGHT' }), 'NIGHT');
  assert.strictEqual(C.suppCode({ time: 'BEDTIME', time2: 'FUTURE_CODE' }), 'BEDTIME');
  assert.strictEqual(C.suppCode({ time: 'NOPE' }), 'ANYTIME');
}

// ---------- glucose metrics · targets · BP · eating order · photo boxes ----------
{
  const at = (h, m = 0, d = 30) => new Date(2026, 9, d, h, m).getTime();
  const pts = [50, 60, 70, 100, 180, 200, 250, 300].map((v, i) => ({ v, t: at(8, i * 5) }));
  assert.deepStrictEqual(C.tirBands(pts), { vlow: 12.5, low: 12.5, in: 37.5, high: 25, vhigh: 12.5 });
  assert.deepStrictEqual(C.tirBands(pts, 63, 140), { vlow: 12.5, low: 12.5, in: 25, high: 37.5, vhigh: 12.5 }); // 60 → 54..62, 180 → high
  assert.deepStrictEqual(C.tirBands([]), { vlow: 0, low: 0, in: 0, high: 0, vhigh: 0 });
  const st = C.glucoseStats([{ v: 100 }, { v: 120 }, { v: 140 }]);
  assert.deepStrictEqual(st, { n: 3, mean: 120, sd: 20, cv: 16.7, gmi: 6.2 }); // 3.31 + 0.02392×120 = 6.18
  assert.strictEqual(C.glucoseStats([{ v: 154 }]).gmi, 7); // 6.99
  assert.strictEqual(C.glucoseStats([]), null);
  // 15-min readings for a full day → 100% of 1 day, 50% of 2 days
  const day1 = Array.from({ length: 96 }, (_, i) => ({ v: 100, t: at(0, i * 15) }));
  assert.deepStrictEqual(C.cgmCoverage(day1, 1), { days: 1, of: 1, pct: 100, step: 15 });
  assert.strictEqual(C.cgmCoverage(day1, 2).pct, 50);
  // AGP: 5 readings 100..140 in the 08h bin → p50 120, p25 110, p5 102, p95 138; other bins empty
  const ag = C.agp([100, 110, 120, 130, 140].map((v, i) => ({ v, t: at(8, i * 10, 20 + i) })));
  assert.strictEqual(ag.length, 24);
  assert.deepStrictEqual(ag[8], { min: 480, n: 5, p5: 102, p25: 110, p50: 120, p75: 130, p95: 138 });
  assert.strictEqual(ag[9].p50, null);
  assert.strictEqual(C.agp([{ v: 1, t: at(0) }], 15).length, 96);
  // targets by diagnosis type, override only when valid
  assert.deepStrictEqual(C.glucoseTarget({ dx: 'gdm' }), { lo: 63, hi: 140, fastHi: 94, postHi: 119 });
  assert.deepStrictEqual([C.glucoseTarget({}).lo, C.glucoseTarget({}).hi], [70, 180]); // existing profiles without dx keep the standard range
  assert.deepStrictEqual(C.glucoseTarget({ dx: 'toString' }), C.DX_TARGET.none);
  // custom targets are clamped inside the band edges 54 / 250 with a 10 mg/dL gap
  assert.deepStrictEqual(C.glucoseTarget({ gluTarget: { lo: 50, hi: 280, fastHi: 130, postHi: 290 } }), { lo: 54, hi: 250, fastHi: 130, postHi: 250 });
  assert.deepStrictEqual(C.glucoseTarget({ gluTarget: { lo: 54, hi: 250, fastHi: 100, postHi: 250 } }), { lo: 54, hi: 250, fastHi: 100, postHi: 250 });
  assert.deepStrictEqual(C.clampTarget({ lo: 248, hi: 249, fastHi: 60, postHi: 60 }), { lo: 240, hi: 250, fastHi: 241, postHi: 241 });
  assert.deepStrictEqual(C.tirBands([{ v: 52 }, { v: 60 }], 50, 280), { vlow: 50, low: 0, in: 50, high: 0, vhigh: 0 }); // lo 50 → 54, hi 280 → 250
  // band edges: 54 is "low" not "very low", 69.5 below 70, 180.4 above 180, 250 still "high"
  assert.deepStrictEqual(C.tirBands([{ v: 54 }, { v: 69.5 }, { v: 70 }, { v: 180 }, { v: 180.4 }, { v: 250 }, { v: 250.1 }, { v: 53.9 }]),
    { vlow: 12.5, low: 25, in: 25, high: 25, vhigh: 12.5 });
  // report: finger-stick path has no GMI / CV; CGM needs 14 days and 70% wear
  const fr = C.glucoseReport([], [{ v: 100, t: at(8) }, { v: 150, t: at(13) }], 14, C.DX_TARGET.none);
  assert.deepStrictEqual([fr.src, fr.enough, fr.showGmi, fr.showCv, fr.cov], ['finger', false, false, false, null]);
  assert.strictEqual(C.glucoseReport([], [], 14, C.DX_TARGET.none), null);
  const cg14 = Array.from({ length: 14 * 96 }, (_, i) => ({ v: 120, t: at(0, i * 15, 1) }));
  assert.deepStrictEqual([C.glucoseReport(cg14, [], 14, C.DX_TARGET.none).src, C.glucoseReport(cg14, [], 14, C.DX_TARGET.none).showGmi], ['cgm', true]);
  assert.strictEqual(C.glucoseReport(cg14.slice(0, 13 * 96), [], 14, C.DX_TARGET.none).showGmi, false); // 13 days
  assert.deepStrictEqual(C.glucoseTarget({ dx: 'nope' }), C.DX_TARGET.none);
  assert.deepStrictEqual(C.glucoseTarget(null), C.DX_TARGET.none);
  assert.deepStrictEqual(C.glucoseTarget({ dx: 't1', gluTarget: { lo: 80, hi: 160, fastHi: 120, postHi: 160 } }), { lo: 80, hi: 160, fastHi: 120, postHi: 160 });
  assert.deepStrictEqual(C.glucoseTarget({ dx: 't1', gluTarget: { lo: 200, hi: 160, fastHi: 120, postHi: 160 } }), C.DX_TARGET.t1); // lo ≥ hi → ignored
  assert.ok(Object.keys(C.DX_TYPES).every(k => C.validTarget(C.DX_TARGET[k])));
  const tg = C.DX_TARGET.t2;
  assert.strictEqual(C.glucoseStatus(125, 'fasting', tg).level, 'ok');
  assert.strictEqual(C.glucoseStatus(150, 'fasting', tg).label, '목표보다 높음');
  assert.strictEqual(C.glucoseStatus(260, 'after', tg).level, 'high');
  assert.strictEqual(C.glucoseStatus(65, 'other', tg).level, 'low');
  assert.strictEqual(C.glucoseStatus(130, 'after', C.DX_TARGET.gdm).level, 'warn'); // 2h after > 119
  assert.strictEqual(C.timeInRange([{ v: 62 }, { v: 100 }, { v: 150 }], 63, 140), 33);
  // nearest reading within 30 min
  const rd = [{ v: 90, t: at(8) }, { v: 150, t: at(9) }];
  assert.deepStrictEqual(C.nearestReading(rd, at(8, 20)), { v: 90, t: at(8), diffMin: 20 });
  assert.strictEqual(C.nearestReading(rd, at(8, 31)).v, 150); // 29 min from 9:00
  assert.strictEqual(C.nearestReading(rd, at(10, 0)), null);
  assert.deepStrictEqual(C.nearestReading([{ v: 77, t: at(23, 50, 29) }], at(0, 10, 30)), { v: 77, t: at(23, 50, 29), diffMin: 20 }); // across midnight
  // carb comparison: similar ±max(10g,20%) and lower (≤70% and ≥10g less), 3 meals each
  const past = [{ carb: 80, rise: 60 }, { carb: 90, rise: 70 }, { carb: 75, rise: 50 }, { carb: 40, rise: 30 }, { carb: 30, rise: 20 }, { carb: 45, rise: 25 }, { carb: 60, rise: 99 }];
  const cc = C.carbCompare(past, 80);
  assert.strictEqual(cc.enough, true);
  assert.deepStrictEqual(cc.similar, { n: 3, carb: 82, rise: 60 });
  assert.deepStrictEqual(cc.lower, { n: 3, carb: 38, rise: 25 }); // 60g is neither similar (±16) nor ≤56
  assert.strictEqual(C.carbCompare(past.slice(0, 5), 80).enough, false);
  assert.strictEqual(C.carbCompare([], 50).enough, false);
  const zero = C.carbCompare([{ carb: 0, rise: 5 }, { carb: 5, rise: 8 }, { carb: 9, rise: 6 }], 0);
  assert.deepStrictEqual([zero.enough, zero.similar.n, zero.lower.n], [false, 3, 0]); // nothing is "lower" than 0 g
  // eating order: 채소 → 단백질 → 지방 → 탄수화물
  const F = n => C.FOODS.find(f => f.name === n);
  assert.strictEqual(C.eatGroup(F('시금치나물')), 0);
  assert.strictEqual(C.eatGroup(F('방울토마토')), 0);
  assert.strictEqual(C.eatGroup(F('닭가슴살')), 1);
  assert.strictEqual(C.eatGroup(F('삼겹살')), 1);
  assert.strictEqual(C.eatGroup(F('계란')), 1);
  assert.strictEqual(C.eatGroup(F('아몬드')), 2);
  assert.strictEqual(C.eatGroup(F('흰쌀밥')), 3);
  assert.strictEqual(C.eatGroup({ name: '물' }), 3); // no data → last
  assert.deepStrictEqual(C.eatingOrder([F('흰쌀밥'), F('아몬드'), F('닭가슴살'), F('배추김치'), F('현미밥')]).map(x => x.i), [3, 2, 1, 0, 4]);
  // photo boxes: clamp, skip invalid / tiny, alternatives cleaned
  assert.deepStrictEqual(C.clampBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.deepStrictEqual(C.clampBox({ x: -0.2, y: 0.9, w: 0.5, h: 0.5 }), { x: 0, y: 0.9, w: 0.5, h: 0.1 });
  assert.strictEqual(C.clampBox({ x: 1.2, y: 0, w: 0.3, h: 0.3 }), null); // off the image → w 0
  assert.strictEqual(C.clampBox({ x: '0.1', y: 0, w: 0.3, h: 0.3 }), null);
  assert.strictEqual(C.clampBox({ x: NaN, y: 0, w: 0.3, h: 0.3 }), null);
  assert.strictEqual(C.clampBox(null), null);
  const cf = C.cleanPhotoFoods([{ name: ' 비빔밥<b> ', kcal: -5, carb: '12', qty: 0, box: { x: 0.5, y: 0.5, w: 2, h: 2 }, alts: ['돌솥비빔밥', '돌솥비빔밥', ' 비빔밥<b>', 3, '', '회덮밥', '김밥'] }, null]);
  assert.strictEqual(cf.length, 2);
  assert.deepStrictEqual([cf[0].name, cf[0].kcal, cf[0].carb, cf[0].qty], ['비빔밥<b>', 0, 12, 1]); // name stays text; the UI escapes it
  assert.deepStrictEqual(cf[0].box, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  assert.deepStrictEqual(cf[0].alts, ['돌솥비빔밥', '회덮밥', '김밥']);
  assert.deepStrictEqual([cf[1].name, cf[1].box, cf[1].alts], ['음식', null, []]);
  assert.deepStrictEqual(C.cleanPhotoFoods('x'), []);
  // blood pressure
  assert.ok(C.bpValid(120, 80, 70));
  assert.ok(!C.bpValid(80, 90, 70) && !C.bpValid(120, 80, 0) && !C.bpValid(300, 80, 70));
  const bp = C.bpStats([{ sys: 130, dia: 85, pulse: 70, t: at(7) }, { sys: 120, dia: 75, pulse: 60, t: at(8) }, { sys: 110, dia: 70, pulse: 80, t: at(21) }, { sys: 140, dia: 90, pulse: 90, t: at(14) }]);
  assert.deepStrictEqual(bp.morning, { n: 2, sys: 125, dia: 80, pulse: 65 });
  assert.deepStrictEqual(bp.evening, { n: 1, sys: 110, dia: 70, pulse: 80 });
  assert.strictEqual(bp.all.n, 4);
  assert.deepStrictEqual(C.bpStats([]), { all: null, morning: null, evening: null });
}

// periodDiet must not pollute Object.prototype through food names.
{
  const r = C.periodDiet({ '2026-11-17': { meals: { lunch: [{ name: '__proto__', kcal: 100 }, { name: 'constructor', kcal: 50 }] } } }, ['2026-11-17'], () => 2000);
  assert.strictEqual(({}).kcal, undefined);
  assert.deepStrictEqual(r.top5.map(f => [f.name, f.kcal]), [['__proto__', 100], ['constructor', 50]]);
}

console.log('core ok');
