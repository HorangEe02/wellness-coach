# 웰니스 AI 에이전트 설계

- 작성일: 2026-11-17
- 상태: 1단계(core 통합), 2단계(뼈대 그래프), 6단계 뼈대(안드로이드 껍데기 + WSL 서버) 완료
- 범위: 개인 프로젝트.

## 1. 목표

기존 개인 앱 세 개를 하나의 웰니스 AI 에이전트로 합친다. 각 앱의 기능은 모듈로 나누고, LangGraph로 연결한다.

| 원래 앱 | 영역 | 가져오는 것 |
|---|---|---|
| diet-coach | 식단·혈당·체중·영양제·습관 | 순수 함수 135개, Claude 인식·코치 프롬프트 |
| egg-kim-coach | 근력 운동 | 순수 함수 54개, 운동 종목 85개 |
| Pace-Coach | 걷기·등산·달리기, 코스 | 순수 함수 22개, 공공 코스 데이터 |

세 앱 모두 빌드 없는 바닐라 JS이고, 계산 로직은 DOM과 분리된 `core.js`에 테스트와 함께 있다. 이 계산 로직을 그대로 에이전트의 도구로 쓴다.

### 저장소와 자료

- 저장소는 이 저장소(`wellness-agent`) 하나만 쓴다. 원래 세 앱 폴더는 참고용 원본으로 두고 수정하지 않는다.
- 다른 프로젝트의 설계와 자료는 가져오지 않는다. 산책 코스 추천은 이 프로젝트에서 새로 설계한다.
- 공공데이터(두루누비, 숲길, 도시공원)는 사용해도 된다. API 키는 저장소에 넣지 않고 `.env`로 관리한다.

## 2. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 에이전트 | **LangGraph.js (TypeScript)** | 기존 `core.js`를 고치지 않고 import할 수 있다. Python을 쓰면 약 1,700줄을 옮겨 써야 한다. |
| 계산 로직 | `packages/core` (CommonJS/UMD JS) | 원래 코드와 테스트를 그대로 유지한다. 브라우저에서도 classic script로 불러올 수 있다. |
| 생성 모델 | **LFM3-1.7B** (Liquid AI, Ollama에서 로컬 실행) | 이 PC에서 돌아가고 도구 호출을 지원한다. 자세한 내용은 [MODELS.md](MODELS.md). |
| 결정 모델 | **d1-2B** (Liquid AI, Docker의 llama.cpp에서 로컬 실행). laya-multilingual은 비교용. 외부 API 모델은 쓰지 않음 | 라우팅과 안전 판정을 확률로 낸다. 생성하지 않으므로 지어낼 수 없다. |
| 저장 | 처음에는 SQLite 또는 파일, 나중에 Supabase | diet-coach에 Supabase 스키마가 이미 있다. 어댑터 하나로 바꿀 수 있게 한다. |
| 지도 | Leaflet + OSM, pmtiles | Pace-Coach 방식을 그대로 쓴다. |
| 화면 | 미정 (6단계에서 결정) | 기존 화면을 옮기거나 채팅 중심 화면 하나로 간다. 플로팅 챗봇이 후보. |
| 음성 | 미정 (7단계, 로컬 실행만) | STT·TTS 모두 이 PC 안에서 돌린다. 외부 음성 API는 쓰지 않는다. |

LangGraph.js의 세부 API는 2단계 구현 때 공식 문서로 확인한다.

## 3. 폴더 구조

```
wellness-agent/
├─ docs/DESIGN.md            이 문서
├─ packages/
│  ├─ core/                  [완료] 세 앱의 순수 로직
│  │  ├─ index.js            { shared, diet, strength, pace }
│  │  ├─ shared.js           세 앱에서 같던 함수
│  │  ├─ diet.core.js
│  │  ├─ strength.core.js
│  │  ├─ pace.core.js
│  │  ├─ data/exercises.js
│  │  └─ test/
│  ├─ agent/                 LangGraph 서버
│  │  ├─ state.ts            공유 상태 스키마
│  │  ├─ graph.ts            router + 도메인 노드 + coach 연결
│  │  ├─ modules/<도메인>/   tools.ts(core 감싸기), node.ts(라우팅·프롬프트)
│  │  ├─ vision/             사진·PDF 인식 (diet-coach ai.js의 askJSON과 스키마)
│  │  ├─ coach/              최종 응답 노드 (systemPrompt, contextSummary, memory)
│  │  └─ store/              저장소 어댑터
│  └─ web/                   화면
└─ data/                     durunubi.json, forest.json, parks.json
```

### core 통합 결과 (1단계)

이름이 겹치는 함수 11개를 비교했다. 실제로 같은 동작인 것만 `shared.js`로 합쳤다.

| 함수 | 원래 위치 | 처리 |
|---|---|---|
| `haversine`, `rad` | diet, pace | shared로 합침 |
| `speedMet` | diet, pace | shared로 합침 |
| `workoutKcal` | diet, strength | shared로 합침 |
| `ymd` | 세 앱 모두 | shared로 합침. diet 원래 구현과 결과가 같은지 테스트로 확인 |
| `weekStart` (ms 버전) | strength, pace | shared로 합침. diet의 문자열 버전은 diet에 남김 |
| `streak`, `sessionKcal`, `muscleLoad`, `parseCSV`, `importCSV`, `EXERCISES` | diet, strength | 이름만 같고 하는 일이 달라 각자 남김 |

이름이 같아도 동작이 다를 수 있으므로 항상 `core.diet.streak`, `core.strength.streak`처럼 앱 이름을 붙여 부른다.

## 4. 모듈 7개와 도구

도구는 `packages/core` 함수를 감싼 것이다. 숫자를 만드는 일은 모두 여기서 한다.

| 모듈 | 출처 | 도구 (core 함수) | LLM 사용 |
|---|---|---|---|
| **nutrition** | diet | `goalKcalOn`, `macroTargets`, `nutrientTargets`, `searchFoods`, `dayTotals`, `dietScore`, `mealFeedback`, `dayReport`, `eatingOrder`, `offToFood` | 음식 사진·글 인식, 영양정보 표 인식 |
| **metabolic** | diet | `glucoseReport`, `timeInRange`, `mealSpike`, `carbCompare`, `glucoseTarget`, `bpStats`, `nearestReading`, `fastStage`, `nextFastWindow`, `glpLevel`, `nextDose`, `nextSite` | 검진표 인식 |
| **body** | diet + strength 신체 기록 | `weightTrend`, `bmi`, `weeksToGoal`, `sleepScore`, `periodStats`, 둘레 기록 | 인바디 인식 |
| **strength** | strength 전체 | `genPlan`, `overload`, `linearNext`, `waveSets`, `waveAdvance`, `recovery`, `muscleSets`, `detectPRs`, `e1rm`, `warmupSets`, `platesFor`, `workoutScore`, `summary` | 운동 줄임말 해석 |
| **activity** | pace + diet 걷기 | `analyze`, `walkKcal`, `estSteps`, `courseMatch`, `routeAlert`, `nearestDist`, `parseGPX`, `toGPX`, `weekStats`, `challengeStatus`, `stepReport`, 새로 만들 `recommendCourse` | 없음 |
| **supplement** | diet | `suppDue`, `suppDayRate`, `suppMonth`, `suppAnalysis` | 라벨 인식 |
| **engagement** | diet | `streak`, `dailyMissions`, `level`, `reviveGap`, `habitRecommend`, `dailyLessons` | 없음 |

중복 기능은 한쪽만 쓴다.
- 운동 기록과 kcal은 strength 쪽을 쓴다. diet-coach의 `fitness.js`는 옮기지 않는다.
- 걷기 GPS 분석은 pace 쪽 `analyze`를 쓴다. diet-coach의 `walk.js`에서는 만보기와 걸음 챌린지만 가져온다.

### 함께 옮겨야 하는 화면 코드 속 로직

- egg-kim-coach `app.js:92-104`, `457-462`: 다음 운동 항목 만들기, 증량 제안 고르기, 프로그램 진행. `core.js`에 없으므로 strength 모듈로 옮긴다.
- diet-coach 화면 파일은 전역 `S`, `save()`, `day()`에 묶여 있다. 화면 로직을 옮길 때 이 전역을 공유 상태로 바꾼다.

## 5. 그래프 구조

```
사용자 입력 (글 / 사진 / 파일)
   ↓
[ingest]       사진·PDF면 vision으로 보내 기록 후보를 만든다.
               사용자가 확인한 뒤에만 저장한다 (interrupt).
   ↓
[guard]        [완료] 안전 판정. 자해·자살 / 응급 증상 / 진단·약 용량 요청이면
               정해진 안전 답변(109, 119, 의사·약사 확인)으로 바로 끝낸다.
               d1-2B 4지선다 + 키워드 규칙, 둘 중 하나라도 걸리면 막는다.
   ↓
[router]       의도 분류. 먼저 키워드 규칙으로, 애매할 때만 LLM으로.
               여러 도메인을 동시에 고를 수 있다.
   ↓   ┌─ nutrition ─┐
   ├──→├─ metabolic ─┤
   │   ├─ body      ─┤   각 노드는 도구만 호출하고,
   │   ├─ strength  ─┤   계산 결과를 상태에 적는다.
   │   ├─ activity  ─┤
   │   ├─ supplement┤
   │   └─ engagement┘
   ↓
[cross_check]  도메인 사이 계산 (규칙 기반)
               · 운동 kcal → 오늘 목표 칼로리 보정 (exerciseBonus)
               · 식사 시각 ↔ 식후 혈당 상승 (mealSpike)
               · 근육 회복도 ↔ 오늘 걸을 거리와 코스 추천
   ↓
[coach]        최종 답변. 숫자는 상태에 있는 값만 인용한다.
               <memory> 태그로 장기 메모리를 뽑는다.
   ↓
[persist]      확인된 기록만 저장
```

### 공유 상태

diet-coach의 상태 구조(`profile`, `days[YYYY-MM-DD]`)를 바탕으로 넓힌다. 도메인끼리 같은 데이터를 쓰기 때문에 에이전트별로 상태를 나누지 않는다.

- `profile`: 성별, 나이, 키, 체중, 목표, 활동량, 관리 유형 (diet-coach 그대로)
- `days[날짜]`: 끼니, 물, 걸음, 혈당, CGM, 혈압, 약, 영양제, 체중, 수면, 컨디션, 메모
  - `workouts`는 strength 형식(`items[].sets[]`, `prs`)으로 통일한다.
  - `activities[]`를 새로 둔다. Pace-Coach 기록(분석 결과 + 경로 점)을 넣는다.
- `strength`: `plan`, `program`, `customEx`, `rest`
- `courses[]`: 내 코스
- `memory`: 코치 메모리 (concerns, conditions, allergies, meds, notes, auto)

## 6. 원칙

1. **숫자는 도구가 만들고, LLM은 설명만 한다.** 칼로리, 혈당 지표, 1RM, 거리 같은 수치는 항상 core 함수 결과에서 가져온다. 세 앱이 규칙 기반으로 정확했던 장점을 지키기 위해서다.
2. **인식 결과는 사용자가 확인한 뒤 저장한다.** 사진·라벨·결과지 인식은 후보만 만들고, 사용자가 고치거나 승인하면 저장한다. diet-coach의 인식 → 고치기 흐름을 그대로 쓴다.
3. **진단·처방을 하지 않는다.** 혈당, 혈압, GLP-1, 검진 결과에 대한 답변은 기록과 추세 설명까지만 한다. diet-coach system 프롬프트의 금지 규칙을 coach 노드에 그대로 둔다.

## 7. 진행 순서

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | core 통합: 세 `core.js` 이전, 테스트 통과, 겹치는 함수 shared로 | **완료** |
| 2 | 뼈대 그래프: router, strength, activity, coach만 연결 (LLM 없이 끝까지 동작) | **완료** |
| 3 | nutrition과 vision: diet-coach `ai.js` 스키마를 서버로 이전, API 키 서버로 이동 | 예정 |
| 4 | metabolic, body, supplement, engagement, cross_check | 예정 |
| 5 | 산책 코스 추천 `recommendCourse` 새로 작성 | 예정 |
| 6 | 화면: 안드로이드 네이티브 껍데기(WebView) + WSL 서버. 시안 화면을 앱 모드로 띄우고 코치 대화를 서버에 연결 | **뼈대 완료** (2026-11-18) |
| 7 | 음성 입력(STT)과 음성 답변(TTS). 폰 기기 안 엔진만 사용 | **연결 완료** (실제 폰 확인 전) |

### 6단계(앱) 구조와 실행

```
휴대폰  apps/android  (Java WebView 껍데기, 의존성 없음)
   │  http://localhost:8787  ← adb reverse로 PC에 연결. LAN에는 아무 포트도 열지 않는다.
   ▼
WSL Ubuntu  packages/agent/src/server.ts  (node:http, 127.0.0.1:8787)
   ├─ GET  /           시안 화면을 앱 모드로 (docs/mockups/floating-coach.html?app=1)
   ├─ POST /api/chat   { text } → { reply, flag, checkin, intents }  그래프 한 번 실행
   ├─ d1-2B   Docker :8081   (미러 네트워크라 WSL의 localhost = PC의 localhost)
   └─ LFM3    Ollama :11434
```

1. 처음 한 번: `bash tools/wsl/install-node.sh` (WSL 안, sudo 없이 `~/.local/node`에 설치)
2. 서버: `DECISION_BACKEND=d1 LLM_MODEL=wellness-lfm3 bash tools/wsl/serve.sh` (변수를 빼면 규칙만으로 판정)
3. 폰 연결(USB 또는 무선 디버깅): `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe reverse tcp:8787 tcp:8787`
4. 앱: Android Studio로 `apps/android`를 열어 실행하거나 `apps/android/gradlew assembleDebug`

- 앱 모드(`?app=1`): 설명 패널과 상태 버튼을 숨기고 폰 테두리 없이 전체 화면으로 띄운다. 대화 탭 입력이 진짜 입력칸이 되어 `/api/chat`을 부른다. 자해 위기 판정이면 guard의 고정 답변과 상담 카드를 띄우고, "지금 109에 연락하기"는 `tel:109`로 전화 앱을 연다. 마이크 버튼은 7단계 전까지 숨긴다.
- 서버가 꺼져 있으면 껍데기가 앱 안의 `offline.html`(연결 방법과 109 안내)을 띄운다.
- 사용자와 저장: 앱이 만든 무작위 기기 ID(`x-device`)마다 사용자 하나. `packages/agent/src/store.ts`가 SQLite(`node:sqlite`, 의존성 없음)에 JSON 문서로 둔다. WSL에서는 DB를 리눅스 홈(`~/.local/share/wellness-agent/`)에 둔다. `/mnt/c`에서는 SQLite 잠금이 믿을 만하지 않다. 새 사용자는 빈 기록으로 시작하고 키·몸무게는 임시값(170cm, 65kg)이다.
- 실제 숫자(`GET /api/today`, `app.js`): 홈의 걸음 챌린지, 근력 띠, 운동 순위, 산책 화면의 이번 주 통계, 근력 화면의 회복도. 식단 추천과 물은 3단계 전까지 "예시" 표시.
- 산책 기록: `WalkService`(포그라운드 서비스, GPS). 정확도 30m 넘는 점, 30초 넘게 끊긴 구간, 초속 0.5m 미만(쉼)과 4m 초과(GPS 튐)는 거리에서 뺀다. 50m 미만은 저장하지 않는다. 서버에 못 보낸 기록은 폰에 두었다가 다음 실행 때 보낸다.
- 걸음: 폰의 걸음 센서. shortcut: 그날 앱이 처음 켜진 뒤부터 센다. 하루 전체가 필요하면 Health Connect로 바꾼다.
- 근력 기록(`GET /api/strength`, `POST /api/workouts`): 계획(genPlan)의 오늘 차례 날짜와 종목별 제안 무게. 제안은 egg-kim-coach `newItem()` 규칙 그대로다. 지난번 세트를 목표 횟수만큼 다 채웠으면 상체 +2.5kg·하체 +5kg(`overload`), 아니면 같은 무게, 처음이면 직접 입력. 운동 중에는 세트마다 kg·횟수·완료를 적고, 진행 중인 운동은 폰에 자동 저장되어 앱을 닫아도 남는다. 저장하면 신기록(`detectPRs`)을 알려 주고 계획이 다음 날짜로 넘어간다. 같은 시작 시각의 기록은 한 번만 저장한다.
- 아직 없는 것: 종목 바꾸기·추가, 휴식 타이머, 웜업 세트, 프로필 입력, 카메라(3단계 인식과 함께), 같은 Wi-Fi 접속(방화벽을 열어야 하므로 adb reverse만 쓴다), 뒤로 가기로 시트 닫기.
- 확인: 에뮬레이터(API 37)에서 앱 실행 → WSL 서버 연결, GPS 기록 시작·중지·저장, 코치 답변에 반영까지 확인했다. 걸음 센서와 음성은 에뮬레이터에 없어 실제 폰에서 확인해야 한다.

### 7단계(음성) 메모

- **위치**: STT는 그래프 맨 앞(안전 검사보다 먼저), TTS는 coach 다음 맨 끝. 그래프 자체는 글자만 다룬다.
- **외부 API 금지 원칙**: 크롬 Web Speech API는 소리를 구글 서버로 보내므로 쓰지 않는다. whisper.cpp 같은 서명 없는 프로그램은 스마트 앱 컨트롤이 막을 수 있어, d1-2B처럼 Docker/WSL에서 돌리는 것을 먼저 확인한다.
- **결정 (2026-11-18)**: 폰 안의 엔진을 쓴다. STT는 `SpeechRecognizer.createOnDeviceSpeechRecognizer`(Android 12+), TTS는 네트워크가 필요 없는 한국어 목소리만 고른다. 둘 중 하나라도 없으면 쓸 수 없다고 알리고 클라우드로 넘기지 않는다. 소리가 폰 밖으로 나가지 않아 PC의 whisper.cpp보다 단순하다. 인식된 글자는 입력창과 똑같이 `/api/chat`의 안전 판정을 거친다.
- **안전 검사와의 관계**: 받아쓰기 오류("죽고 시퍼", 띄어쓰기 없음)가 규칙을 피해 갈 수 있다. 자해 평가 세트에 음성 입력처럼 쓴 문장을 넣는다(`packages/agent/eval/reviews/round2-request.md`).
- **응답 시간**: 자해 판정이 상위 10%에서 9초 안팎 걸린다. 음성 대화에 붙이기 전에 줄일 방법을 찾아야 한다.
- **TTS**: 위기 응답의 "109", "마들랜", "119"를 숫자·이름 그대로 읽는지 확인한다.

### 2단계 구현 메모

`packages/agent`. Node 23.6 이상에서 `.ts`를 빌드 없이 실행한다 (type stripping, 타입 검사는 하지 않음).

```
src/
├─ state.ts              Annotation.Root: input, now, user, intents, results(병렬 결과를 이어 붙임), reply
├─ router.ts             키워드 규칙으로 도메인 선택, 도메인 안의 세부 주제(plan/recovery/week, course/week)
├─ modules/strength.ts   strengthTools(week, recovery, plan) + strengthNode
├─ modules/activity.ts   activityTools(week) + activityNode
├─ coach.ts              결과 문장을 정해진 순서로 이어 붙임 (LLM 없음)
├─ graph.ts              router → 조건부 엣지로 strength/activity 병렬 → coach
├─ fixtures/demo-user.ts 2026-11-17 20:00 기준 데모 데이터
└─ cli.ts                npm run demo -- "이번 주 운동 어땠어?"
```

- 라우터 규칙: "운동"이라는 말만으로는 근력으로 보내지 않는다. "걷기 운동"은 걷기, "운동 어땠어"는 근력, "운동이랑 산책"은 둘 다.
- 아직 없는 것: ingest(사진 인식), persist(저장), LLM 분류·답변, 코스 추천. 각각 3단계와 5단계에서 붙인다.
- 사용자 데이터는 호출할 때 통째로 넘긴다. 저장소 어댑터가 생기면 그래프 입력을 사용자 ID로 바꾼다.

## 8. 알려진 위험

- **시간대**: diet 테스트 65행(애플 건강 걸음 가져오기)은 한국 시간을 전제로 한다. UTC에서 실행하면 실패하며, 원본 diet-coach도 같다. 서버를 UTC로 돌릴 때 사용자 시간대를 명시적으로 넘겨야 한다.
- **API 키**: diet-coach는 Anthropic 키를 브라우저 localStorage에 평문으로 저장했다. 3단계에서 서버로 옮긴다. Pace-Coach의 공공데이터 키 파일은 이 저장소에 복사하지 않는다 (`.gitignore`에 등록).
- **검증 범위**: AI 인식, 바코드, GPS, 만보기는 원래 앱에서도 실제 키·실제 휴대폰으로 확인하지 않았다.
- **산책 추천 데이터**: 공공 코스 거리 중앙값이 15km이고 5km 미만 코스가 3개뿐이다. 짧은 산책은 도시공원 데이터에 기대야 한다.
