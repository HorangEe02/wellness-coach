# 헬스장 배너 다시 만들기 + 음식 분류별 기본 이미지 (Codex 앱, GPT Image 2.6)

- **헬스장 배너:** 지금 `strength-banner.png`는 집 거실 같은 홈짐이라 운동하는 느낌이 약하다(2026-11-18 사용자 의견). 실제 헬스장의 파워랙 구역 사진으로 다시 만든다. 같은 파일 이름으로 덮어쓴다.
- **음식 기본 이미지:** 사진이 없는 음식 기록에 보이는 이미지. 식약처 음식 표준데이터(`data-raw/food/`, 19,495줄)의 **식품대분류명 25개**와 1:1로 만든다. 분류를 모르는 음식은 기존 `icons/ic-plate.png`를 쓴다.

아래 `---` 사이 블록 전체를 Codex 앱에 붙여 넣는다.

---

GPT Image 2.6으로 이미지 26장(헬스장 배너 1 · 음식 분류 기본 이미지 25)을 만들어 아래 경로와 파일 이름 그대로 저장해 주세요.

모든 이미지 공통: 글자, 숫자, 로고, 상표, 브랜드 이름(장비 · 포장 포함), 사람과 얼굴을 넣지 않습니다.

## A. 헬스장 배너 1장

저장: `<저장소>\docs\mockups\img\strength-banner.png` (기존 파일을 덮어씀), 1600×900 PNG

프롬프트:
Photo of the free-weight area of a real commercial gym. In the foreground, a heavy black steel power rack with numbered-hole uprights (no visible numbers or text), J-hooks and spotter arms, standing on a warm reddish-brown wooden lifting platform. A steel Olympic barbell with a knurled grip rests on the J-hooks, loaded with black bumper plates. Behind it, a row of more power racks and plate trees recedes into the room, black rubber flooring, exposed concrete ceiling with ducts and industrial lighting, slightly moody but clear light with warm highlights on the steel. Shot from a low three-quarter angle so the rack feels tall and solid. Composition for a wide app banner: the rack and barbell fill the right 55% of the frame; the left 45% is the darker, less busy depth of the gym so white headline text can sit on it. Photorealistic, sharp, no people, no brand names or logos on any equipment or wall.

## B. 음식 분류별 기본 이미지 25장

저장 폴더: `<저장소>\docs\mockups\img\food-cat\` (없으면 만들어 주세요), 모두 1024×1024 PNG

공통 촬영 톤 (25장 모두 같은 세트로):
- 같은 폴더 위의 `img\food-salad.png`를 스타일 기준(reference)으로 넣어 같은 촬영 톤으로 맞춰 주세요.
- Product-style food photo, very light grey seamless background (#F1F3F6), slight 3/4 overhead angle, soft studio light from the top-left, subject centered with generous margin (the app crops it into a rounded square), natural appetizing colors, simple ceramic tableware in white or light grey.
- 한 분류를 대표하는 **흔한 한국 가정식 · 외식 예**를 1~2가지만 담고, 포장지나 컵에 글자 · 로고가 없게 해 주세요.

| 번호 | 파일 이름 | 식품대분류명 (데이터 값 그대로) | 프롬프트 (공통 톤 뒤에 붙임) |
|---|---|---|---|
| B1 | `cat-rice.png` | 밥류 | A bowl of steamed white rice next to a small bowl of bibimbap with colorful vegetables and a fried egg. |
| B2 | `cat-porridge.png` | 죽 및 스프류 | A bowl of pumpkin porridge with a spoon, and a small cup of cream soup beside it. |
| B3 | `cat-noodle.png` | 면 및 만두류 | A bowl of Korean noodle soup (kalguksu) and a small plate of steamed dumplings. |
| B4 | `cat-soup.png` | 국 및 탕류 | A bowl of clear seaweed soup (miyeokguk) and a bowl of milky beef bone soup with green onions. |
| B5 | `cat-jjigae.png` | 찌개 및 전골류 | Kimchi stew bubbling in a black earthenware pot, with tofu and pork. |
| B6 | `cat-steamed.png` | 찜류 | Korean braised short ribs (galbi-jjim) with carrots and chestnuts in a shallow bowl. |
| B7 | `cat-grill.png` | 구이류 | Grilled pork belly slices and a grilled fish fillet on a plate with lettuce leaves. |
| B8 | `cat-jeon.png` | 전·적 및 부침류 | A Korean green onion pancake (pajeon) cut into pieces and a few zucchini jeon. |
| B9 | `cat-stirfry.png` | 볶음류 | Spicy stir-fried pork (jeyuk-bokkeum) and stir-fried fish cake on small plates. |
| B10 | `cat-braised.png` | 조림류 | Soy-braised beef with eggs (jangjorim) and braised potatoes in small bowls. |
| B11 | `cat-namul.png` | 나물·숙채류 | Three small mounds of seasoned blanched vegetables: spinach, bean sprouts and bracken. |
| B12 | `cat-saengchae.png` | 생채·무침류 | Spicy radish salad (musaengchae) and a seasoned cucumber salad in small bowls. |
| B13 | `cat-kimchi.png` | 김치류 | Napa cabbage kimchi and cubed radish kimchi (kkakdugi) in small bowls. |
| B14 | `cat-pickle.png` | 장아찌·절임류 | Soy-pickled perilla leaves and pickled garlic in small dishes. |
| B15 | `cat-jeotgal.png` | 젓갈류 | Small dishes of salted pollock roe and salted squid side dish. |
| B16 | `cat-sauce.png` | 장류, 양념류 | Small bowls of gochujang, doenjang and soy sauce, arranged neatly. |
| B17 | `cat-fried.png` | 튀김류 | Korean fried chicken pieces and a few vegetable tempura (twigim). |
| B18 | `cat-bread.png` | 빵 및 과자류 | A croissant, a slice of bread and two cookies on a small plate. |
| B19 | `cat-drink.png` | 음료 및 차류 | A glass of iced americano and a cup of green tea, plain glassware without any logo. |
| B20 | `cat-dairy.png` | 유제품류 및 빙과류 | A glass of milk, a small cup of plain yogurt and a scoop of vanilla ice cream in a bowl. |
| B21 | `cat-meat.png` | 수·조·어·육류 | Raw cuts on a light board: a chicken breast, a beef steak and a mackerel fillet. |
| B22 | `cat-grain.png` | 곡류, 서류 제품 | Two roasted sweet potatoes, a steamed corn cob and a small bowl of mixed grains. |
| B23 | `cat-legume.png` | 두류, 견과 및 종실류 | A block of tofu, a small bowl of black beans and a handful of mixed nuts. |
| B24 | `cat-vegetable.png` | 채소, 해조류 | Fresh broccoli, carrot, cherry tomatoes and a sheet of dried seaweed. |
| B25 | `cat-fruit.png` | 과일류 | An apple, a banana, a bunch of grapes and a cut orange. |

다 만들면 저장한 파일 이름과 크기를 목록으로 알려 주세요.

---

## 생성 뒤 (Claude가 할 일)

- 확인: 글자 · 로고 · 사람이 없는지, 25장의 촬영 톤이 같은지.
- 웹용 사본: 배너 800px JPG, 음식 분류 360px JPG (`img/web/`, `img/web/food-cat/`).
- 시안: 근력 배너를 새 사진으로 바꾸고, 사진이 어두우므로 배너 글자를 흰색 + 왼쪽 어두운 그라데이션으로 바꾼다.
- 데이터: `foods.json` 변환 때 `category`(식품대분류명) → `cat-*.png` 대응표를 코드에 넣는다. 위 표의 대분류명은 데이터 값과 글자까지 같아야 한다(쉼표 · 가운뎃점 포함).
