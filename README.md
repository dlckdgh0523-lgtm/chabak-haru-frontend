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

- 기본 주소는 미리보기 모드입니다. 버튼 상태, 타이머, 약관·QR 연결 흐름을 샘플 응답으로 재현합니다.
- 화면 주소에 `?mode=live`를 붙이면 운영 연결이 필요합니다. 기존 웹은 `ChabakIntegration.configure()`, Android 앱은 `BackendGateway`에 연결합니다.
- Figma 링크에는 화면 이동 반응이 없었습니다. 화면 문구를 바탕으로 화면 전환과 예외 처리 흐름을 구성했습니다. 화면별 동작과 Figma 노드 ID는 `docs/frames.json`에서 찾을 수 있습니다.
- CID와 모바일은 같은 데이터 계약을 사용합니다. 차대번호, 연락처 원문, 위치, QR 원문은 운영에서 최소 범위로 처리해야 합니다.

[원본 Figma · 차박하루](https://www.figma.com/design/M3RkBmYJaG8m75TAsxD9LA?node-id=0-1)
