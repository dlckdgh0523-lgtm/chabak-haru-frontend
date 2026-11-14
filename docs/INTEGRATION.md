# 서버·차량 SDK 연결

`web/js/integration.js`는 UI 요청에 화면 ID와 요청 ID를 붙입니다. 화면 기본값은 미리보기입니다. 웹 운영 주소에는 `?mode=live`를 붙이고 페이지마다 앱 공통 진입점에서 어댑터를 등록합니다. Android는 `BackendGateway.dispatch(event, payload, requestId)`에서 구현합니다.

```js
ChabakIntegration.configure(async ({ id, event, payload, screen }) => {
  return vehicleApp.dispatch({ id, event, payload, screen });
});
```

성공에는 `{ ok: true, data: {...} }`, 처리 실패에는 `{ ok: false, error: { code, message } }`를 반환합니다. Android 브리지 응답에는 요청의 `id`를 포함합니다. `ui.ready`의 응답으로 첫 화면에 필요한 상태 이벤트 배열을 반환할 수 있습니다. UI 요청은 12초 후 시간 초과됩니다. 운영 서버는 설정 저장, 약관 동의, QR 확인, 문자와 차량 명령을 요청 ID로 중복 처리하지 않도록 하세요.

| 기능 | 이벤트 예시 | 화면 연결 |
| --- | --- | --- |
| 경로 | `route.accept`, `route.start`, `route.detour`, `route.destination` | 경로 팝업, 우회 충전, 추천 장소 선택 |
| 장소 | `places.filters`, `places.bookmark`, `place.reviews`, `place.phone` | 목록, 저장, 후기, 전화 |
| 차량 | `vehicle.setting`, `vehicle.settings.save`, `vehicle.utility.enable` | 수면 음악, 공조, 절전, 난방, 조도, 접근/화재 감지 |
| 알림 | `alarm.set`, `alarm.snooze`, `alarm.stop`, `safety.acknowledge` | 기상·경고 |
| 긴급 | `safety.evacuation.route`, `safety.vehicleSignal`, `safety.sos` | 대피, 비상등·경적, 긴급 호출 |
| 온보딩 | `terms.document`, `terms.accept`, `pairing.begin`, `pairing.confirm` | 약관 조회·동의, QR 표시·스캔 |
| 비상연락처 | `contacts.list`, `contacts.update`, `contacts.reorder`, `contacts.test`, `contacts.finish` | 연락처 입력, 마스킹, 우선순위, 테스트 문자 |

## 실시간 반영

```js
ChabakIntegration.publish("ui.state", {
  values: {
    "vehicle-soc": "71%",
    "cabin-temperature": "22°C",
    "briefing-time": "0:18 / 0:30"
  }
});
```

`voice.state`(`{active, status}`)는 브리핑 알약을 펼치거나 접습니다. 알약은 음성 인식·브리핑 중에만 보이며, 차량 스티어링 휠 음성 버튼처럼 앱 밖에서 시작된 음성도 이 이벤트로 알려 주세요. `ui.state`는 화면의 `data-bind`가 있는 문자열을 바꿉니다. `vehicle.settings`는 설정 키와 값을, `places.results`는 `placeIds`를, `contacts.updated`는 마스킹된 전화번호와 표시 이름을 받습니다. `map.updated`의 `imageUrl`에는 같은 origin의 PNG·JPEG·WebP 또는 3.5MB 이하 이미지 data URL을 전달할 수 있습니다. 운영 지도 SDK는 화면과 동일한 뷰포트에 연결할 수 있게 지도 영역을 표시했습니다.

## 약관·QR·연락처

- 약관 8개에서 UI의 필수 5개 선택을 확인합니다. `terms.document` 응답의 `text`와 `version`은 판매·운영 정책에서 유지합니다. 동의 기록은 운영 서버가 약관 ID·버전·서버 시각으로 보관합니다.
- CID의 QR은 운영에서 새 세션으로 조회합니다. `pairing.begin`은 `sessionId`와 `qrImageUrl`을 반환합니다. Android에서는 PNG base64 data URL을 전달하세요. 웹은 동일 origin 또는 허용된 HTTPS QR 이미지 응답을 사용할 수 있습니다.
- 모바일 스캐너는 읽은 문자열을 링크로 열지 않고 `pairing.confirm`에 전달합니다. 서버에서 만료, 기기 귀속 및 재사용을 검사해 `status: "paired"` 뒤에만 다음 화면으로 진행합니다.
- 연락처 저장 후 `id`, `name`, `maskedPhone`을 반환합니다. 알림·경적·V2L 차단·SOS는 UI 응답과 실제 실행 상태를 구분합니다. 백그라운드 경보 및 접근 시간 계산은 운영 서비스가 처리합니다.
- 운영 API의 호스트, 인증, 실제 차량 기능, 기상·내비게이션 데이터 및 약관 전문은 프로젝트 운영 값을 연결하는 단계입니다. 모의 데이터에는 실제 기능 실행이나 문자 전송이 없습니다.
