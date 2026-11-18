# 웰니스 코치 (wellness-coach)

식단 · 근력 운동 · 걷기를 기록하고, 그 기록을 보고 답하는 개인 웰니스 AI 코치입니다.
개인 앱 세 개(식단 코치, 근력 코치, 걷기 코치)의 계산 로직을 하나로 합치고 [LangGraph.js](https://langchain-ai.github.io/langgraphjs/)로 연결했습니다.
모델은 모두 PC 안에서 돌리고(외부 AI API 없음), 안드로이드 앱은 WebView 껍데기로 PC의 서버에 붙습니다.

> 개인 학습 · 연구용 프로젝트입니다. 의료 기기가 아니며 진단이나 처방을 하지 않습니다.
> 힘든 마음이 들 때는 자살예방 상담전화 **109**(24시간, 문자 가능)나 카카오톡 「마들랜」, 응급 상황에서는 **119**에 연락하세요.

## 상태

| 영역 | 상태 |
|---|---|
| 계산 로직 (`packages/core`) | 세 앱의 순수 함수 이전, 테스트 통과 |
| 에이전트 (`packages/agent`) | 안전 판정(자해 · 응급 · 의료) → 의도 분류 → 근력 · 걷기 도구 → 답변. 식단 · 영양제는 아직 연결 전 |
| 서버 | Node `node:http` + SQLite(`node:sqlite`), 기기별 기록 저장 |
| 안드로이드 (`apps/android`) | WebView 껍데기, GPS 산책 기록, 걸음 센서, 기기 안 음성 인식 · 읽기 |
| 음식 DB (`packages/core/data/foods.json`) | 식약처 · 농진청 공공데이터 23,435건 |

자세한 설계와 진행 상황은 [docs/DESIGN.md](docs/DESIGN.md), 데이터는 [docs/DATA.md](docs/DATA.md), 모델은 [docs/MODELS.md](docs/MODELS.md)에 있습니다.
서버 없이 화면만 보려면 `docs/mockups/floating-coach.html`을 브라우저로 열면 됩니다(데모 데이터로 동작).

## 구조

```
packages/core     세 앱의 계산 로직 (CommonJS, 브라우저에서도 동작)
packages/agent    LangGraph 그래프, 안전 판정, 서버 (src/server.ts)
apps/android      안드로이드 WebView 껍데기 (Java, 의존성 없음)
docs/mockups      화면 시안 · 앱 화면 (floating-coach.html, app.js)
infra             로컬 모델 서버 설정 (Docker의 llama.cpp, Ollama)
tools             공공데이터 받기 · 변환, 시안 빌드, WSL 서버 실행
```

## 실행

Node 23.6 이상이 필요합니다(`.ts`를 빌드 없이 실행).

```sh
npm install
npm test                                   # 전체 테스트
npm run demo -- "이번 주 운동 어땠어?"      # 데모 사용자로 한 번 묻기 (규칙만 사용)
node packages/agent/src/server.ts          # 서버: http://127.0.0.1:8787
```

로컬 모델(d1-2B, LFM3)을 쓰는 방법은 [docs/MODELS.md](docs/MODELS.md),
WSL에서 서버를 띄우고 안드로이드 앱을 붙이는 방법은 [docs/DESIGN.md](docs/DESIGN.md)의 6단계를 보세요.

공공데이터를 다시 받으려면 공공데이터포털 · 식품안전나라 인증키를 직접 발급받아야 합니다. 키는 git에서 제외된 로컬 파일에 두며 저장소에 넣지 않습니다.

## 라이선스와 출처

- 코드: [MIT](LICENSE)
- 음식 DB(`packages/core/data/foods.json`)는 MIT가 아니라 원천의 이용 조건을 따릅니다: **공공누리 제1유형(출처 표시)**.
  - 식품의약품안전처, 「전국통합식품영양성분정보(음식) 표준데이터」 (공공데이터포털 15100070)
  - 농촌진흥청, 「전국통합식품영양성분정보(원재료성식품) 표준데이터」 (공공데이터포털 15100065)
- 시안 이미지(`docs/mockups/img`)는 이 프로젝트를 위해 이미지 생성 모델로 새로 만든 것입니다.
