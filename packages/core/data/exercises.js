// Exercise library (written for this app). Loaded as a classic script in the browser and via require() in tests.
// Row: [id, name, primary muscles, secondary muscles, equipment, kind, MET, joints used, isolation 0|1]
// kind: weight = kg × reps, reps = bodyweight reps, time = seconds, distance = meters (+ seconds).
// joints are only used to leave exercises out of a plan when the user marks that area as painful.
(function (root) {
  const MUSCLES = {
    chest: '가슴', lats: '광배', upperBack: '등 위쪽', lowBack: '허리 근육', frontDelt: '어깨 앞', sideDelt: '어깨 옆', rearDelt: '어깨 뒤',
    biceps: '이두', triceps: '삼두', forearms: '전완', abs: '복근', obliques: '옆구리', glutes: '엉덩이', quads: '허벅지 앞',
    hamstrings: '허벅지 뒤', adductors: '허벅지 안쪽', calves: '종아리',
  };
  const LOWER = ['glutes', 'quads', 'hamstrings', 'adductors', 'calves', 'lowBack'];
  const EQUIP = { barbell: '바벨', dumbbell: '덤벨', machine: '머신', cable: '케이블', kettlebell: '케틀벨', bodyweight: '맨몸', other: '기타' };
  const JOINTS = { neck: '목', shoulder: '어깨', elbow: '팔꿈치', wrist: '손목', lowback: '허리', hip: '고관절', knee: '무릎', ankle: '발목' };
  const KINDS = { weight: '무게×횟수', reps: '횟수', time: '시간', distance: '거리' };

  const ROWS = [
    // chest
    ['bench_bb', '바벨 벤치프레스', 'chest', 'triceps,frontDelt', 'barbell', 'weight', 5, 'shoulder,elbow,wrist', 0],
    ['incline_bb', '인클라인 바벨 프레스', 'chest,frontDelt', 'triceps', 'barbell', 'weight', 5, 'shoulder,elbow,wrist', 0],
    ['bench_db', '덤벨 벤치프레스', 'chest', 'triceps,frontDelt', 'dumbbell', 'weight', 5, 'shoulder,elbow', 0],
    ['incline_db', '인클라인 덤벨 프레스', 'chest,frontDelt', 'triceps', 'dumbbell', 'weight', 5, 'shoulder,elbow', 0],
    ['chest_press_m', '머신 체스트 프레스', 'chest', 'triceps,frontDelt', 'machine', 'weight', 4.5, 'shoulder,elbow', 0],
    ['pushup', '푸시업', 'chest', 'triceps,frontDelt,abs', 'bodyweight', 'reps', 3.8, 'shoulder,wrist,elbow', 0],
    ['dips', '평행봉 딥스', 'chest,triceps', 'frontDelt', 'bodyweight', 'reps', 4, 'shoulder,elbow', 0],
    ['fly_db', '덤벨 플라이', 'chest', 'frontDelt', 'dumbbell', 'weight', 3.5, 'shoulder', 1],
    ['cable_cross', '케이블 크로스오버', 'chest', 'frontDelt', 'cable', 'weight', 3.5, 'shoulder', 1],
    ['pec_deck', '머신 플라이', 'chest', '', 'machine', 'weight', 3.5, 'shoulder', 1],
    // back
    ['deadlift', '데드리프트', 'hamstrings,glutes,lowBack', 'lats,upperBack,forearms,quads', 'barbell', 'weight', 6, 'lowback,hip,knee', 0],
    ['row_bb', '바벨 로우', 'lats,upperBack', 'biceps,rearDelt,lowBack', 'barbell', 'weight', 5, 'lowback,elbow', 0],
    ['row_db', '원암 덤벨 로우', 'lats,upperBack', 'biceps,rearDelt', 'dumbbell', 'weight', 4.5, 'elbow', 0],
    ['tbar_row', '티바 로우', 'upperBack,lats', 'biceps,lowBack', 'barbell', 'weight', 5, 'lowback,elbow', 0],
    ['seated_row', '시티드 케이블 로우', 'upperBack,lats', 'biceps,rearDelt', 'cable', 'weight', 4.5, 'elbow', 0],
    ['machine_row', '머신 로우', 'upperBack,lats', 'biceps', 'machine', 'weight', 4.5, 'elbow', 0],
    ['pulldown', '랫풀다운', 'lats', 'biceps,upperBack', 'cable', 'weight', 4.5, 'shoulder,elbow', 0],
    ['pullup', '풀업', 'lats', 'biceps,upperBack,forearms', 'bodyweight', 'reps', 5, 'shoulder,elbow', 0],
    ['chinup', '친업', 'lats,biceps', 'upperBack', 'bodyweight', 'reps', 5, 'shoulder,elbow,wrist', 0],
    ['inverted_row', '인버티드 로우', 'upperBack,lats', 'biceps,rearDelt', 'bodyweight', 'reps', 4, 'elbow', 0],
    ['straight_pulldown', '스트레이트 암 풀다운', 'lats', 'triceps', 'cable', 'weight', 3.5, 'shoulder', 1],
    ['shrug_db', '덤벨 슈러그', 'upperBack', 'forearms', 'dumbbell', 'weight', 3.5, 'neck', 1],
    ['back_ext', '백 익스텐션', 'lowBack', 'glutes,hamstrings', 'bodyweight', 'reps', 3.5, 'lowback', 1],
    ['face_pull', '페이스 풀', 'rearDelt,upperBack', '', 'cable', 'weight', 3.5, 'shoulder', 1],
    // shoulders
    ['ohp_bb', '바벨 오버헤드 프레스', 'frontDelt', 'triceps,sideDelt,abs', 'barbell', 'weight', 5, 'shoulder,elbow,lowback', 0],
    ['ohp_db', '덤벨 숄더 프레스', 'frontDelt,sideDelt', 'triceps', 'dumbbell', 'weight', 5, 'shoulder,elbow', 0],
    ['shoulder_press_m', '머신 숄더 프레스', 'frontDelt,sideDelt', 'triceps', 'machine', 'weight', 4.5, 'shoulder,elbow', 0],
    ['pike_pushup', '파이크 푸시업', 'frontDelt', 'triceps,upperBack', 'bodyweight', 'reps', 4, 'shoulder,wrist', 0],
    ['upright_row', '업라이트 로우', 'sideDelt,upperBack', 'biceps', 'barbell', 'weight', 4, 'shoulder,wrist', 0],
    ['lateral_db', '덤벨 사이드 레이즈', 'sideDelt', '', 'dumbbell', 'weight', 3.5, 'shoulder', 1],
    ['lateral_cable', '케이블 사이드 레이즈', 'sideDelt', '', 'cable', 'weight', 3.5, 'shoulder', 1],
    ['front_raise', '프런트 레이즈', 'frontDelt', '', 'dumbbell', 'weight', 3.5, 'shoulder', 1],
    ['rear_fly_db', '벤트오버 리어 플라이', 'rearDelt', 'upperBack', 'dumbbell', 'weight', 3.5, 'shoulder,lowback', 1],
    ['reverse_fly_m', '머신 리어 플라이', 'rearDelt', 'upperBack', 'machine', 'weight', 3.5, 'shoulder', 1],
    // arms
    ['curl_bb', '바벨 컬', 'biceps', 'forearms', 'barbell', 'weight', 3.5, 'elbow,wrist', 1],
    ['curl_db', '덤벨 컬', 'biceps', 'forearms', 'dumbbell', 'weight', 3.5, 'elbow', 1],
    ['hammer_curl', '해머 컬', 'biceps,forearms', '', 'dumbbell', 'weight', 3.5, 'elbow', 1],
    ['preacher_curl', '프리처 컬', 'biceps', '', 'machine', 'weight', 3.5, 'elbow', 1],
    ['cable_curl', '케이블 컬', 'biceps', 'forearms', 'cable', 'weight', 3.5, 'elbow', 1],
    ['pushdown', '케이블 푸시다운', 'triceps', '', 'cable', 'weight', 3.5, 'elbow', 1],
    ['skullcrusher', '라잉 트라이셉스 익스텐션', 'triceps', '', 'barbell', 'weight', 3.5, 'elbow', 1],
    ['oh_ext_db', '덤벨 오버헤드 익스텐션', 'triceps', '', 'dumbbell', 'weight', 3.5, 'elbow,shoulder', 1],
    ['cgbp', '좁은 그립 벤치프레스', 'triceps,chest', 'frontDelt', 'barbell', 'weight', 5, 'elbow,wrist,shoulder', 0],
    ['bench_dips', '벤치 딥스', 'triceps', 'frontDelt', 'bodyweight', 'reps', 3.8, 'shoulder,wrist,elbow', 1],
    ['wrist_curl', '리스트 컬', 'forearms', '', 'dumbbell', 'weight', 3, 'wrist', 1],
    ['farmer_walk', '파머스 워크', 'forearms,upperBack', 'glutes,quads,abs', 'dumbbell', 'distance', 6, 'wrist,lowback', 0],
    // legs
    ['squat_bb', '바벨 백 스쿼트', 'quads,glutes', 'hamstrings,lowBack,adductors', 'barbell', 'weight', 5.5, 'knee,hip,lowback', 0],
    ['front_squat', '프런트 스쿼트', 'quads', 'glutes,abs', 'barbell', 'weight', 5.5, 'knee,wrist,lowback', 0],
    ['sumo_dl', '스모 데드리프트', 'glutes,quads,adductors', 'hamstrings,lowBack', 'barbell', 'weight', 6, 'hip,knee,lowback', 0],
    ['rdl', '루마니안 데드리프트', 'hamstrings,glutes', 'lowBack', 'barbell', 'weight', 5, 'lowback,hip', 0],
    ['rdl_db', '덤벨 루마니안 데드리프트', 'hamstrings,glutes', 'lowBack', 'dumbbell', 'weight', 5, 'lowback,hip', 0],
    ['goblet_squat', '고블릿 스쿼트', 'quads,glutes', 'abs,adductors', 'dumbbell', 'weight', 5, 'knee,hip', 0],
    ['leg_press', '레그 프레스', 'quads,glutes', 'hamstrings', 'machine', 'weight', 5, 'knee,hip', 0],
    ['hack_squat', '핵 스쿼트', 'quads', 'glutes', 'machine', 'weight', 5, 'knee', 0],
    ['lunge_db', '덤벨 런지', 'quads,glutes', 'hamstrings,adductors', 'dumbbell', 'weight', 4.5, 'knee,hip,ankle', 0],
    ['split_squat', '스플릿 스쿼트(뒷발 올림)', 'quads,glutes', 'adductors', 'dumbbell', 'weight', 4.5, 'knee,hip,ankle', 0],
    ['step_up', '스텝업', 'quads,glutes', 'calves', 'dumbbell', 'weight', 4.5, 'knee,ankle', 0],
    ['hip_thrust', '바벨 힙 쓰러스트', 'glutes', 'hamstrings', 'barbell', 'weight', 4.5, 'hip', 0],
    ['glute_bridge', '글루트 브리지', 'glutes', 'hamstrings', 'bodyweight', 'reps', 3.5, 'hip', 0],
    ['kb_swing', '케틀벨 스윙', 'glutes,hamstrings', 'lowBack,frontDelt', 'kettlebell', 'weight', 6, 'lowback,hip', 0],
    ['bw_squat', '맨몸 스쿼트', 'quads,glutes', 'hamstrings', 'bodyweight', 'reps', 4, 'knee,hip', 0],
    ['leg_ext', '레그 익스텐션', 'quads', '', 'machine', 'weight', 3.5, 'knee', 1],
    ['leg_curl', '레그 컬', 'hamstrings', 'calves', 'machine', 'weight', 3.5, 'knee', 1],
    ['adduction_m', '머신 이너 타이', 'adductors', '', 'machine', 'weight', 3.5, 'hip', 1],
    ['abduction_m', '머신 아우터 타이', 'glutes', '', 'machine', 'weight', 3.5, 'hip', 1],
    ['calf_raise', '스탠딩 카프 레이즈', 'calves', '', 'machine', 'weight', 3.5, 'ankle', 1],
    ['seated_calf', '시티드 카프 레이즈', 'calves', '', 'machine', 'weight', 3.5, 'ankle', 1],
    // core
    ['plank', '플랭크', 'abs', 'obliques,lowBack', 'bodyweight', 'time', 3.8, 'shoulder', 1],
    ['side_plank', '사이드 플랭크', 'obliques', 'abs', 'bodyweight', 'time', 3.8, 'shoulder', 1],
    ['crunch', '크런치', 'abs', '', 'bodyweight', 'reps', 3.8, 'neck', 1],
    ['hanging_raise', '매달려 다리 들기', 'abs', 'obliques,forearms', 'bodyweight', 'reps', 4, 'shoulder,wrist', 1],
    ['lying_raise', '누워서 다리 들기', 'abs', '', 'bodyweight', 'reps', 3.8, 'lowback', 1],
    ['cable_crunch', '케이블 크런치', 'abs', 'obliques', 'cable', 'weight', 3.5, 'lowback', 1],
    ['russian_twist', '러시안 트위스트', 'obliques', 'abs', 'bodyweight', 'reps', 3.8, 'lowback', 1],
    ['ab_rollout', '복근 롤아웃', 'abs', 'lats', 'other', 'reps', 4, 'lowback,shoulder', 1],
    ['dead_bug', '데드버그', 'abs', '', 'bodyweight', 'reps', 3, '', 1],
    ['pallof', '케이블 버티기 프레스', 'obliques,abs', '', 'cable', 'weight', 3, '', 1],
    // cardio / conditioning
    ['run', '달리기', '', '', 'bodyweight', 'distance', 9.8, 'knee,ankle', 0],
    ['walk_fast', '빠르게 걷기', '', '', 'bodyweight', 'distance', 4.5, '', 0],
    ['treadmill', '러닝머신', '', '', 'machine', 'time', 8, 'knee,ankle', 0],
    ['bike', '실내 자전거', '', '', 'machine', 'time', 7, 'knee', 0],
    ['rower', '로잉머신', '', '', 'machine', 'time', 7, 'lowback', 0],
    ['stair', '계단 오르기 머신', '', '', 'machine', 'time', 8.8, 'knee,ankle', 0],
    ['jump_rope', '줄넘기', '', '', 'other', 'time', 11, 'ankle,knee', 0],
    ['burpee', '버피', 'quads,chest', 'abs,glutes', 'bodyweight', 'reps', 8, 'wrist,knee,shoulder', 0],
  ];
  const list = s => (s ? s.split(',') : []);
  const EXERCISES = ROWS.map(([id, name, p, s, equip, kind, met, j, iso]) =>
    ({ id, name, primary: list(p), secondary: list(s), equip, kind, met, joints: list(j), iso: !!iso }));

  const api = { MUSCLES, LOWER, EQUIP, JOINTS, KINDS, EXERCISES };
  if (typeof module !== 'undefined') module.exports = api; else root.ExerciseData = api;
})(this);
