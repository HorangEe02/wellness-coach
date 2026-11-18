// Pure logic + data. Loaded as a classic script in the browser, and via require() in core.test.js.
(function (root) {
  const { haversine, speedMet, workoutKcal, ymd } = typeof module !== 'undefined' ? require('./shared.js') : root.Shared; // merged copies, see shared.js
  // Per 1 serving: [name, serving, grams, kcal, carb g, protein g, fat g, sugar g, sodium mg, saturated fat g]. Approximate values.
  const FOODS = [
    ['흰쌀밥', '1공기', 210, 315, 69, 6, 0.6, 0.1, 5, 0.2], ['현미밥', '1공기', 210, 300, 63, 6.5, 2.2, 0.5, 5, 0.4], ['잡곡밥', '1공기', 210, 305, 65, 7, 1.5, 0.3, 5, 0.3],
    ['곤약밥', '1팩', 150, 110, 24, 2, 0.5, 0, 10, 0.1], ['김치찌개', '1그릇', 400, 230, 10, 15, 14, 4, 1900, 5], ['된장찌개', '1그릇', 400, 150, 10, 10, 7, 3, 1700, 1.2],
    ['순두부찌개', '1그릇', 400, 260, 9, 17, 17, 3, 1500, 5], ['부대찌개', '1그릇', 400, 480, 30, 25, 28, 5, 2400, 10], ['미역국', '1그릇', 350, 70, 4, 5, 3.5, 1, 950, 0.6],
    ['소고기국밥', '1그릇', 600, 520, 70, 28, 13, 3, 1800, 5], ['설렁탕', '1그릇', 600, 450, 50, 30, 13, 1, 1500, 5], ['갈비탕', '1그릇', 600, 500, 30, 35, 25, 3, 1700, 9],
    ['비빔밥', '1그릇', 500, 600, 90, 20, 17, 8, 1200, 3.5], ['김밥', '1줄', 230, 480, 70, 14, 15, 6, 1100, 3], ['참치김밥', '1줄', 250, 540, 70, 18, 20, 6, 1200, 3.5],
    ['떡볶이', '1인분', 200, 480, 95, 9, 6, 15, 1200, 1.5], ['라면', '1봉지', 550, 500, 77, 10, 16, 4, 1800, 8], ['짜장면', '1그릇', 650, 800, 120, 20, 25, 15, 2400, 6],
    ['짬뽕', '1그릇', 900, 690, 90, 30, 22, 8, 3600, 5], ['냉면(물)', '1그릇', 800, 550, 105, 15, 5, 15, 2700, 1], ['칼국수', '1그릇', 700, 600, 100, 20, 12, 3, 2500, 3],
    ['우동', '1그릇', 600, 450, 80, 12, 8, 5, 2200, 2], ['제육볶음', '1인분', 200, 480, 18, 30, 31, 12, 1300, 10], ['불고기', '1인분', 200, 420, 18, 32, 23, 14, 900, 8],
    ['삼겹살', '1인분', 150, 500, 0, 26, 44, 0, 80, 16], ['닭가슴살', '1팩', 100, 110, 0, 23, 1.2, 0, 60, 0.3], ['닭가슴살 소시지', '1개', 100, 120, 4, 15, 5, 1, 450, 1.5],
    ['후라이드치킨', '2조각', 200, 520, 18, 32, 35, 0.5, 900, 9], ['돈까스', '1인분', 250, 700, 60, 30, 37, 6, 1100, 10], ['고등어구이', '1토막', 100, 260, 0, 22, 19, 0, 300, 5],
    ['연어', '1인분', 100, 200, 0, 20, 13, 0, 60, 3], ['계란', '1개', 50, 75, 0.6, 6.3, 5, 0.4, 70, 1.6], ['삶은 달걀', '1개', 45, 65, 0.5, 5.6, 4.5, 0.4, 60, 1.4],
    ['계란후라이', '1개', 46, 95, 0.5, 6.3, 7.5, 0.4, 120, 2], ['두부', '1/2모', 150, 120, 3, 13, 7, 0.5, 10, 1], ['배추김치', '1접시', 50, 15, 3, 1, 0.3, 1, 450, 0],
    ['깍두기', '1접시', 50, 20, 4, 1, 0.2, 2, 400, 0], ['시금치나물', '1접시', 70, 40, 3, 3, 2, 0.5, 300, 0.3], ['콩나물무침', '1접시', 70, 30, 3, 3, 1, 0.5, 250, 0.2],
    ['샐러드(드레싱X)', '1접시', 150, 40, 7, 2, 0.4, 3, 30, 0.1], ['닭가슴살 샐러드', '1접시', 250, 250, 12, 28, 9, 5, 500, 2], ['고구마', '1개', 150, 195, 46, 2, 0.2, 9, 50, 0.1],
    ['감자', '1개', 150, 115, 26, 3, 0.1, 1, 10, 0], ['바나나', '1개', 150, 114, 29, 1.4, 0.4, 18, 1, 0.1], ['사과', '1개', 200, 104, 28, 0.5, 0.3, 21, 2, 0.1],
    ['블루베리', '1인분', 20, 10, 2.4, 0.1, 0.1, 2, 0, 0], ['방울토마토', '10개', 150, 27, 6, 1.3, 0.3, 4, 8, 0], ['우유', '1컵', 200, 130, 10, 6.5, 7.5, 10, 100, 4.5],
    ['저지방우유', '1컵', 200, 90, 10, 6.5, 2.5, 10, 110, 1.5], ['두유', '1팩', 190, 110, 10, 6, 5, 6, 100, 0.8], ['그릭요거트', '1컵', 100, 95, 4, 9, 5, 4, 40, 3],
    ['아메리카노', '1잔', 355, 10, 1.5, 0.5, 0, 0, 5, 0], ['카페라떼', '1잔', 355, 180, 15, 9, 9, 13, 120, 6], ['식빵', '1장', 40, 110, 20, 3.5, 1.5, 2, 200, 0.5],
    ['베이글', '1개', 100, 270, 53, 10, 1.5, 6, 450, 0.3], ['샌드위치', '1개', 200, 350, 38, 15, 15, 5, 800, 4], ['피자', '1조각', 120, 290, 33, 12, 12, 4, 700, 5],
    ['햄버거', '1개', 220, 520, 45, 25, 26, 9, 1000, 9], ['프로틴쉐이크', '1잔', 300, 130, 4, 24, 2, 2, 150, 1], ['단백질바', '1개', 50, 200, 20, 15, 7, 5, 150, 3],
    ['아몬드', '한줌', 30, 175, 6, 6, 15, 1, 0, 1.2], ['견과류믹스', '1봉', 25, 150, 6, 4, 12, 2, 30, 1.5], ['오트밀', '1컵', 40, 150, 27, 5, 2.5, 0.4, 2, 0.5],
    ['그래놀라', '1컵', 50, 220, 34, 5, 8, 10, 50, 2], ['콜라', '1캔', 355, 150, 39, 0, 0, 39, 15, 0], ['제로콜라', '1캔', 355, 0, 0, 0, 0, 0, 30, 0],
    ['오렌지주스', '1컵', 200, 90, 21, 1, 0, 18, 5, 0], ['맥주', '1캔', 355, 150, 13, 1.5, 0, 0, 15, 0], ['소주', '1병', 360, 400, 0, 0, 0, 0, 0, 0],
    ['막걸리', '1잔', 250, 115, 6, 1.5, 0, 2, 10, 0], ['떡', '2조각', 100, 230, 50, 4, 0.5, 10, 200, 0.1], ['만두', '5개', 150, 300, 35, 12, 12, 3, 600, 4],
    ['치즈', '1장', 20, 60, 1, 4, 5, 0, 250, 3], ['아이스크림', '1개', 100, 200, 24, 3.5, 10, 20, 70, 6], ['초콜릿', '1조각', 30, 160, 18, 2, 9, 15, 20, 5.5],
    ['감자칩', '1봉', 60, 320, 32, 3.5, 20, 1, 350, 6],
  ].map(([name, serving, g, kcal, carb, protein, fat, sugar, sodium, satFat]) => ({ name, serving, g, kcal, carb, protein, fat, sugar, sodium, satFat }));
  const NUTRI_KEYS = ['kcal', 'carb', 'protein', 'fat', 'sugar', 'sodium', 'satFat'];

  const ACTIVITY = { 1.2: '거의 안 움직임', 1.375: '가벼운 활동(주1~3회)', 1.55: '보통(주3~5회)', 1.725: '활발(주6~7회)' };
  // [name, category, MET, kind]; kind 'time' = minutes, 'weight' = kg × reps sets, 'reps' = bodyweight reps.
  const EXERCISES = [
    ['걷기', '유산소', 3.5, 'time'], ['빠르게 걷기', '유산소', 4.5, 'time'], ['달리기', '유산소', 9.8, 'time'], ['러닝머신', '유산소', 8, 'time'],
    ['실내 사이클', '유산소', 7, 'time'], ['자전거', '유산소', 7.5, 'time'], ['수영', '유산소', 8, 'time'], ['등산', '유산소', 6.5, 'time'],
    ['줄넘기', '유산소', 11, 'time'], ['계단 오르기', '유산소', 8.8, 'time'], ['일립티컬', '유산소', 5, 'time'], ['로잉머신', '유산소', 7, 'time'],
    ['에어로빅', '유산소', 6.5, 'time'], ['배드민턴', '유산소', 5.5, 'time'], ['테니스', '유산소', 7, 'time'], ['축구', '유산소', 7, 'time'],
    ['요가', '코어', 2.5, 'time'], ['필라테스', '코어', 3, 'time'], ['스트레칭', '코어', 2.3, 'time'], ['플랭크', '코어', 3.8, 'time'],
    ['크런치', '코어', 3.8, 'reps'], ['레그레이즈', '코어', 3.8, 'reps'], ['러시안 트위스트', '코어', 3.8, 'reps'],
    ['벤치프레스', '가슴', 5, 'weight'], ['덤벨 프레스', '가슴', 5, 'weight'], ['체스트 플라이', '가슴', 4, 'weight'], ['푸시업', '가슴', 3.8, 'reps'],
    ['데드리프트', '등', 6, 'weight'], ['랫풀다운', '등', 4.5, 'weight'], ['바벨 로우', '등', 5, 'weight'], ['풀업', '등', 5, 'reps'],
    ['오버헤드 프레스', '어깨', 5, 'weight'], ['사이드 레터럴 레이즈', '어깨', 3.5, 'weight'],
    ['덤벨 컬', '팔', 3.5, 'weight'], ['바벨 컬', '팔', 3.5, 'weight'], ['트라이셉스 익스텐션', '팔', 3.5, 'weight'], ['딥스', '팔', 4, 'reps'],
    ['스쿼트', '하체', 5.5, 'weight'], ['런지', '하체', 4, 'weight'], ['레그프레스', '하체', 5, 'weight'], ['레그 익스텐션', '하체', 4, 'weight'],
    ['레그 컬', '하체', 4, 'weight'], ['힙 쓰러스트', '하체', 4.5, 'weight'], ['카프 레이즈', '하체', 3.5, 'weight'],
  ].map(([name, cat, met, kind]) => ({ name, cat, met, kind }));
  const EX_CATS = ['유산소', '가슴', '등', '어깨', '팔', '코어', '하체'];
  const INTENSITY = { light: 0.8, normal: 1, hard: 1.25 };
  const MEALS = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
  // Share of the daily calorie target each meal should cover.
  const MEAL_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
  // [carb, protein, fat] % of kcal.
  const DIET_TYPES = { balanced: ['일반 건강 식단', [50, 20, 30]], highProtein: ['고단백(근력 운동)', [40, 30, 30]], lowCarb: ['저탄수화물', [30, 30, 40]], glucose: ['혈당 관리', [40, 25, 35]], keto: ['키토', [5, 20, 75]] };

  // Mifflin-St Jeor
  const bmr = p => Math.round(10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161));
  const tdee = p => Math.round(bmr(p) * p.activity);
  // ~0.5kg/week change (≈500kcal/day), floored at BMR so the target stays safe.
  function goalKcal(p) {
    if (p.kcalOverride) return p.kcalOverride;
    const t = tdee(p), diff = p.target - p.weight;
    if (Math.abs(diff) < 0.5) return t;
    return diff < 0 ? Math.max(bmr(p), t - 500) : t + 300;
  }
  // Weekend boost: Sat/Sun +15%, weekdays lowered so the weekly total stays the same.
  function goalKcalOn(p, ymdStr) {
    const g = goalKcal(p);
    if (!p.weekendBoost) return g;
    const dow = new Date(ymdStr + 'T00:00:00').getDay();
    return Math.round(dow === 0 || dow === 6 ? g * 1.15 : g * (7 - 2 * 1.15) / 5);
  }
  // Grams for the diet's carb/protein/fat split.
  function macroTargets(kcal, ratio = [50, 20, 30]) {
    return { carb: Math.round(kcal * ratio[0] / 100 / 4), protein: Math.round(kcal * ratio[1] / 100 / 4), fat: Math.round(kcal * ratio[2] / 100 / 9) };
  }
  // Full nutrient targets: [min, max] ranges for macros, upper limits for sugar (10% kcal), sat fat (7% kcal), sodium (2,000mg).
  function nutrientTargets(kcal, ratio) {
    const m = macroTargets(kcal, ratio), rng = v => [Math.round(v * 0.8), Math.round(v * 1.05)];
    return { kcal, carb: m.carb, protein: m.protein, fat: m.fat, range: { carb: rng(m.carb), protein: rng(m.protein), fat: rng(m.fat) },
      limit: { sugar: Math.round(kcal * 0.1 / 4), satFat: r1(kcal * 0.07 / 9), sodium: 2000 } };
  }
  const stepsKcal = (steps, kg) => Math.round(steps * kg * 0.0005);
  // Minutes for a set-based exercise: ~2 min per set including rest.
  const exMinutes = ex => ex.kind === 'time' ? ex.sets.reduce((s, x) => s + (x.min || 0), 0) : ex.sets.length * 2;
  const exVolume = ex => ex.kind === 'weight' ? ex.sets.reduce((s, x) => s + (x.kg || 0) * (x.reps || 0), 0) : 0;
  function sessionKcal(items, kg, intensity = 'normal') {
    return Math.round(items.reduce((s, ex) => s + workoutKcal(ex.met, kg, exMinutes(ex)), 0) * (INTENSITY[intensity] || 1));
  }

  const r1 = n => Math.round(n * 10) / 10;
  function sumFoods(items) {
    const t = Object.fromEntries(NUTRI_KEYS.map(k => [k, 0]));
    for (const f of items) for (const k of NUTRI_KEYS) t[k] += (f[k] || 0) * (f.qty ?? 1);
    for (const k of NUTRI_KEYS) t[k] = r1(t[k]);
    return t;
  }
  function dayTotals(day) {
    const t = sumFoods(Object.values(day.meals || {}).flat());
    t.burned = (day.workouts || []).reduce((s, w) => s + (w.kcal || 0), 0);
    return t;
  }

  // 0–100: calories vs target (40), macro split vs target (30), sugar/sat fat/sodium limits (30).
  function dietScore(t, tg, ratio, share = 1) {
    if (!t.kcal) return 0;
    const target = tg.kcal * share;
    const kcalPart = 40 * Math.max(0, 1 - Math.abs(t.kcal - target) / target);
    const pct = [t.carb * 4, t.protein * 4, t.fat * 9].map(v => v / Math.max(1, t.carb * 4 + t.protein * 4 + t.fat * 9) * 100);
    const macroPart = 30 * Math.max(0, 1 - pct.reduce((s, v, i) => s + Math.abs(v - ratio[i]), 0) / 100);
    const over = k => Math.max(0, t[k] / (tg.limit[k] * share) - 1);
    const limitPart = 30 - Math.min(30, (over('sugar') + over('satFat') + over('sodium')) * 15);
    return Math.round(kcalPart + macroPart + limitPart);
  }
  function scoreMessage(t, tg, score) {
    if (!t.kcal) return '오늘 뭐 드셨나요?';
    if (t.kcal < tg.kcal * 0.7) return '아직 칼로리에 여유가 있어요';
    if (t.kcal > tg.kcal * 1.1) return '목표 칼로리를 넘었어요';
    return score >= 80 ? '균형 잡힌 하루예요' : score >= 60 ? '조금만 더 신경 써 볼까요?' : '영양 균형을 챙겨 보세요';
  }
  // Short tags for one meal: protein/carb/fat balance and sodium/sugar.
  function mealFeedback(t, tg, share) {
    if (!t.kcal) return [];
    const tags = [], kc = t.carb * 4 + t.protein * 4 + t.fat * 9 || 1;
    const p = t.protein * 4 / kc * 100, c = t.carb * 4 / kc * 100, f = t.fat * 9 / kc * 100;
    if (p < 15) tags.push({ tone: 'warn', label: '단백질 적은 편', desc: '단백질 비율이 낮아 아쉬워요' });
    else if (p >= 25) tags.push({ tone: 'ok', label: '단백질 충분', desc: '단백질을 잘 챙겼어요' });
    if (c > 65) tags.push({ tone: 'warn', label: '탄수화물 많은 편', desc: '밥·면·빵 양을 조금 줄여 보세요' });
    if (f > 40) tags.push({ tone: 'warn', label: '지방 많은 편', desc: '튀김·기름진 메뉴는 가끔만 드세요' });
    const naLimit = tg.limit.sodium * share;
    tags.push(t.sodium > naLimit ? { tone: 'warn', label: '나트륨 많은 편', desc: '국물은 남기고 싱겁게 드세요' } : { tone: 'ok', label: '나트륨 적은 편', desc: '나트륨이 비교적 적은 음식으로 잘 골랐어요' });
    if (t.sugar > tg.limit.sugar * share) tags.push({ tone: 'warn', label: '당류 많은 편', desc: '단 음료·디저트를 줄여 보세요' });
    return tags;
  }
  // Day meal report (needs 2+ logged meals): four 1–5 star axes, a meal timeline with gaps between meals, and a one-line day type.
  // times: default meal clock times ({breakfast:'08:00',...}); a day's own day.mealTime wins.
  // nowMin: minutes since midnight when the day is today (a main meal counts as missed only 3h after its usual time
  // or when marked skipped); null for past days.
  const ALCOHOL = /맥주|소주|막걸리|와인|위스키|하이볼|사케|칵테일/;
  const clamp5 = n => Math.max(1, Math.min(5, Math.round(n)));
  const lateMin = s => { const m = hmToMin(s); return m < 4 * 60 ? m + 1440 : m; }; // 00:00–03:59 belongs to the night before
  const MAIN_TIMES = { breakfast: '08:00', lunch: '12:00', dinner: '18:00' };
  function dayReport(d, tg, ratio, times = {}, nowMin = null) {
    const logged = Object.keys(MEALS).filter(k => d.meals?.[k]?.length);
    if (logged.length < 2 || !(tg.kcal > 0)) return null;
    const t = sumFoods(logged.flatMap(k => d.meals[k]));
    const kc = t.carb * 4 + t.protein * 4 + t.fat * 9 || 1;
    const dev = [t.carb * 4, t.protein * 4, t.fat * 9].reduce((s, v, i) => s + Math.abs(v / kc * 100 - ratio[i]), 0);
    const kcalOff = t.kcal < tg.kcal * 0.7 || t.kcal > tg.kcal * 1.15;
    const balance = clamp5(5 - dev / 20 - (kcalOff ? 1 : 0)); // every 20 %p off the target split costs a star
    const pRate = t.protein / Math.max(1, tg.protein);
    const satiety = pRate >= 0.9 ? 5 : pRate >= 0.75 ? 4 : pRate >= 0.6 ? 3 : pRate >= 0.4 ? 2 : 1;
    const overs = ['sugar', 'sodium', 'satFat'].filter(k => t[k] > tg.limit[k]);
    const defense = clamp5(5 - ['sugar', 'sodium', 'satFat'].reduce((s, k) => s + Math.max(0, t[k] / tg.limit[k] - 1), 0) * 4 - overs.length * 0.5);
    const timeline = logged.map(k => ({ meal: k, time: d.mealTime?.[k] || times[k] || '15:00', kcal: Math.round(sumFoods(d.meals[k]).kcal) }))
      .sort((a, b) => lateMin(a.time) - lateMin(b.time));
    const flags = [];
    const missed = Object.keys(MAIN_TIMES).filter(k => !d.meals[k]?.length
      && (d.skipped?.[k] || nowMin == null || nowMin >= hmToMin(times[k] || MAIN_TIMES[k]) + 180));
    if (missed.length) flags.push(`${missed.map(k => MEALS[k]).join('·')} 거름`);
    if (timeline.some(x => lateMin(x.time) >= 21 * 60)) flags.push('늦은 밤 식사');
    if (timeline.some(x => x.kcal > tg.kcal * 0.5)) flags.push('한 끼에 몰아 먹음');
    if (logged.some(k => d.meals[k].some(f => ALCOHOL.test(f.name)))) flags.push('술');
    const pattern = clamp5(5 - flags.length);
    const gaps = timeline.slice(1).map((x, i) => lateMin(x.time) - lateMin(timeline[i].time));
    const stars = { balance, satiety, defense, pattern };
    const low = Object.entries(stars).sort((a, b) => a[1] - b[1])[0];
    const TYPE = { balance: '한쪽으로 치우친 하루', satiety: '금방 출출해질 하루', defense: '자극적인 맛이 많았던 하루', pattern: '식사 리듬이 흔들린 하루' };
    return {
      stars, total: Math.round((balance + satiety + defense + pattern) / 2) / 2,
      type: low[1] >= 4 ? '고르게 잘 챙긴 하루' : TYPE[low[0]],
      notes: {
        balance: `탄단지 ${[t.carb * 4, t.protein * 4, t.fat * 9].map(v => Math.round(v / kc * 100)).join(':')} (목표 ${ratio.join(':')}) · ${Math.round(t.kcal)} / ${tg.kcal}kcal`,
        satiety: `단백질 ${Math.round(t.protein)} / ${tg.protein}g`,
        defense: overs.length ? `${overs.map(k => ({ sugar: '당류', sodium: '나트륨', satFat: '포화지방' })[k]).join('·')} 기준 초과` : '당류·나트륨·포화지방 모두 기준 안',
        pattern: flags.length ? flags.join(' · ') : '규칙적으로 먹었어요',
      },
      timeline,
      fasting: gaps.length ? { avg: Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length), max: Math.max(...gaps), min: Math.min(...gaps) } : null,
    };
  }
  // Target weight vs Korean BMI cutoffs (대한비만학회: 18.5 / 23 / 25 / 30 / 35) and the healthy range for this height.
  function targetGuide(target, cm) {
    if (!(cm > 0 && target > 0)) return null;
    const b = bmi(target, cm), m2 = (cm / 100) ** 2;
    const label = b < 18.5 ? '저체중' : b < 23 ? '정상' : b < 25 ? '비만 전 단계' : b < 30 ? '1단계 비만' : b < 35 ? '2단계 비만' : '3단계 비만';
    return { bmi: b, label, ok: b >= 18.5 && b < 23, range: [Math.ceil(18.5 * m2 * 10) / 10, Math.floor(22.9 * m2 * 10) / 10] };
  }
  // Weeks to reach the target at a daily kcal gap (7,700 kcal ≈ 1 kg). null when there's no gap in the right direction.
  function weeksToGoal(weight, target, dailyGap) {
    const kg = target - weight;
    if (Math.abs(kg) < 0.5) return 0;
    if (!dailyGap || Math.sign(dailyGap) !== Math.sign(kg)) return null;
    return Math.ceil(kg * 7700 / dailyGap / 7);
  }
  // Status of an intake vs a [min,max] range or an upper limit.
  const rangeStatus = (v, [min, max]) => v < min ? 'low' : v > max ? 'high' : 'ok';
  const limitStatus = (v, lim) => v > lim ? 'high' : 'ok';
  // Food contributing the most of nutrient k.
  function topFood(items, k) {
    let best = null;
    for (const f of items) { const v = (f[k] || 0) * (f.qty ?? 1); if (v > 0 && (!best || v > best.v)) best = { name: f.name, v: r1(v) }; }
    return best;
  }
  // "Cheat day": eaten more than 110% of the target.
  const isCheatDay = (kcal, target) => kcal > target * 1.1;

  // mg/dL, Korean diabetes association ranges (simplified).
  // With a target (glucoseTarget) the labels compare against the user's own range instead of reference categories.
  function glucoseStatus(v, ctx, tg) {
    const fasting = ctx === 'fasting' || ctx === 'before';
    if (tg) {
      if (v < 54) return { level: 'low', label: '매우 낮음' };
      if (v < tg.lo) return { level: 'low', label: '목표보다 낮음' };
      if (v <= (fasting ? tg.fastHi : ctx === 'after' ? tg.postHi : tg.hi)) return { level: 'ok', label: '목표 범위' };
      return v > 250 ? { level: 'high', label: '많이 높음' } : { level: 'warn', label: '목표보다 높음' };
    }
    if (v < 70) return { level: 'low', label: '저혈당' };
    if (fasting) return v < 100 ? { level: 'ok', label: '정상' } : v < 126 ? { level: 'warn', label: '공복혈당장애 범위' } : { level: 'high', label: '높음' };
    return v < 140 ? { level: 'ok', label: '정상' } : v < 200 ? { level: 'warn', label: '내당능장애 범위' } : { level: 'high', label: '높음' };
  }

  const bmi = (kg, cm) => r1(kg / ((cm / 100) ** 2));
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const searchFoods = q => (q = q.trim()) ? FOODS.filter(f => f.name.includes(q)) : FOODS;

  // Monday of the week containing ymd string s.
  const weekStart = s => { const d = new Date(s + 'T00:00:00'); return addDays(s, -((d.getDay() + 6) % 7)); };
  // Share of CGM readings within 70–180 mg/dL, in %.
  const timeInRange = (pts, lo = 70, hi = 180) => pts.length ? Math.round(pts.filter(p => p.v >= lo && p.v <= hi).length / pts.length * 100) : 0;

  // ---------- store catalog (generic categories; purchase goes to external search) ----------
  const PRODUCTS = [
    { id: 'vitd', name: '비타민D', cat: '영양제', desc: '뼈 건강과 칼슘 흡수에 필요. 실내 생활이 많으면 부족하기 쉬워요.', dose: '하루 400~1000 IU', caution: '고용량 장기 복용은 의사와 상의' },
    { id: 'omega3', name: '오메가3', cat: '영양제', desc: '혈중 중성지방 개선에 도움.', dose: 'EPA+DHA 하루 500~2000mg', caution: '항응고제 복용 중이면 상담 필요' },
    { id: 'probiotics', name: '유산균(프로바이오틱스)', cat: '영양제', desc: '장 건강과 배변 활동에 도움.', dose: '하루 1억~100억 CFU', caution: '면역저하자는 상담 필요' },
    { id: 'magnesium', name: '마그네슘', cat: '영양제', desc: '근육·신경 기능, 에너지 대사에 필요.', dose: '하루 250~350mg', caution: '신장 질환이 있으면 상담 필요' },
    { id: 'multivit', name: '종합비타민', cat: '영양제', desc: '식단에서 부족한 비타민·미네랄 보충.', dose: '제품 표기 1일 섭취량', caution: '다른 영양제와 중복 성분 확인' },
    { id: 'iron', name: '철분', cat: '영양제', desc: '빈혈 예방, 산소 운반에 필요.', dose: '하루 12~14mg', caution: '변비·위장장애 가능, 과다 복용 주의' },
    { id: 'fiber', name: '차전자피 식이섬유', cat: '다이어트', desc: '포만감과 배변 활동에 도움.', dose: '하루 5~10g, 물과 충분히', caution: '물 없이 먹으면 위험' },
    { id: 'protein', name: '단백질 보충제', cat: '다이어트', desc: '식사로 부족한 단백질 보충, 근손실 방지.', dose: '1회 20~30g', caution: '신장 질환이 있으면 상담 필요' },
    { id: 'chicken', name: '닭가슴살', cat: '식품', desc: '고단백 저지방 식품.', dose: '1회 100~150g', caution: '나트륨 함량 확인' },
    { id: 'konjac', name: '곤약밥', cat: '식품', desc: '밥 대체로 칼로리를 낮춰요.', dose: '1회 1팩', caution: '단백질 보충은 따로 필요' },
    { id: 'glucometer', name: '혈당측정기', cat: '기기', desc: '손끝 채혈로 혈당을 직접 측정.', dose: '-', caution: '시험지·채혈침 호환 확인' },
    { id: 'scale', name: '체성분 체중계', cat: '기기', desc: '체중과 체지방률을 함께 측정.', dose: '-', caution: '같은 시간·조건에서 측정' },
  ];
  const shopLinks = name => ({
    naver: 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(name),
    coupang: 'https://www.coupang.com/np/search?q=' + encodeURIComponent(name),
  });

  // ---------- health checkup (Korean national screening thresholds, simplified) ----------
  const band = (v, okMax, warnMax) => v <= okMax ? 'ok' : v <= warnMax ? 'warn' : 'high';
  const CHECKUP = [
    { key: 'bmi', label: 'BMI', unit: 'kg/m²', judge: v => v < 18.5 ? 'low' : band(v, 22.9, 24.9) },
    { key: 'waist', label: '허리둘레', unit: 'cm', judge: (v, sex) => v < (sex === 'm' ? 90 : 85) ? 'ok' : 'high' },
    { key: 'sbp', label: '수축기 혈압', unit: 'mmHg', judge: v => band(v, 119, 139) },
    { key: 'dbp', label: '이완기 혈압', unit: 'mmHg', judge: v => band(v, 79, 89) },
    { key: 'glucose', label: '공복혈당', unit: 'mg/dL', judge: v => band(v, 99, 125) },
    { key: 'tchol', label: '총콜레스테롤', unit: 'mg/dL', judge: v => band(v, 199, 239) },
    { key: 'hdl', label: 'HDL 콜레스테롤', unit: 'mg/dL', judge: v => v < 40 ? 'low' : 'ok' },
    { key: 'ldl', label: 'LDL 콜레스테롤', unit: 'mg/dL', judge: v => band(v, 129, 159) },
    { key: 'tg', label: '중성지방', unit: 'mg/dL', judge: v => band(v, 149, 199) },
    { key: 'ast', label: 'AST', unit: 'U/L', judge: v => band(v, 40, 50) },
    { key: 'alt', label: 'ALT', unit: 'U/L', judge: v => band(v, 35, 45) },
    { key: 'ggt', label: '감마지티피', unit: 'U/L', judge: (v, sex) => band(v, sex === 'm' ? 63 : 35, sex === 'm' ? 77 : 45) },
    { key: 'hb', label: '혈색소', unit: 'g/dL', judge: (v, sex) => v < (sex === 'm' ? 13 : 12) ? 'low' : v > (sex === 'm' ? 16.5 : 15.5) ? 'warn' : 'ok' },
    { key: 'creatinine', label: '혈청 크레아티닌', unit: 'mg/dL', judge: v => band(v, 1.5, 2) },
    { key: 'egfr', label: 'eGFR', unit: 'mL/min', judge: v => v >= 60 ? 'ok' : v >= 45 ? 'warn' : 'low' },
  ];
  const JUDGE_LABEL = { ok: '정상', warn: '주의', high: '높음', low: '낮음' };

  // ---------- file import ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.map(r => r.map(s => s.trim()));
  }

  // shortcut: day-first dates (DD-MM-YYYY) are read as US month-first; add a locale option if non-US exports show up.
  function parseTime(s) {
    s = String(s).trim();
    if (/^\d{12,13}$/.test(s)) return +s;
    let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) { const u = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/); if (u) m = [u[0], u[3], u[1], u[2], u[4], u[5], u[6]]; }
    if (!m) return NaN;
    return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  }

  const TIME_COLS = [/day_time$/i, /start_time$/i, /timestamp/i, /date|일시|날짜/i, /time|시간/i];
  // Returns { glucose:[{t,v}], steps:{ymd:n}, weight:{ymd:kg} }.
  function importCSV(text) {
    const rows = parseCSV(text.replace(/^﻿/, ''));
    const out = { glucose: [], steps: {}, weight: {} };
    const isGlu = c => /glucose|혈당/i.test(c) && !/rate|change|변화/i.test(c);
    // Header = first row with both a time column and a data column (skips title rows like LibreView's "Glucose Data").
    const hi = rows.findIndex(r => r.some(c => TIME_COLS.some(re => re.test(c))) && r.some(c => isGlu(c) || /(^|\.)(count|steps?)$|걸음|(^|\.)weight$|체중/i.test(c)));
    if (hi < 0) return out;
    const h = rows[hi];
    const tc = TIME_COLS.map(re => h.findIndex(c => re.test(c))).find(i => i >= 0);
    const gcs = h.map((c, i) => isGlu(c) ? i : -1).filter(i => i >= 0);
    const mmol = gcs.some(i => /mmol/i.test(h[i]));
    const sc = h.findIndex(c => /(^|\.)(count|steps?)$|걸음/i.test(c));
    const wc = h.findIndex(c => /(^|\.)weight$|체중/i.test(c));
    for (const r of rows.slice(hi + 1)) {
      const t = parseTime(r[tc] || '');
      if (!Number.isFinite(t)) continue;
      const d = ymd(t);
      const g = gcs.map(i => parseFloat(r[i])).find(Number.isFinite);
      if (g != null) out.glucose.push({ t, v: Math.round(mmol ? g * 18 : g) });
      const st = parseFloat(r[sc]);
      // shortcut: expects daily-total step exports (e.g. Samsung step_daily_trend) and keeps the max row per day; per-interval files would need summing.
      if (sc >= 0 && Number.isFinite(st)) out.steps[d] = Math.max(out.steps[d] || 0, Math.round(st));
      const w = parseFloat(r[wc]);
      if (wc >= 0 && Number.isFinite(w)) out.weight[d] = r1(w);
    }
    return out;
  }

  // Apple Health export.xml. shortcut: reads the whole file as text; very large exports (>~500MB) may exhaust browser memory.
  function importAppleXML(text) {
    const out = { glucose: [], steps: {}, weight: {} }, stepBySrc = {};
    const re = /<Record\s+type="HKQuantityTypeIdentifier(StepCount|BodyMass|BloodGlucose)"([^>]*)>/g;
    const attr = (s, k) => (s.match(new RegExp(k + '="([^"]*)"')) || [])[1];
    let m;
    while ((m = re.exec(text))) {
      const a = m[2], v = parseFloat(attr(a, 'value')), unit = attr(a, 'unit') || '';
      const sd = (attr(a, 'startDate') || '').replace(/^(\S+) (\S+) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4');
      const t = Date.parse(sd);
      if (!Number.isFinite(v) || !Number.isFinite(t)) continue;
      const d = ymd(t);
      if (m[1] === 'StepCount') { const k = d + '|' + attr(a, 'sourceName'); stepBySrc[k] = (stepBySrc[k] || 0) + v; }
      else if (m[1] === 'BodyMass') out.weight[d] = r1(unit === 'lb' ? v * 0.4536 : v);
      else out.glucose.push({ t, v: Math.round(/mmol/i.test(unit) ? v * 18 : v) });
    }
    // Phone and watch both record steps; take the larger source per day instead of double counting.
    for (const [k, n] of Object.entries(stepBySrc)) { const d = k.split('|')[0]; out.steps[d] = Math.max(out.steps[d] || 0, Math.round(n)); }
    return out;
  }

  // ---------- weight trend ----------
  // Exponential moving average over daily weigh-ins; smooths water/sodium swings. pts: [{date, kg}] sorted.
  function weightTrend(pts, alpha = 0.25) {
    let ema = null;
    return pts.map(p => ({ date: p.date, kg: Math.round((ema = ema == null ? p.kg : alpha * p.kg + (1 - alpha) * ema) * 100) / 100 }));
  }

  // ---------- sleep ----------
  const hmToMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
  // Minutes between two "HH:MM" clock times, wrapping past midnight.
  const clockDiff = (a, b) => ((hmToMin(b) - hmToMin(a)) % 1440 + 1440) % 1440;
  // 0–100: duration (60, best 7–9h), bedtime consistency vs routine (20), self-rated quality 1–5 (20).
  function sleepScore(s, routine) {
    const h = clockDiff(s.bed, s.wake) / 60;
    const dur = h >= 7 && h <= 9 ? 60 : Math.max(0, 60 - Math.min(Math.abs(h - 7), Math.abs(h - 9)) * 15);
    const off = routine ? Math.min(clockDiff(routine.bed, s.bed), clockDiff(s.bed, routine.bed)) : 0;
    const cons = Math.max(0, 20 - off / 6);
    const q = s.quality ? (s.quality - 1) / 4 * 20 : 10;
    return Math.round(dur + cons + q);
  }
  const sleepHours = s => r1(clockDiff(s.bed, s.wake) / 60);
  const SLEEP_TAGS = ['개운해요', '자주 깼어요', '꿈을 많이 꿨어요', '늦게 잠들었어요', '낮잠 잤어요', '카페인 섭취', '음주', '운동함'];

  // ---------- fasting ----------
  // General-information stages by elapsed hours (not medical advice).
  const FAST_STAGES = [
    [0, '소화 중', '음식을 소화하며 혈당이 올라가는 시간이에요'],
    [4, '혈당 안정', '혈당이 내려가고 저장된 에너지를 쓰기 시작해요'],
    [8, '글리코겐 사용', '간에 저장된 에너지를 주로 쓰고 있어요'],
    [12, '지방 사용 증가', '지방을 에너지로 쓰는 비중이 늘어나요'],
    [16, '케톤 생성', '지방 분해가 활발해지는 구간이에요'],
  ];
  const fastStage = hours => FAST_STAGES.filter(s => hours >= s[0]).at(-1);
  // Fasting routine: next start/end timestamps on/after `now` for days-of-week list (0=Sun) and "HH:MM".
  function nextFastWindow(routine, now) {
    const base = new Date(now); base.setSeconds(0, 0);
    for (let i = -1; i < 8; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i);
      if (!routine.days.includes(d.getDay())) continue;
      const [h, m] = routine.start.split(':').map(Number); d.setHours(h, m, 0, 0);
      const end = d.getTime() + routine.hours * 36e5;
      if (end > now) return { start: d.getTime(), end };
    }
    return null;
  }
  // Two routines overlap if any active day's windows intersect.
  function routinesOverlap(a, b) {
    const w = r => r.days.map(d => { const s = d * 1440 + hmToMin(r.start); return [s, s + r.hours * 60]; });
    const wa = w(a), wb = w(b);
    return wa.some(([s1, e1]) => wb.some(([s2, e2]) => [0, 10080, -10080].some(off => s1 < e2 + off && s2 + off < e1)));
  }

  // ---------- period ----------
  // periods: [{start:'YYYY-MM-DD', end}] → average cycle/length and next predicted start.
  function periodStats(periods, today) {
    const ps = periods.slice().sort((a, b) => a.start.localeCompare(b.start));
    if (!ps.length) return null;
    const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
    const gaps = ps.slice(1).map((p, i) => dayDiff(ps[i].start, p.start)).filter(g => g >= 15 && g <= 60);
    const cycle = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : 28;
    const lens = ps.filter(p => p.end).map(p => dayDiff(p.start, p.end) + 1);
    const len = lens.length ? Math.round(lens.reduce((s, g) => s + g, 0) / lens.length) : 5;
    const last = ps.at(-1);
    let next = addDays(last.start, cycle);
    while (next < today) next = addDays(next, cycle);
    const cycleDay = dayDiff(last.start, today) + 1;
    const phase = cycleDay <= len ? '생리 중' : cycleDay <= cycle - 16 ? '난포기' : cycleDay <= cycle - 12 ? '배란기' : '황체기';
    return { cycle, len, next, cycleDay, phase, dDay: dayDiff(today, next), analyzed: ps.length >= 2 };
  }

  // ---------- GLP-1 injections ----------
  // Half-lives (hours) from product labels; used only for a relative, illustrative curve.
  const GLP_DRUGS = { wegovy: ['위고비(세마글루타이드)', 168, 7], mounjaro: ['마운자로(티르제파타이드)', 120, 7], saxenda: ['삭센다(리라글루타이드)', 13, 1] };
  const INJ_SITES = ['복부 왼쪽', '복부 오른쪽', '허벅지 왼쪽', '허벅지 오른쪽', '팔 왼쪽', '팔 오른쪽'];
  // Relative level at time t: sum of dose·e^(−ln2·Δt/half-life) over past doses.
  function glpLevel(doses, drug, t) {
    const half = GLP_DRUGS[drug][1];
    return Math.round(doses.filter(d => d.t <= t).reduce((s, d) => s + d.mg * Math.exp(-Math.LN2 * (t - d.t) / 36e5 / half), 0) * 100) / 100;
  }
  const nextDose = (doses, drug) => doses.length ? Math.max(...doses.map(d => d.t)) + GLP_DRUGS[drug][2] * 864e5 : null;
  // Least recently used injection site.
  function nextSite(doses) {
    const last = Object.fromEntries(INJ_SITES.map(s => [s, -1]));
    for (const d of doses) if (d.site in last) last[d.site] = Math.max(last[d.site], d.t);
    return INJ_SITES.slice().sort((a, b) => last[a] - last[b])[0];
  }
  const GLP_SIDE = ['메스꺼움', '구토', '변비', '설사', '복통', '두통', '피로', '식욕 저하', '주사 부위 반응'];

  // ---------- supplements ----------
  // Korean Dietary Reference Intakes 2020 (adult, simplified): [label, unit, RDA male, RDA female, UL or null].
  const NUTRIENTS = {
    vitA: ['비타민A', 'μg RAE', 800, 650, 3000], vitD: ['비타민D', 'μg', 10, 10, 100], vitE: ['비타민E', 'mg', 12, 12, 540], vitK: ['비타민K', 'μg', 75, 65, null],
    vitC: ['비타민C', 'mg', 100, 100, 2000], b1: ['비타민B1', 'mg', 1.2, 1.1, null], b2: ['비타민B2', 'mg', 1.5, 1.2, null], b3: ['나이아신', 'mg NE', 16, 14, 35],
    b6: ['비타민B6', 'mg', 1.5, 1.4, 100], folate: ['엽산', 'μg DFE', 400, 400, 1000], b12: ['비타민B12', 'μg', 2.4, 2.4, null],
    calcium: ['칼슘', 'mg', 800, 700, 2500], magnesium: ['마그네슘', 'mg', 360, 280, 350], iron: ['철', 'mg', 10, 14, 45], zinc: ['아연', 'mg', 10, 8, 35],
    selenium: ['셀레늄', 'μg', 60, 60, 400], omega3: ['오메가3(EPA+DHA)', 'mg', 500, 500, 3000], lutein: ['루테인', 'mg', 10, 10, 20], probiotics: ['프로바이오틱스', '억 CFU', 1, 1, null],
  };
  // Time codes for an intake schedule, with offset (min) from the referenced meal.
  const SUPP_TIMES = {
    MORNING_BEFORE_MEAL: ['아침 식전', 'breakfast', -30], MORNING_AFTER_MEAL: ['아침 식후', 'breakfast', 30], LUNCH_AFTER_MEAL: ['점심 식후', 'lunch', 30],
    DINNER_AFTER_MEAL: ['저녁 식후', 'dinner', 30], BEDTIME: ['자기 전', 'bed', -30], ANYTIME: ['아무 때나', null, 0],
    // Added later: 4th item = older code stored in s.time for devices that don't know the new one (new code goes in s.time2).
    MORNING: ['오전 중', 'breakfast', 90, 'MORNING_AFTER_MEAL'], EVENING: ['저녁 시간', 'dinner', 0, 'DINNER_AFTER_MEAL'], NIGHT: ['밤', 'bed', -120, 'BEDTIME'],
    ANYTIME_BEFORE_MEAL: ['끼니마다 식전', null, 0, 'ANYTIME'], ANYTIME_AFTER_MEAL: ['끼니마다 식후', null, 0, 'ANYTIME'],
  };
  // The code to use for a supplement: the newer s.time2 when this build knows it, else s.time.
  const suppCode = s => SUPP_TIMES[s.time2] ? s.time2 : SUPP_TIMES[s.time] ? s.time : 'ANYTIME';
  // Fields to store for a chosen code: { time, time2 } with time always an original code.
  const suppTimeFields = code => SUPP_TIMES[code]?.[3] ? { time: SUPP_TIMES[code][3], time2: code } : { time: code, time2: undefined };
  // Other names on labels, and general cautions (not medical advice).
  const NUTRIENT_INFO = {
    vitA: [['레티놀', '베타카로틴(비타민A 원료)'], ['임신 중에는 레티놀 형태를 많이 먹지 않도록 주의하세요. 태아 기형 위험이 알려져 있어요.', '흡연자는 고용량 베타카로틴 보충제를 피하는 게 좋아요.']],
    vitD: [['콜레칼시페롤(D3)', '에르고칼시페롤(D2)'], ['지용성이라 식사와 함께 먹으면 흡수가 잘 돼요.', '1μg은 40IU예요. 오래 많이 먹으면 혈중 칼슘이 높아질 수 있어요.']],
    vitE: [['토코페롤'], ['고용량은 출혈 경향을 높일 수 있어요. 항응고제를 먹고 있다면 의사와 상의하세요.']],
    vitK: [['필로퀴논(K1)', '메나퀴논(K2)'], ['와파린을 먹고 있다면 섭취량을 일정하게 유지하고 의사와 상의하세요.']],
    vitC: [['아스코르브산'], ['한 번에 많이 먹으면 설사나 속 불편이 생길 수 있어요.', '신장결석을 앓은 적이 있다면 고용량은 피하세요.']],
    b1: [['티아민'], ['수용성이라 쓰고 남은 양은 소변으로 나가요.']],
    b2: [['리보플라빈'], ['소변이 밝은 노란색이 될 수 있는데 정상이에요.']],
    b3: [['니코틴산', '니코틴아마이드'], ['니코틴산 형태를 많이 먹으면 얼굴이 붉어지고 화끈거릴 수 있어요.']],
    b6: [['피리독신'], ['오래 고용량으로 먹으면 손발 저림 같은 신경 증상이 생길 수 있어요.']],
    folate: [['폴산', '5-MTHF'], ['임신을 계획한다면 임신 전부터 챙기는 게 권장돼요.', '합성 엽산(폴산)을 많이 먹으면 비타민B12 부족을 가릴 수 있어요. 상한(1,000μg)도 합성 엽산 기준이에요.']],
    b12: [['코발라민', '시아노코발라민', '메틸코발라민'], ['채식, 고령, 메트포르민 복용 중이면 부족해지기 쉬워요.']],
    calcium: [['탄산칼슘', '구연산칼슘'], ['한 번에 500mg 이하로 나눠 먹으면 흡수가 나아요.', '철분 · 아연과는 시간을 띄워 먹으세요. 많이 먹으면 변비가 생길 수 있어요.']],
    magnesium: [['산화마그네슘', '구연산마그네슘'], ['보충제로는 하루 350mg을 넘기면 설사가 생기기 쉬워요.', '신장 질환이 있다면 의사와 상의하세요.']],
    iron: [['헴철', '푸마르산제일철'], ['비타민C와 함께 먹으면 흡수가 늘고, 칼슘 · 차 · 커피와는 시간을 띄우는 게 좋아요.', '속이 불편하면 식후로 옮겨 보세요. 어린이 손이 닿지 않게 보관하세요.']],
    zinc: [['글루콘산아연', '산화아연'], ['오래 고용량으로 먹으면 구리가 부족해질 수 있어요.', '빈속에 먹으면 메스꺼울 수 있어요.']],
    selenium: [['셀렌', '셀레노메티오닌'], ['많이 먹으면 탈모나 손발톱 이상이 생길 수 있어요.']],
    omega3: [['EPA', 'DHA', '피쉬오일'], ['항응고제를 먹고 있다면 의사와 상의하세요.', '비린 트림이 나면 식사와 함께 먹어 보세요.']],
    lutein: [['지아잔틴'], ['아주 많이 먹으면 피부가 노랗게 보일 수 있어요.']],
    probiotics: [['유산균', '락토바실러스', '비피도박테리움'], ['처음 며칠은 배에 가스가 찰 수 있어요.', '면역이 많이 떨어진 상태라면 의사와 상의하세요.']],
  };
  // Generic supplement presets: [name, nutrients per daily dose, recommended time].
  const SUPP_PRESETS = [
    ['종합비타민', { vitA: 700, vitC: 100, vitD: 10, vitE: 11, b1: 1.2, b2: 1.4, b3: 15, b6: 1.5, folate: 400, b12: 2.4, zinc: 8.5, iron: 12, selenium: 55, magnesium: 100, calcium: 200 }, 'MORNING_AFTER_MEAL'],
    ['비타민D 1000IU', { vitD: 25 }, 'LUNCH_AFTER_MEAL'], ['비타민C 1000', { vitC: 1000 }, 'MORNING_AFTER_MEAL'],
    ['오메가3', { omega3: 600 }, 'LUNCH_AFTER_MEAL'], ['마그네슘', { magnesium: 250 }, 'BEDTIME'],
    ['칼슘·마그네슘·D', { calcium: 500, magnesium: 150, vitD: 10 }, 'DINNER_AFTER_MEAL'], ['철분', { iron: 14 }, 'MORNING_BEFORE_MEAL'],
    ['아연', { zinc: 8.5 }, 'DINNER_AFTER_MEAL'], ['비타민B 컴플렉스', { b1: 50, b2: 50, b3: 50, b6: 50, folate: 400, b12: 100 }, 'MORNING_AFTER_MEAL'],
    ['루테인', { lutein: 20 }, 'LUNCH_AFTER_MEAL'], ['유산균', { probiotics: 100 }, 'MORNING_BEFORE_MEAL'], ['엽산', { folate: 400 }, 'MORNING_AFTER_MEAL'],
  ].map(([name, nutrients, time]) => ({ name, nutrients, time }));
  // Clock time for a time code given the user's meal times and bedtime.
  function suppClock(code, mealTimes, bed) {
    const [, ref, off] = SUPP_TIMES[code] || SUPP_TIMES.ANYTIME;
    if (!ref) return null;
    const m = (hmToMin(ref === 'bed' ? bed : mealTimes[ref]) + off + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  // Routine: s.off = paused, s.days = weekdays (0=Sun) to take it on (missing = every day), s.since = first day it counts.
  // shortcut: pausing or changing weekdays still re-judges past days; keep a schedule history if that matters.
  const suppDue = (supps, date) => { const w = new Date(date + 'T00:00:00').getDay(); return supps.filter(s => !s.off && (!s.since || date >= s.since) && (!s.days || s.days.includes(w))); };
  // Share of the day's due supplements that were checked; null when nothing was due.
  function suppDayRate(supps, taken, date) {
    const due = suppDue(supps, date);
    return due.length ? due.filter(s => (taken || []).includes(s.id)).length / due.length : null;
  }
  // Average daily amount of nutrient k from one supplement (weekday-only ones spread over the week).
  const suppDaily = (s, k) => (s.nutrients?.[k] || 0) * (s.perDay || 1) * (s.days ? s.days.length / 7 : 1);
  // Month stats from day rates (null = nothing due): average %, longest full run.
  function suppMonth(rates) {
    const had = rates.filter(r => r !== null);
    let best = 0, run = 0; for (const r of rates) { if (r === null) continue; run = r >= 1 ? run + 1 : 0; best = Math.max(best, run); }
    return { avg: had.length ? Math.round(had.reduce((a, b) => a + b, 0) / had.length * 100) : null, best };
  }
  // Sum nutrients across supplements → per-nutrient status: low (<RDA), ok, high (>UL); dup = in 2+ products.
  function suppAnalysis(supps, sex) {
    const total = {}, count = {};
    for (const s of supps) for (const [k, v] of Object.entries(s.nutrients || {})) {
      if (!NUTRIENTS[k]) continue;
      total[k] = (total[k] || 0) + suppDaily(s, k); count[k] = (count[k] || 0) + 1;
    }
    const rows = Object.keys(NUTRIENTS).filter(k => total[k] != null).map(k => {
      const [label, unit, rm, rf, ul] = NUTRIENTS[k], rda = sex === 'm' ? rm : rf, v = r1(total[k]);
      // Some upper limits (e.g. magnesium 350 mg, supplements only) sit below the RDA, which counts food too.
      // Supplements alone then can't be both "enough" and "not too much", so reaching the limit counts as enough.
      const need = ul != null ? Math.min(rda, ul) : rda;
      return { key: k, label, unit, v, rda, need, ul, status: ul != null && v > ul ? 'high' : v < need ? 'low' : 'ok', dup: count[k] > 1 };
    });
    const score = rows.length ? Math.round(100 - rows.filter(r => r.status === 'high').length * 20 - rows.filter(r => r.dup).length * 5) : 0;
    return { rows, score: Math.max(0, score) };
  }

  // ---------- glucose ----------
  // CGM rise after a meal: max within 2h after meal time minus the reading closest to meal time.
  function mealSpike(cgm, t) {
    const near = cgm.filter(p => Math.abs(p.t - t) <= 30 * 6e4).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    const after = cgm.filter(p => p.t > t && p.t <= t + 2 * 36e5);
    if (!near || !after.length) return null;
    const peak = after.reduce((a, b) => b.v > a.v ? b : a);
    return { base: near.v, peak: peak.v, rise: peak.v - near.v, peakMin: Math.round((peak.t - t) / 6e4) };
  }
  // Daily glucose score from time-in-range (70–180) and spikes (>140 after meals); 0–100.
  const glucoseScore = (cgm, spikes, lo, hi) => cgm.length ? Math.max(0, Math.round(timeInRange(cgm, lo, hi) - spikes.filter(s => s.peak > 140).length * 5)) : null;

  // ---------- glucose metrics (CGM report) ----------
  // Diagnosis type the user picked → default targets. lo/hi: CGM target range; fastHi / postHi: fingerstick fasting·before / 2h after.
  const DX_TYPES = { none: '해당 없음 · 예방', pre: '당뇨병 전단계', t1: '1형 당뇨', t2: '2형 당뇨', gdm: '임신성 당뇨', other: '기타' };
  const DX_TARGET = {
    none: { lo: 70, hi: 180, fastHi: 99, postHi: 139 }, pre: { lo: 70, hi: 180, fastHi: 99, postHi: 139 }, // standard CGM range 70–180
    t1: { lo: 70, hi: 180, fastHi: 130, postHi: 179 }, t2: { lo: 70, hi: 180, fastHi: 130, postHi: 179 },
    gdm: { lo: 63, hi: 140, fastHi: 94, postHi: 119 }, other: { lo: 70, hi: 180, fastHi: 130, postHi: 179 },
  };
  const validTarget = o => !!o && typeof o === 'object' && ['lo', 'hi', 'fastHi', 'postHi'].every(k => typeof o[k] === 'number' && Number.isFinite(o[k]) && o[k] >= 40 && o[k] <= 300) && o.lo < o.hi && o.lo < o.fastHi && o.lo < o.postHi;
  // The target range must sit inside the fixed band edges 54 and 250 with at least a 10 mg/dL gap; upper limits stay above lo.
  const TG_MIN = 54, TG_MAX = 250, TG_GAP = 10;
  function clampTarget(o) {
    const c = (v, a, b) => Math.min(b, Math.max(a, Math.round(v))), lo = c(o.lo, TG_MIN, TG_MAX - TG_GAP);
    return { lo, hi: c(o.hi, lo + TG_GAP, TG_MAX), fastHi: c(o.fastHi, lo + 1, TG_MAX), postHi: c(o.postHi, lo + 1, TG_MAX) };
  }
  const glucoseTarget = p => clampTarget(validTarget(p?.gluTarget) ? p.gluTarget : DX_TARGET[Object.hasOwn(DX_TARGET, p?.dx ?? '') ? p.dx : 'none']);
  // % of readings in 5 bands: <54, 54..lo-1, lo..hi, hi+1..250, >250 (consensus bands when lo/hi = 70/180).
  function tirBands(pts, lo = 70, hi = 180) {
    ({ lo, hi } = clampTarget({ lo, hi, fastHi: hi, postHi: hi }));
    const n = pts.length, c = { vlow: 0, low: 0, in: 0, high: 0, vhigh: 0 };
    for (const { v } of pts) c[v < 54 ? 'vlow' : v < lo ? 'low' : v <= hi ? 'in' : v <= 250 ? 'high' : 'vhigh']++;
    for (const k in c) c[k] = n ? r1(c[k] / n * 100) : 0;
    return c;
  }
  // Mean, sample SD, CV % and GMI % (GMI = 3.31 + 0.02392 × mean mg/dL; a reference estimate, not an HbA1c test).
  function glucoseStats(pts) {
    const n = pts.length; if (!n) return null;
    const mean = pts.reduce((s, p) => s + p.v, 0) / n, sd = n > 1 ? Math.sqrt(pts.reduce((s, p) => s + (p.v - mean) ** 2, 0) / (n - 1)) : 0;
    return { n, mean: Math.round(mean), sd: r1(sd), cv: r1(sd / mean * 100), gmi: r1(3.31 + 0.02392 * mean) };
  }
  const med = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  // Days with data and wear % over `days` days; reading interval = median gap (1–60 min).
  function cgmCoverage(pts, days) {
    const ts = pts.map(p => p.t).sort((a, b) => a - b), gaps = ts.slice(1).map((t, i) => (t - ts[i]) / 6e4).filter(g => g > 0);
    const step = Math.min(60, Math.max(1, gaps.length ? med(gaps) : 15));
    return { days: new Set(ts.map(t => ymd(t))).size, of: days, pct: days ? Math.min(100, Math.round(ts.length * step / (days * 1440) * 100)) : 0, step };
  }
  // What the glucose report may show. CGM with ≥14 days and ≥70% wear is "enough" for GMI and CV;
  // finger-stick only data gives a share of readings per band (not time), no GMI/CV.
  function glucoseReport(cgm, finger, days, tg) {
    const src = cgm.length ? 'cgm' : finger.length ? 'finger' : null, pts = src === 'cgm' ? cgm : finger;
    if (!src) return null;
    const cov = src === 'cgm' ? cgmCoverage(cgm, days) : null, enough = !!cov && cov.days >= 14 && cov.pct >= 70;
    return { src, enough, cov, bands: tirBands(pts, tg.lo, tg.hi), stats: glucoseStats(pts), showGmi: enough, showCv: enough };
  }
  // Linear-interpolated percentile of a sorted array.
  const pctl = (s, q) => { const i = (s.length - 1) * q, a = Math.floor(i); return s[a] + (s[Math.min(a + 1, s.length - 1)] - s[a]) * (i - a); };
  // AGP-style daily profile: per time-of-day bin, 5/25/50/75/95th percentiles. Bins with fewer than `minN` readings get nulls.
  function agp(pts, binMin = 60, minN = 3) {
    const bins = Array.from({ length: Math.ceil(1440 / binMin) }, () => []);
    for (const p of pts) { const d = new Date(p.t); bins[Math.floor((d.getHours() * 60 + d.getMinutes()) / binMin)].push(p.v); }
    return bins.map((b, i) => {
      if (b.length < minN) return { min: i * binMin, n: b.length, p5: null, p25: null, p50: null, p75: null, p95: null };
      const s = b.sort((x, y) => x - y), r = q => Math.round(pctl(s, q));
      return { min: i * binMin, n: b.length, p5: r(0.05), p25: r(0.25), p50: r(0.5), p75: r(0.75), p95: r(0.95) };
    });
  }
  // Reading closest to time t within maxMin minutes, or null.
  function nearestReading(pts, t, maxMin = 30) {
    let best = null;
    for (const p of pts) { const d = Math.abs(p.t - t); if (d <= maxMin * 6e4 && (!best || d < Math.abs(best.t - t))) best = p; }
    return best && { v: best.v, t: best.t, diffMin: Math.round(Math.abs(best.t - t) / 6e4) };
  }
  // Past meals [{carb, rise}] vs the current meal's carbs: "similar" (±max(10g, 20%)) and "lower" (≤70% and at least 10g less).
  // Each group needs at least `minN` meals; otherwise enough=false and the UI shows no numbers.
  function carbCompare(meals, carb, minN = 3) {
    const tol = Math.max(10, carb * 0.2), ok = meals.filter(m => Number.isFinite(m.carb) && Number.isFinite(m.rise));
    const similar = ok.filter(m => Math.abs(m.carb - carb) <= tol), lower = ok.filter(m => m.carb <= carb * 0.7 && m.carb <= carb - 10);
    const sum = g => ({ n: g.length, carb: Math.round(g.reduce((s, m) => s + m.carb, 0) / (g.length || 1)), rise: Math.round(med(g.map(m => m.rise))) });
    return { enough: similar.length >= minN && lower.length >= minN, similar: sum(similar), lower: sum(lower) };
  }

  // ---------- eating order ----------
  // 0 채소 → 1 단백질 → 2 지방 → 3 탄수화물. Vegetables by name or a light low-carb low-fat serving; the rest by energy share.
  const VEG_RE = /채소|야채|나물|샐러드|김치|깍두기|브로콜리|시금치|양배추|버섯|오이|토마토|당근|상추|미역|다시마|가지|숙주|파프리카|케일|무침|겉절이/;
  const EAT_GROUPS = ['채소', '단백질', '지방', '탄수화물'];
  function eatGroup(f) {
    const n = k => { const v = +f[k]; return Number.isFinite(v) ? v : 0; }, c = n('carb') * 4, p = n('protein') * 4, fat = n('fat') * 9;
    if (VEG_RE.test(f.name || '') || (n('kcal') >= 15 && n('kcal') <= 60 && n('carb') <= 10 && n('fat') <= 3)) return 0;
    if (p > 0 && p >= c && (p >= fat * 0.5 || n('protein') >= 10)) return 1;
    if (fat > 0 && fat >= c) return 2;
    return 3;
  }
  // Stable sort into the eating order: [{i (original index), group}].
  const eatingOrder = foods => foods.map((f, i) => ({ i, group: eatGroup(f) })).sort((a, b) => a.group - b.group || a.i - b.i);

  // ---------- AI photo foods (untrusted model output) ----------
  const r3 = n => Math.round(n * 1000) / 1000;
  // Normalized box {x,y,w,h} in 0–1, clamped to the image; null when missing, non-numeric or too small.
  function clampBox(b) {
    if (!b || typeof b !== 'object' || !['x', 'y', 'w', 'h'].every(k => typeof b[k] === 'number' && Number.isFinite(b[k]))) return null;
    const cl = v => Math.min(1, Math.max(0, v)), x = cl(b.x), y = cl(b.y), w = Math.min(cl(b.w), 1 - x), h = Math.min(cl(b.h), 1 - y);
    return w < 0.02 || h < 0.02 ? null : { x: r3(x), y: r3(y), w: r3(w), h: r3(h) };
  }
  const cleanStr = (s, n = 40) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n) : '';
  // Keeps only the fields the app uses: numbers ≥ 0, a clamped box, up to 3 distinct alternative names.
  function cleanPhotoFoods(foods) {
    return (Array.isArray(foods) ? foods : []).slice(0, 20).map(f => {
      const o = { name: cleanStr(f?.name) || '음식', serving: cleanStr(f?.serving, 20) || '1인분' };
      for (const k of ['g', ...NUTRI_KEYS]) { const v = +f?.[k]; o[k] = Number.isFinite(v) && v >= 0 ? Math.min(v, 99999) : 0; }
      const q = +f?.qty; o.qty = Number.isFinite(q) && q > 0 ? Math.min(q, 20) : 1;
      o.box = clampBox(f?.box);
      o.alts = [...new Set((Array.isArray(f?.alts) ? f.alts : []).map(a => cleanStr(a)).filter(a => a && a !== o.name))].slice(0, 3);
      return o;
    });
  }

  // ---------- blood pressure ----------
  const bpValid = (sys, dia, pulse) => sys >= 60 && sys <= 260 && dia >= 30 && dia <= 160 && sys > dia && pulse >= 30 && pulse <= 220;
  // Averages of all / morning (04–11 h) / evening (18–03 h) readings.
  function bpStats(list) {
    const avg = g => g.length ? { n: g.length, sys: Math.round(g.reduce((s, x) => s + x.sys, 0) / g.length), dia: Math.round(g.reduce((s, x) => s + x.dia, 0) / g.length), pulse: Math.round(g.reduce((s, x) => s + x.pulse, 0) / g.length) } : null;
    const h = x => new Date(x.t).getHours();
    return { all: avg(list), morning: avg(list.filter(x => h(x) >= 4 && h(x) < 12)), evening: avg(list.filter(x => h(x) >= 18 || h(x) < 4)) };
  }

  // ---------- streak & missions ----------
  const hasRecord = d => !!d && (Object.values(d.meals || {}).some(m => m.length) || d.weight || (d.workouts || []).length || d.water || d.condition || d.sleep);
  // Consecutive days with a record (or a shield) ending today; today still counts if it's empty but yesterday kept the streak.
  function streak(days, today, shielded = []) {
    const ok = d => hasRecord(days[d]) || shielded.includes(d);
    let d = ok(today) ? today : addDays(today, -1), n = 0;
    while (ok(d)) { n++; d = addDays(d, -1); }
    return n;
  }
  // [id, label, points, check(ctx)] — ctx: {t, tg, day, steps, waterGoal, stepGoal, supps (due today), suppDone}.
  const MISSIONS = [
    ['kcal', '목표 칼로리 지키기', 3, c => c.t.kcal >= c.tg.kcal * 0.9 && c.t.kcal <= c.tg.kcal * 1.1],
    ['protein', '단백질 목표의 80% 먹기', 3, c => c.t.protein >= c.tg.protein * 0.8],
    ['meals3', '세 끼 모두 기록하기', 2, c => ['breakfast', 'lunch', 'dinner'].every(m => (c.day.meals?.[m] || []).length || c.day.skipped?.[m])],
    ['water', '물 목표량 마시기', 2, c => (c.day.water || 0) >= c.waterGoal],
    ['steps', '걸음 목표 달성하기', 3, c => (c.day.steps || 0) >= c.stepGoal],
    ['workout', '운동 30분 이상 하기', 3, c => (c.day.workouts || []).reduce((s, w) => s + (w.min || 0), 0) >= 30],
    ['sugar', '당류 제한 지키기', 2, c => c.t.kcal > 0 && c.t.sugar <= c.tg.limit.sugar],
    ['sodium', '나트륨 2,000mg 이하', 2, c => c.t.kcal > 0 && c.t.sodium <= c.tg.limit.sodium],
    ['sleep', '자정 전에 잠들기', 2, c => !!c.day.sleep && hmToMin(c.day.sleep.bed) >= 18 * 60],
    ['supp', '영양제 모두 챙겨 먹기', 2, c => c.supps > 0 && c.suppDone >= c.supps],
    ['weigh', '체중 기록하기', 1, c => !!c.day.weight],
    ['condition', '컨디션 기록하기', 1, c => !!c.day.condition],
    ['class', '오늘의 수업 1개 마치기', 2, c => (c.classes || 0) >= 1],
  ].map(([id, label, pts, check]) => ({ id, label, pts, check }));
  // Deterministic pick of 5 missions per date (supplement mission only if the user has supplements).
  function dailyMissions(dateStr, hasSupps) {
    const hash = str => { let h = 0; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
    const pool = MISSIONS.filter(m => m.id !== 'supp' || hasSupps);
    const fixed = pool.filter(m => m.id === 'kcal' || m.id === 'meals3');
    const rest = pool.filter(m => !fixed.includes(m)).sort((a, b) => hash(dateStr + a.id) - hash(dateStr + b.id));
    return fixed.concat(rest.slice(0, 3));
  }
  const level = xp => Math.floor(xp / 100) + 1;

  // Broken streak that can still be revived: the missed days right before today (newest first, at most maxMissed)
  // and the streak length that ended just before them. null when the streak is alive or too long gone.
  function reviveGap(days, today, shielded = [], maxMissed = 2) {
    const ok = d => hasRecord(days[d]) || shielded.includes(d);
    const missed = [];
    let d = addDays(today, -1);
    while (!ok(d) && missed.length <= maxMissed) { missed.push(d); d = addDays(d, -1); }
    if (!missed.length || missed.length > maxMissed) return null;
    let before = 0;
    while (ok(d)) { before++; d = addDays(d, -1); }
    return before ? { missed, before } : null;
  }
  // [days, reward points]; each milestone pays out once.
  const STREAK_MILESTONES = [[7, 20], [30, 50], [100, 150], [365, 500]];
  // Monthly missions over ctx: {loggedDays, classes, weighs, workouts}.
  const MONTHLY = [
    ['days20', '이번 달 20일 기록하기', 30, c => c.loggedDays >= 20],
    ['class10', '수업 10개 마치기', 30, c => c.classes >= 10],
    ['weigh8', '체중 8번 기록하기', 20, c => c.weighs >= 8],
    ['workout12', '운동 12번 하기', 30, c => c.workouts >= 12],
  ].map(([id, label, pts, check]) => ({ id, label, pts, check }));
  // Month 'YYYY-MM' stats; classLog = { 'YYYY-MM-DD': [lessonIds finished that day, repeats included] }.
  function monthStats(days, month, classLog = {}) {
    const ds = Object.keys(days).filter(d => d.startsWith(month));
    return {
      loggedDays: ds.filter(d => hasRecord(days[d])).length,
      weighs: ds.filter(d => days[d].weight).length,
      workouts: ds.reduce((s, d) => s + (days[d].workouts || []).length, 0),
      classes: Object.entries(classLog).filter(([d]) => d.startsWith(month)).reduce((s, [, ids]) => s + ids.length, 0),
    };
  }
  // Up to n lessons for a date, unfinished first, in a stable per-date order.
  function dailyLessons(dateStr, ids, done = {}, n = 3) {
    const hash = str => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
    const order = ids.slice().sort((a, b) => hash(dateStr + a) - hash(dateStr + b));
    const todayDone = order.filter(id => done[id] === dateStr);
    const fresh = order.filter(id => !done[id]);
    const old = order.filter(id => done[id] && done[id] !== dateStr);
    return todayDone.concat(fresh, old).slice(0, n);
  }

  // ---------- walking: challenges, step checks, GPS, pedometer ----------
  // kind 'daily': every day ≥ goal; 'total': the sum over the period ≥ goal.
  const CHALLENGES = [
    ['d3_5k', '👟', '3일 연속 5,000보', 'daily', 3, 5000, 15],
    ['d7_6k', '🚶', '7일 동안 매일 6,000보', 'daily', 7, 6000, 50],
    ['w50k', '🗓️', '7일 동안 5만 보', 'total', 7, 50000, 40],
    ['d7_10k', '🔥', '7일 동안 매일 10,000보', 'daily', 7, 10000, 100],
    ['d14_8k', '🏔️', '14일 동안 매일 8,000보', 'daily', 14, 8000, 120],
    ['m200k', '🏆', '30일 동안 20만 보', 'total', 30, 200000, 150],
  ].map(([id, emoji, title, kind, days, goal, pts]) => ({ id, emoji, title, kind, days, goal, pts }));
  // Progress of a challenge started on `start`; stepsOf(date) → counted steps.
  function challengeStatus(ch, start, today, stepsOf) {
    const dates = Array.from({ length: ch.days }, (_, i) => addDays(start, i)), end = dates.at(-1);
    const upTo = dates.filter(d => d <= today), vals = upTo.map(stepsOf);
    const total = vals.reduce((s, v) => s + v, 0), doneDays = vals.filter(v => v >= ch.goal).length;
    let state = 'active', progress;
    if (ch.kind === 'daily') {
      progress = doneDays / ch.days;
      const missed = upTo.some((d, i) => d < today && vals[i] < ch.goal);
      if (missed) state = 'failed';
      else if (doneDays === ch.days) state = 'success';
      else if (end < today) state = 'failed';
    } else {
      progress = Math.min(1, total / ch.goal);
      if (total >= ch.goal) state = 'success';
      else if (end < today) state = 'failed';
    }
    const dayIndex = Math.min(ch.days, upTo.length);
    return { dates, end, total, doneDays, progress, state, dayIndex, daysLeft: Math.max(0, ch.days - dayIndex) };
  }

  // Days above STEP_MAX are not plausible for a person; they are flagged and capped in rankings and challenges.
  const STEP_MAX = 60000;
  const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  // 'over' above STEP_MAX; 'spike' when ≥ 25,000 and over 4× the median of the previous 28 recorded days.
  function stepFlag(days, d) {
    const v = days[d]?.steps || 0;
    if (v > STEP_MAX) return 'over';
    if (v < 25000) return null;
    const prev = dateRange(addDays(d, -28), addDays(d, -1)).map(x => days[x]?.steps || 0).filter(x => x > 0);
    return prev.length >= 7 && v > 4 * median(prev) ? 'spike' : null;
  }
  const countedSteps = (days, d) => Math.min(days[d]?.steps || 0, STEP_MAX);
  function stepReport(days, dates, goal) {
    const rows = dates.map(d => ({ d, steps: days[d]?.steps || 0, flag: stepFlag(days, d), src: days[d]?.stepSrc || null }));
    const rec = rows.filter(r => r.steps > 0), total = rec.reduce((s, r) => s + Math.min(r.steps, STEP_MAX), 0);
    const best = rec.reduce((a, r) => (!a || r.steps > a.steps ? r : a), null);
    return { rows, total, avg: rec.length ? Math.round(total / rec.length) : 0, recordedDays: rec.length, goalDays: rec.filter(r => r.steps >= goal).length,
      best, flagged: rows.filter(r => r.flag) };
  }
  const csvCell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const stepCSV = rep => ['날짜,걸음수,출처,확인 필요'].concat(rep.rows.map(r => [r.d, r.steps, r.src || '', { over: '하루 최대치 초과', spike: '평소보다 급증' }[r.flag] || ''].map(csvCell).join(','))).join('\n');

  // Great-circle distance in meters.
  // GPS points [{lat, lon, t(ms), acc(m)}] → walking distance. Drops inaccurate fixes, jitter under 3 m,
  // and segments faster than maxSpeed (m/s; a vehicle), which also stops pausing from counting as moving time.
  function trackStats(points, { maxAcc = 50, maxSpeed = 7, pauseGap = 60000 } = {}) {
    const pts = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && (p.acc == null || p.acc <= maxAcc));
    const fast = (a, b) => { const dt = (b.t - a.t) / 1000; return dt > 0 && haversine(a, b) / dt > maxSpeed; };
    // A too-fast fix is held as `suspect`: if the next fix continues from `last` it was a glitch and is dropped;
    // if it continues from the suspect, the person really moved (e.g. by car) and that stretch is skipped.
    let dist = 0, moving = 0, dropped = 0, last = pts[0], suspect = null;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p.t <= last.t) continue;
      if (fast(last, p)) {
        if (suspect && !fast(suspect, p)) { last = suspect; suspect = null; if (p.t <= last.t) continue; }
        else { dropped++; suspect = p; continue; }
      } else suspect = null;
      const dt = (p.t - last.t) / 1000, d = haversine(last, p);
      if (d < 3) continue; // jitter while standing still: wait for real movement
      // A long gap (screen off) counts only if it still looks like walking (≥ 0.5 m/s); otherwise it was a stop,
      // and adding its distance without its time would inflate speed and calories.
      if (dt * 1000 > pauseGap && d / dt < 0.5) { last = p; continue; }
      dist += d; moving += dt;
      last = p;
    }
    return { distM: Math.round(dist), movingSec: Math.round(moving), kept: pts.length, dropped, rejected: points.length - pts.length };
  }
  // Step length ≈ 41.5% of height walking, 65% running (common rule of thumb).
  const strideM = (heightCm, run = false) => heightCm / 100 * (run ? 0.65 : 0.415);
  const gpsSteps = (distM, heightCm, run = false) => Math.round(distM / strideM(heightCm || 165, run));
  // MET by speed (km/h), from the Compendium of Physical Activities ranges.

  // Accelerometer step counter. feed(t ms, |a| m/s² including gravity) → true when a step is counted.
  // A step is a peak of the smoothed signal above the running mean + threshold, 250–2000 ms after the last one;
  // the first 4 rhythmic peaks are held back and only counted once walking is confirmed, so shaking the phone doesn't count.
  function stepDetector({ threshold = 1.2, minGap = 250, maxGap = 2000, confirm = 4 } = {}) {
    let ema = null, mean = 9.8, prev = null, rising = false, lastPeak = 0, pending = 0, walking = false, steps = 0;
    return {
      get steps() { return steps; }, get walking() { return walking; },
      feed(t, mag) {
        ema = ema == null ? mag : ema + 0.35 * (mag - ema);
        mean += 0.02 * (ema - mean);
        let counted = false;
        if (prev != null) {
          if (ema > prev) rising = true;
          else if (rising && ema < prev) {
            rising = false;
            if (prev > mean + threshold) {
              const gap = t - lastPeak;
              if (gap >= minGap) {
                if (gap <= maxGap && lastPeak) {
                  if (walking) { steps++; counted = true; }
                  else if (++pending >= confirm) { walking = true; steps += pending + 1; pending = 0; counted = true; }
                } else { walking = false; pending = 0; }
                lastPeak = t;
              }
            }
          }
        }
        prev = ema;
        return counted;
      },
    };
  }

  // ---------- barcode (Open Food Facts) ----------
  // Maps an Open Food Facts product to an app food (per serving when the label gives one, else per 100g/ml).
  function offToFood(code, p) {
    if (!p || typeof p !== 'object') return null;
    const n = p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {};
    const f = v => { const x = +v; return Number.isFinite(x) && x >= 0 ? x : 0; }; // network data: drop junk and negatives
    const sq = Math.min(f(p.serving_quantity), 5000);
    const perServing = sq > 0 && (n['energy-kcal_serving'] != null || n['energy-kcal_100g'] != null);
    const pick = k => perServing ? (n[k + '_serving'] != null ? f(n[k + '_serving']) : f(n[k + '_100g']) * sq / 100) : f(n[k + '_100g']);
    let kcal = pick('energy-kcal');
    if (!kcal) kcal = (perServing ? (f(n['energy_serving']) || f(n['energy_100g']) * sq / 100) : f(n['energy_100g'])) / 4.184;
    const str = v => typeof v === 'string' ? v : '';
    const brand = str(p.brands).split(',')[0].trim(), pname = (str(p.product_name_ko) || str(p.product_name)).trim();
    const name = brand && !pname.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${pname}`.trim() : pname || brand;
    if (!name && !kcal) return null;
    return {
      name: (name || `바코드 ${code}`).slice(0, 40), barcode: String(code),
      serving: perServing ? (str(p.serving_size) || `${sq}g`).slice(0, 20) : '100g', g: perServing ? sq : 100,
      kcal: Math.round(kcal), carb: r1(pick('carbohydrates')), protein: r1(pick('proteins')), fat: r1(pick('fat')),
      sugar: r1(pick('sugars')), satFat: r1(pick('saturated-fat')), sodium: Math.round(pick('sodium') * 1000),
    };
  }
  // One key per product: UPC-A (12 digits) becomes its EAN-13 form with a leading 0, as Open Food Facts stores it.
  const normBarcode = code => { const s = String(code).trim(); return /^\d{12}$/.test(s) ? '0' + s : s; };
  // EAN-13 / EAN-8 / UPC-A check digit.
  function validBarcode(code) {
    const s = String(code).trim();
    if (!/^(\d{8}|\d{12}|\d{13})$/.test(s)) return false;
    const digits = s.split('').map(Number), check = digits.pop();
    const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - sum % 10) % 10 === check;
  }

  // ---------- lifestyle habits & habit missions ----------
  // Lifestyle l = { smoke: 'never'|'quit'|'now', cigs: per day, drink: times per week, exercise: sessions in the last week, chronic: [CHRONIC ids] }.
  const CHRONIC = [['htn', '고혈압'], ['dm', '당뇨 · 당뇨 전단계'], ['lipid', '이상지질혈증'], ['liver', '지방간'], ['gout', '통풍'], ['gerd', '역류성 식도염']]
    .map(([id, label]) => ({ id, label }));
  // [id, label, points, fits(l)] — self-reported daily missions, suggested in this order from the lifestyle answers.
  const HABIT_MISSIONS = [
    ['nodrink', '오늘은 술 마시지 않기', 3, l => l.drink >= 2],
    ['cigless', '담배를 평소보다 한 개비 덜 피우기', 3, l => l.smoke === 'now'],
    ['cardio', '숨이 찰 만큼 30분 걷거나 뛰기', 3, l => l.exercise < 3],
    ['strength', '근력 운동 15분 하기', 3, l => l.exercise < 2],
    ['broth', '국 · 찌개 국물 남기기', 2, l => l.chronic.includes('htn')],
    ['walkmeal', '식사 뒤 10분 걷기', 2, l => l.chronic.includes('dm')],
    ['nofry', '튀김 대신 굽거나 찐 요리 고르기', 2, l => l.chronic.includes('lipid') || l.chronic.includes('liver')],
    ['nosweet', '단 음료 대신 물이나 차 마시기', 2, l => l.chronic.includes('dm') || l.chronic.includes('liver')],
    ['purine', '내장 · 젓갈 · 맥주 피하기', 2, l => l.chronic.includes('gout')],
    ['late', '잠들기 3시간 전부터 먹지 않기', 2, l => l.chronic.includes('gerd')],
    ['veg', '끼니마다 채소 반찬 한 가지 먹기', 2, () => true],
  ].map(([id, label, pts, fits]) => ({ id, label, pts, fits }));
  const HABIT_MAX = 3;
  const habitRecommend = l => l ? HABIT_MISSIONS.filter(m => m.fits(l)).slice(0, HABIT_MAX) : [];
  // Picked missions hm = { ids, prev, from }: the new set takes effect on `from`, `prev` stays active before that.
  function habitActive(hm, date) {
    if (!hm) return [];
    const ids = (date >= hm.from ? hm.ids : hm.prev) || []; // tolerate partial synced/imported data
    return HABIT_MISSIONS.filter(m => ids.includes(m.id));
  }
  // With nothing active today the pick starts today; otherwise it starts tomorrow (today's missions stay as they were).
  function habitPick(hm, ids, today) {
    ids = HABIT_MISSIONS.filter(m => ids.includes(m.id)).slice(0, HABIT_MAX).map(m => m.id);
    const now = habitActive(hm, today).map(m => m.id);
    return now.length ? { ids, prev: now, from: addDays(today, 1) } : { ids, prev: [], from: today };
  }
  function lifestyleText(l) {
    const smoke = { never: '담배 안 피움', quit: '담배 끊음', now: `담배 하루 ${l.cigs}개비` }[l.smoke];
    const chronic = CHRONIC.filter(c => l.chronic.includes(c.id)).map(c => c.label);
    return [smoke, l.drink ? `술 주 ${l.drink}회` : '술 안 마심', `운동 최근 1주 ${l.exercise}회`, chronic.length ? '만성질환: ' + chronic.join(', ') : '만성질환 없음'].join(' · ');
  }

  // ---------- weekly / monthly stats ----------
  // Dates in [from, to] inclusive.
  function dateRange(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
  function periodDiet(days, dates, targetFor) {
    const rows = dates.map(d => ({ d, t: days[d] ? dayTotals(days[d]) : null, target: targetFor(d) }));
    const logged = rows.filter(r => r.t && r.t.kcal > 0);
    const avg = k => logged.length ? Math.round(logged.reduce((s, r) => s + r.t[k], 0) / logged.length) : 0;
    const foods = Object.create(null); // keyed by user/AI-supplied food names, e.g. '__proto__'
    for (const d of dates) for (const f of Object.values(days[d]?.meals || {}).flat()) {
      const k = f.name; foods[k] = foods[k] || { name: k, kcal: 0, n: 0 }; foods[k].kcal += f.kcal * (f.qty ?? 1); foods[k].n++;
    }
    return {
      rows, loggedDays: logged.length, avgKcal: avg('kcal'), avgTarget: logged.length ? Math.round(logged.reduce((s, r) => s + r.target, 0) / logged.length) : 0,
      cheatDays: logged.filter(r => isCheatDay(r.t.kcal, r.target)).length,
      macro: { carb: avg('carb'), protein: avg('protein'), fat: avg('fat') },
      top5: Object.values(foods).sort((a, b) => b.kcal - a.kcal).slice(0, 5).map(f => ({ ...f, kcal: Math.round(f.kcal) })),
    };
  }
  // Weekly muscle load: sets per exercise category.
  function muscleLoad(days, dates) {
    const out = Object.fromEntries(EX_CATS.map(c => [c, 0]));
    for (const d of dates) for (const w of days[d]?.workouts || []) for (const ex of w.items || []) out[ex.cat] = (out[ex.cat] || 0) + (ex.kind === 'time' ? 1 : ex.sets.length);
    return out;
  }

  const api = {
    FOODS, NUTRI_KEYS, ACTIVITY, EXERCISES, EX_CATS, INTENSITY, MEALS, MEAL_SHARE, DIET_TYPES, PRODUCTS, CHECKUP, JUDGE_LABEL,
    NUTRIENTS, NUTRIENT_INFO, SUPP_TIMES, SUPP_PRESETS, FAST_STAGES, SLEEP_TAGS, GLP_DRUGS, INJ_SITES, GLP_SIDE, MISSIONS,
    bmr, tdee, goalKcal, goalKcalOn, macroTargets, nutrientTargets, workoutKcal, stepsKcal, exMinutes, exVolume, sessionKcal,
    sumFoods, dayTotals, dietScore, scoreMessage, mealFeedback, dayReport, targetGuide, weeksToGoal, rangeStatus, limitStatus, topFood, isCheatDay,
    glucoseStatus, bmi, ymd, addDays, searchFoods, weekStart, timeInRange, shopLinks, parseCSV, parseTime, importCSV, importAppleXML,
    weightTrend, hmToMin, clockDiff, sleepScore, sleepHours, fastStage, nextFastWindow, routinesOverlap, periodStats,
    glpLevel, nextDose, nextSite, suppClock, suppCode, suppTimeFields, suppDue, suppDayRate, suppDaily, suppMonth, suppAnalysis, mealSpike, glucoseScore, hasRecord, streak, dailyMissions, level,
    dateRange, periodDiet, muscleLoad, reviveGap, STREAK_MILESTONES, MONTHLY, monthStats, dailyLessons, offToFood, validBarcode, normBarcode,
    CHRONIC, HABIT_MISSIONS, HABIT_MAX, habitRecommend, habitActive, habitPick, lifestyleText,
    DX_TYPES, DX_TARGET, TG_MIN, TG_MAX, validTarget, clampTarget, glucoseTarget, glucoseReport, tirBands, glucoseStats, cgmCoverage, agp, nearestReading, carbCompare,
    EAT_GROUPS, eatGroup, eatingOrder, clampBox, cleanPhotoFoods, bpValid, bpStats,
    CHALLENGES, challengeStatus, STEP_MAX, stepFlag, countedSteps, stepReport, stepCSV, haversine, trackStats, strideM, gpsSteps, speedMet, stepDetector,
  };
  if (typeof module !== 'undefined') module.exports = api; else root.Core = api;
})(this);
