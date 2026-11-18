# 기능 페이지 이미지 생성 요청 (Codex 앱, GPT Image 2.6)

`+` 기록 팔레트와 식단 · 영양제 · 근력 · 산책 페이지를 만들면서 생긴 빈자리를 채운다. 아래 `---` 사이 블록 전체를 Codex 앱에 붙여 넣는다.
음식 분류별 기본 이미지는 식약처 식품 대분류가 확정된 뒤(`docs/DATA.md` 3절) 따로 요청서를 만든다.

---

GPT Image 2.6으로 이미지 13장(아이콘 7 · 사진과 그림 6)을 만들어 아래 경로와 파일 이름 그대로 저장해 주세요.

저장 폴더
- 아이콘(A1~A7): `<저장소>\docs\mockups\img\icons\`
- 사진 · 그림(B1~B6): `<저장소>\docs\mockups\img\`

모든 이미지 공통: 글자, 숫자, 로고, 상표, 사람과 얼굴을 넣지 않습니다.

## A. 아이콘 7개 — 이미 있는 아이콘 세트와 같은 스타일

- 같은 폴더의 `ic-meal.png`, `ic-workout.png`를 스타일 기준(reference)으로 넣어 질감 · 조명 · 색감을 맞춰 주세요.
- Soft 3D clay-style app icon, smooth matte surfaces with subtle gloss highlights, rounded friendly shapes, slightly front-facing 3/4 view, lighting from the top-left, soft contact shadow directly under the object only.
- Palette: main blue #2563EB with light blue #93C5FD and white, plus one natural accent per object. Pastel and clean.
- One object per icon, centered, filling about 70% of the canvas. Transparent background PNG, 1024×1024.

| 번호 | 파일 이름 | 들어갈 자리 | 프롬프트 (공통 스타일 뒤에 붙임) |
|---|---|---|---|
| A1 | `ic-pill.png` | 팔레트 · 영양제 | A small white supplement bottle with a blue cap, two capsules (one blue, one white) lying in front of it. Blank label. |
| A2 | `ic-scale.png` | 팔레트 · 체중 | A square white bathroom scale with a small blank light-blue display, seen from slightly above. |
| A3 | `ic-supp-multi.png` | 영양제 페이지 · 종합비타민 | Three round multivitamin tablets in soft orange and white, stacked casually. |
| A4 | `ic-supp-omega.png` | 영양제 페이지 · 오메가3 | Three translucent golden omega-3 softgel capsules. |
| A5 | `ic-supp-mag.png` | 영양제 페이지 · 마그네슘 | Two oval white tablets on a small light-blue round dish. |
| A6 | `ic-ex-bench.png` | 근력 페이지 · 벤치프레스 | A flat gym bench with a blue-plated barbell resting on its rack, no person. |
| A7 | `ic-ex-latpull.png` | 근력 페이지 · 랫풀다운 | A compact lat pulldown cable machine with a wide bar and a blue seat pad, no person. |

## B. 사진 · 그림 6장

| 번호 | 파일 이름 | 크기 | 들어갈 자리 | 프롬프트 |
|---|---|---|---|---|
| B1 | `food-yogurt.png` | 1024×1024 | 식단 페이지 · 간식 | 같은 폴더의 `food-salad.png`를 스타일 기준으로 넣어 같은 촬영 톤으로: very light grey seamless background (#F1F3F6), slight 3/4 overhead angle, soft studio light, subject centered with generous margin. A small white bowl of Greek yogurt topped with a few almonds and blueberries. |
| B2 | `strength-banner.png` | 1600×900 | 근력 페이지 · 위 배너 | Bright clean home-gym corner photo: a flat bench and a barbell with blue plates on a squat rack, light grey wall and pale wooden floor, soft daylight. Place the equipment in the right 45% of the frame; keep the left 55% plain and light so dark headline text can sit on it. No people. |
| B3 | `walk-map.png` | 1600×900 | 산책 페이지 · 지도 | Soft flat illustrated top-down map of a Korean city neighborhood in pastel colors: pale grey blocks, white roads, a light-blue stream crossing the bottom, two green parks. A thick blue route line loops from a green start pin at the lower left along the stream and through the park to a blue end pin at the upper right. No labels, no street names, no text. |
| B4 | `course-park.png` | 1024×1024 | 산책 페이지 · 추천 코스 · 동네 공원 | Photo of a quiet neighborhood park walking loop in Korea in early morning: a smooth paved path curving between trees and low shrubs, soft light. No people. |
| B5 | `course-river.png` | 1024×1024 | 산책 페이지 · 추천 코스 · 하천 산책로 | Photo of a Korean urban stream walking path: a paved walkway beside a calm shallow stream with reeds and stepping stones, apartment buildings softly blurred in the distance, clear daytime. No people. |
| B6 | `supp-banner.png` | 1600×900 | 영양제 페이지 · 위 배너 (새로 넣을 자리) | Clean product-style photo on a very light grey background: a weekly pill organizer with some compartments holding vitamins and softgels, a glass of water beside it. Place the objects in the right half; keep the left half plain for text. No brand labels. |

다 만들면 저장한 파일 이름과 크기를 목록으로 알려 주세요. A 아이콘 중 배경이 투명하지 않게 나온 것이 있으면 그 번호도 알려 주세요.

---

## 생성 뒤 (Claude가 할 일)

- 내용 확인: 글자 · 로고 · 사람이 없는지, A가 투명 배경인지.
- 웹용 사본: 아이콘 192px PNG(`img/web/icons/`), 사진 썸네일 360px · 배너와 지도 800px JPG(`img/web/`).
- 시안 반영: 팔레트의 영양제 · 체중 선 아이콘 → A1 · A2. 영양제 체크 줄 → A3~A5. 근력 종목 줄 → A6 · A7(로우 · 오버헤드 프레스는 기존 `ic-barbell`). 식단 간식 → B1. 근력 배너 → B2. 산책 지도 SVG → B3. 추천 코스 → B4 · B5. 영양제 페이지 위에 배너 B6 추가.
