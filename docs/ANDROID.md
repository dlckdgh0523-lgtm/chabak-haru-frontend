# Android 프로젝트 적용

## 환경

| 항목 | 설정 |
| --- | --- |
| 프로젝트 | `android/` |
| Build | Gradle 8.13, Android Gradle Plugin 8.13.2 |
| 런타임 | Android 8.0 API 26 이상 |
| 컴파일·대상 | API 36 |
| JDK | 17 이상. 검증은 JDK 21로 실행 |
| 웹 엔진 | Android System WebView + AndroidX WebKit 1.15.0 |
| 적용 화면 | `web/screens/mobile-*.html` |
| 예제 패키지 | `com.chabakharu.handoff` |

Android Studio에서 `android` 폴더를 열고 SDK Platform 36과 Build Tools를 설치합니다. 같은 압축에 있는 `web` 경로는 Gradle이 자산에 포함합니다.

```bash
cd android
./gradlew :app:assembleDebug
./gradlew :app:bundleRelease
```

Windows에서는 `gradlew.bat`를 사용하세요.

## 네이티브와 웹 사이

- `WebViewAssetLoader`로 APK에 포함된 파일을 앱 전용 HTTPS origin에서 불러옵니다.
- `MainActivity.createGateway()`에서 기존 인증·API·차량 SDK를 사용한 `BackendGateway` 구현체를 반환합니다. 허용된 이름의 JSON 요청만 수신하고, 결과는 요청 ID와 함께 돌려줍니다.
- QR 스캔 영역에서만 카메라 권한을 요청합니다. 브라우저의 QR 판별 기능을 우선 사용하고, 지원하지 않는 WebView에서는 동봉한 jsQR이 작동합니다.
- 운영 앱은 Android 상태바와 내비게이션 영역을 사용합니다. 화면 전환·회전 시 진입 상태와 WebView 히스토리를 유지합니다.
- 차량 설정·경보·연락처 이벤트 발행은 `publishState()`에서 운영 데이터를 전달합니다. `docs/events.json`에 이름과 필드를 정리했습니다.
- 디버그 빌드는 미리보기로 시작합니다. 릴리스는 운영 모드로 시작하므로 앱 팀의 서비스 구현이 필요합니다.

## 제출 시 프로젝트 정보

실제 앱 ID, 버전 정책, 앱 아이콘과 릴리스 키는 배포 팀의 값으로 연결하세요. 내부 테스트 트랙에서 Android 8.0, Android 15·16, 대상 단말의 WebView 버전으로 카메라 승인과 거부, 긴 화면 스크롤, TalkBack, 백그라운드 복귀 후 경보 수신을 확인하세요.

- [Android WebView 앱 내 파일 로드](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [Google Play 대상 API 요구사항](https://developer.android.com/google/play/requirements/target-sdk?hl=ko)
- [Android Gradle Plugin 8.13 호환성](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
- [AndroidX WebKit 릴리스](https://developer.android.com/jetpack/androidx/releases/webkit)
