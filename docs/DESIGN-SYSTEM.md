# 차박하루 디자인 시스템

## 화면 및 계층

캔버스의 `CID`, `CID_Intro`, 두 `MO`, `rolling`에서 자기 자신과 상위 컨테이너가 보이는 직접 하위 프레임을 구현 범위로 삼았습니다. `draft`에 접혀 있는 화면은 화면 카탈로그에서 빠지며, 해당 페이지의 모바일 마스터 컴포넌트는 라이브러리에 포함됩니다. 같은 제목을 사용한 두 `MO` 그룹은 상위 노드 ID로 구분합니다.

- 화면 및 카드 식별자는 `cid-`, `mobile-`, `rolling-` 접두사의 영문 kebab-case입니다. 예시 화면은 `mobile-onboarding-consent.html`입니다.
- DOM의 `data-figma-node`는 원본 레이어 ID입니다. `data-layer`는 원본 이름입니다.
- `data-component`에는 `Mobile / Button` 등 Figma 경로를 적었습니다. 변형은 `Appearance=Primary`, `State=Checked`처럼 원본 속성과 값을 조합합니다.
- 화면별 CSS는 `web/css/screens/`에 있습니다. `layers.css`는 컴포넌트 카탈로그와 개별 템플릿을 불러올 때 쓰는 통합 파일입니다.
- 공용 상태 클래스는 `ch-button`, `ch-checkbox`, `ch-switch`, `ch-filter-chip`, `ch-bookmark`, `ch-stepper` 등입니다. `layers.css`의 해시 접미사가 붙은 클래스는 화면의 특정 도형·색·기하 조합을 찾을 때 사용합니다.
- `data-action`, `data-bind`는 기능 연결용 식별자입니다. API 연동에서 화면 내부 레이어 클래스에 의존하지 않도록 설계했습니다.
- 같은 마스터 이름이 여러 곳에 쓰이면 클래스에는 노드 ID를 붙입니다. 동일 명칭의 진짜 원본을 찾을 때는 `docs/components.json`의 ID를 사용하세요.

## Foundation

| 항목 | 코드 | 원본 대응 |
| --- | --- | --- |
| 브랜드 | `--ch-brand-blue`, `--ch-brand-navy`, `--ch-brand-sky` | `#0058ff`, `#070e30`, `#238bff` |
| 색·간격·모서리 | `web/css/tokens.css` | Figma 변수 컬렉션별 `--ch-figma-…`와 화면에 쓰인 공용 속성 |
| 원본 변수 | `docs/design-tokens.json` | 11개 컬렉션, 변수 577개, 원본 모드·alias·값·코드명 |
| 텍스트·페인트·효과 | 동일 JSON | 텍스트 스타일 75개, 페인트 6개, 효과 6개 |
| 기본 서체 | `Pretendard Variable` | CSS에 내장한 Pretendard와 OFL 동봉 |
| 차량 대형 숫자 4개 | `DIN Alternate` / `Barlow Condensed` | 기기에 DIN Alternate가 있으면 우선 사용. 다른 기기는 동봉한 Barlow Condensed Bold 사용 |
| 원본 SVG·이미지 | `web/assets/figma/`, `docs/assets.json` | 원본 파일을 내려받아 콘텐츠 해시로 중복 제거. 화면·레이어별 사용처와 원본 이미지 크기 포함 |

색이 같아 보여도 다른 컬렉션에서 이름이 같은 변수는 컬렉션을 유지합니다. 개별 프레임은 원본의 분수 좌표가 실측에 영향을 주는 경우 소수 값을 보존합니다. 기본 간격·반경·폰트 크기를 변경할 때는 먼저 해당 Figma 토큰과 변형을 확인하세요.

## 컴포넌트 사용

- `web/components.html`에서 원본 이름이나 코드 클래스명으로 확인할 수 있습니다.
- `web/component-templates.html`에 재사용 가능한 HTML 템플릿이 있습니다. 텍스트 속성은 Figma 레이어 ID를 키로 바꿀 수 있습니다.
- `web/js/component-library.js`는 정적 HTTP 또는 Android WebView에서 템플릿을 불러옵니다.
- 템플릿 321개와 변형 세트 20개를 포함했습니다. 가려져 있던 일부 백업 마스터는 원본 하위 레이어를 조합했으며, 해당 항목은 `docs/components.json`의 `markupKind`에서 확인할 수 있습니다.
- 변형 세트는 `docs/components.json`에서 `variants` 밑의 구성 ID를 찾습니다.
- 체크박스는 기본·선택·혼합, 토글은 켜짐·꺼짐, 필터와 북마크는 선택 상태를 지원합니다. 기본 Figma 화면과 사용자 변경 뒤의 상태를 구분하기 위해 `aria-checked` 또는 `aria-pressed`와 `data-changed`를 사용합니다.

```html
<link rel="stylesheet" href="./css/tokens.css">
<link rel="stylesheet" href="./css/base.css">
<link rel="stylesheet" href="./css/layers.css">
<link rel="stylesheet" href="./css/components.css">
<div id="example"></div>
<script src="./js/component-library.js"></script>
<script>
  ChabakComponents.create("29279-391").then(node => {
    document.querySelector("#example").append(node);
  });
</script>
```

숫자와 안내 문구는 화면에서 수정할 수 있는 텍스트입니다. 지도, 로고, 일러스트 및 시안 QR에는 Figma 원본 이미지와 SVG를 사용합니다. 운영 QR·지도는 `INTEGRATION.md`의 데이터로 교체할 수 있습니다.

[원본 Figma · 차박하루](https://www.figma.com/design/M3RkBmYJaG8m75TAsxD9LA?node-id=0-1)
