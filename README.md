# 차박하루 개발 핸드오프

Figma `ing`의 보이는 자식 프레임 38개를 HTML·CSS·JavaScript로 옮겼습니다. 차량 CID 17개는 1920 × 1080, 모바일 18개는 너비 360px와 프레임별 원본 높이, 롤링 카드 3개는 288 × 180입니다. 롤링 컨테이너 872 × 180도 재현했습니다.

| 담당 | 시작 파일 | 내용 |
| --- | --- | --- |
| 퍼블리싱·프론트엔드 | `web/index.html` | 화면 카탈로그와 프레임별 HTML·CSS |
| 디자인 시스템 | `web/components.html`, `docs/DESIGN-SYSTEM.md` | 컴포넌트, 변형, 템플릿, CSS 토큰, Figma ID |
| 백엔드 | `docs/INTEGRATION.md`, `docs/events.json` | 요청·응답, 실시간 상태, mock/운영 연결 방식 |
| Android | `android/`, `docs/ANDROID.md` | Android Studio 프로젝트, WebView, 카메라 권한과 연결 인터페이스 |
| QA | `qa/REPORT.md`, `qa/visual-results.csv` | 프레임 크기, 이미지 로드, 화면 차이, 동작 및 빌드 결과 |

`web/index.html`을 브라우저에서 열면 화면 목록을 볼 수 있습니다. 로컬에서 여러 화면을 이동하며 설정을 확인하거나 컴포넌트 템플릿을 실행할 때는 HTTP로 띄웁니다.

```bash
python3 -m http.server 8080 --directory web
```

[로컬 미리보기](http://localhost:8080/)

## 실행 모드

### 미리보기(mock) — 기본

주소에 아무것도 붙이지 않으면 서버 없이 샘플 응답으로 동작합니다. 시연 영상은 이 모드로 찍습니다.

- 화면 흐름: 경로 확인 → 브리핑 → (닫기) 충전 경유 → 일출 주차 → 유틸리티 모드 → 취침 확인 → 수면 → 기상 → 아침 요약
- 밤 경보·기상 시연: 수면 화면을 0.7초 길게 누르거나, CID 경로 화면 왼쪽 위 메뉴의 `데모 이벤트…`
- `?qa`를 붙이면 Figma 비교용입니다. 타이머·자동 이동·세션 상태를 끄고, 원본 그대로의 상태를 보여 줍니다.

### 실서버(live) — `?mode=live`

백엔드([chabak-hanbam-backend](https://github.com/dlckdgh0523-lgtm/chabak-hanbam-backend), `fix/spec-alignment`)를 `http://localhost:3000/v1`에 띄운 뒤, 화면 주소에 한 번만 아래 값을 붙입니다. 값은 브라우저 `localStorage`에 남습니다.

```
?mode=live&user=demo-user&vehicleId=…&sessionId=…&tripId=…&linkId=…&carToken=…
```

- 값은 백엔드 `npm run seed:demo`가 만드는 `live-seed.json`에서 읽습니다. `sleepSessionId`는 `sessionId`, `carDeviceToken`은 `carToken`으로 넣습니다. `carToken`은 CID 화면에만 필요합니다.
- **`live-seed.json`과 `carToken`에는 장치 토큰이 들어 있습니다. 커밋하거나 공유하지 마세요.**
- 서버 주소를 바꾸려면 `&api=http://<호스트>:3000/v1`을 붙입니다. Android 에뮬레이터에서는 `10.0.2.2`를 씁니다.
- 연동 코드는 `web/js/live-adapter.js`에 있습니다. 화면 이벤트와 REST·WebSocket 사이의 매핑을 맡습니다. 서버에 없는 기능은 live에서도 로컬로 처리하며, 그 목록은 같은 파일의 `LOCAL`에 있습니다(약관 전문, 전화, 북마크, 알람, 경로, 음성, SOS, V2L 상세, 목적지 변경).
- Android 앱에서는 `window.ChabakNative` 브리지가 있으면 웹 어댑터 대신 `BackendGateway`가 요청을 받습니다.
- Figma 링크에는 화면 이동 반응이 없었습니다. 화면 문구를 바탕으로 화면 전환과 예외 처리 흐름을 구성했습니다. 화면별 동작과 Figma 노드 ID는 `docs/frames.json`에서 찾을 수 있습니다.
- CID와 모바일은 같은 데이터 계약을 사용합니다. 차대번호, 연락처 원문, 위치, QR 원문은 운영에서 최소 범위로 처리해야 합니다.

[원본 Figma · 차박하루](https://www.figma.com/design/M3RkBmYJaG8m75TAsxD9LA?node-id=0-1)
