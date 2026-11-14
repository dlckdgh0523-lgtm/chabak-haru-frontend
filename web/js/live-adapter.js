"use strict";

// ?mode=live 웹 어댑터: 화면 이벤트 → 백엔드 REST(/v1)·WebSocket(/v1/ws).
// 서버에 API가 없는 기능은 LOCAL 목록에서 미리보기와 같은 로컬 값으로 처리한다.
(() => {
  const integration = window.ChabakIntegration;
  if (!integration || integration.demo) return;
  const kind = document.body.dataset.kind; // cid=차량, mobile=휴대폰
  const screen = document.body.dataset.screen;

  const query = new URLSearchParams(location.search);
  // 설정은 주소 쿼리로 한 번 넘기면 localStorage에 남는다. 예: ?mode=live&api=http://localhost:3000/v1&vehicleId=…&vehicleToken=…
  // 값은 live-seed.json(커밋·공유 금지)에서 읽어 넣는다. carToken=차량 장치 토큰, sessionId=sleepSessionId
  const KEYS = ["api", "user", "vehicleId", "carToken", "sessionId", "tripId", "linkId"];
  const config = {};
  for (const key of KEYS) {
    let value = query.get(key);
    try {
      if (value) localStorage.setItem("chabak-live:" + key, value);
      else value = localStorage.getItem("chabak-live:" + key);
    } catch { /* 저장소를 못 쓰면 이번 페이지에서만 쓴다 */ }
    config[key] = value || "";
  }
  config.carToken ||= query.get("vehicleToken") || "";
  config.sessionId ||= query.get("sleepSessionId") || "";
  const base = (config.api || "http://localhost:3000/v1").replace(/\/$/, "");
  // 장소 4곳은 seed 고정 ID(INTEGRATION-GUIDE 3장)
  const PLACES = { solnae: "5e0d0000-0000-4000-8000-000000000001", najeong: "5e0d0000-0000-4000-8000-000000000002",
    bukhang: "5e0d0000-0000-4000-8000-000000000003", galma: "5e0d0000-0000-4000-8000-000000000004" };
  const placeKey = (id) => Object.keys(PLACES).find(key => PLACES[key] === id);
  const currentPlace = () => {
    try { return PLACES[JSON.parse(sessionStorage.getItem("chabak-haru:destination"))?.id] || PLACES.solnae; }
    catch { return PLACES.solnae; }
  };

  // 서버에 없는 기능(BACKEND-DIFF 3장): live에서도 로컬 처리
  const LOCAL = new Set([
    "terms.document", "place.phone", "places.bookmark",
    "alarm.set", "alarm.snooze", "alarm.stop",
    "route.accept", "route.start", "route.dismiss", "route.detour", "route.destination", "parking.sunrise",
    "voice.start", "voice.stop", "safety.vehicleSignal", "safety.sos", "safety.evacuation.route",
    "vehicle.v2l.details", "vehicle.utility.enable", "pairing.skip", "pairing.confirm", "contacts.finish", "ui.ready",
    // 서버로 옮길 수 없거나(목적지 변경은 예약 취소+새 예약이 필요) 데모에서 실제 QR 인코더가 없는 것
    "route.destination",
  ]);

  let userToken = "";
  const tokenKey = "chabak-live:userToken:" + base + ":" + (config.user || "demo-user"); // 사용자·서버가 바뀌면 다른 토큰
  async function userAuth() {
    if (userToken) return userToken;
    try { userToken = sessionStorage.getItem(tokenKey) || ""; } catch { /* 없으면 새로 로그인 */ }
    if (userToken) return userToken;
    const session = await http("POST", "/auth/sessions", { provider: "DEV", credential: config.user || "demo-user" }, { auth: false });
    userToken = session.accessToken;
    try { sessionStorage.setItem(tokenKey, userToken); } catch { /* 메모리로만 유지 */ }
    return userToken;
  }

  async function http(method, path, body, { auth = "user", idempotent = false } = {}) {
    const headers = { "Accept": "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth === "user") headers.Authorization = "Bearer " + await userAuth();
    if (auth === "vehicle") {
      if (!config.carToken) throw new Error("차량 토큰이 설정되지 않았어요. 주소에 carToken을 넣어 주세요.");
      headers.Authorization = "Bearer " + config.carToken;
    }
    if (idempotent) headers["Idempotency-Key"] = crypto.randomUUID();
    let response;
    try {
      response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new Error("서버에 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.");
    }
    if (response.status === 401 && auth === "user" && userToken) {
      // 토큰 만료: 한 번만 다시 로그인
      userToken = "";
      try { sessionStorage.removeItem(tokenKey); } catch { /* 무시 */ }
      return http(method, path, body, { auth, idempotent });
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const messages = { VERSION_CONFLICT: "다른 곳에서 먼저 바뀌었어요. 다시 불러와 주세요.", RATE_LIMITED: "요청이 많아요. 잠시 뒤 다시 시도해 주세요.",
        PRECONDITION_FAILED: "지금 상태에서는 할 수 없어요.", ALREADY_EXISTS: "이미 등록했어요.", NOT_FOUND: "찾을 수 없어요." };
      const error = new Error(messages[data.code] || data.message || `서버 오류 (${response.status})`);
      error.code = data.code; error.details = data.details;
      throw error;
    }
    return data;
  }

  const need = (name) => {
    if (!config[name]) throw new Error(`live 설정에 ${name}이(가) 없어요.`);
    return config[name];
  };
  let contactsVersion = null;
  async function contacts() {
    const result = await http("GET", "/emergency-contacts");
    contactsVersion = result.version;
    return result.contacts || [];
  }
  const toApp = (list) => ({ contacts: list.map(c => ({ id: c.id, name: c.name, maskedPhone: c.maskedPhone })) });

  // 화면 이벤트 → API (서버 코드 기준으로 확인한 것만. 나머지는 INTEGRATION-GUIDE 확정 후 추가)
  const routes = {
    async "contacts.list"() { return toApp(await contacts()); },
    async "contacts.update"({ contacts: items }) {
      const current = await contacts();
      const next = current.map(c => ({ id: c.id, name: c.name }));
      for (const item of items) {
        // 화면의 임시 id("first" 등)는 서버 id가 아니다. 서버에 있는 id일 때만 그 연락처를 고친다
        const index = item.id ? next.findIndex(c => c.id === item.id) : -1;
        const row = { ...(index >= 0 ? { id: item.id } : {}), name: item.name, ...(item.phone ? { phone: item.phone } : {}) };
        if (index >= 0) next[index] = row; else next.push(row);
      }
      const saved = await http("PUT", "/emergency-contacts", { contacts: next.slice(0, 3), expectedVersion: contactsVersion });
      contactsVersion = saved.version;
      return toApp(saved.contacts || []);
    },
    async "contacts.reorder"({ contactIds }) {
      const current = await contacts();
      const ordered = [...contactIds.map(id => current.find(c => c.id === id)).filter(Boolean),
        ...current.filter(c => !contactIds.includes(c.id))].map(c => ({ id: c.id, name: c.name })); // 목록에 없는 연락처는 뒤에 유지
      // 서버는 PUT마다 연락처 id를 다시 발급한다(명세 "전부 삭제 후 생성")
      const saved = await http("PUT", "/emergency-contacts", { contacts: ordered, expectedVersion: contactsVersion });
      contactsVersion = saved.version;
      return toApp(saved.contacts || []);
    },
    async "contacts.test"({ contactId }) {
      return http("POST", "/emergency-contacts/test-sms", { contactId, userActionId: crypto.randomUUID() }, { idempotent: true });
    },
    async "place.reviews"() {
      const briefing = await http("GET", `/places/${currentPlace()}/briefing`);
      return { reviews: (briefing.reviews?.items || []).map(item => item.text).filter(Boolean) };
    },
    async "places.filters"({ filters = [] }) {
      const rank = filters.includes("조용함") ? ["quiet"] : [];
      const require = [filters.includes("야영 가능") && "camping", filters.includes("취사 가능") && "cooking"].filter(Boolean);
      const params = new URLSearchParams({ rank: rank.join(","), require: require.join(","), maxExtraMin: "30" });
      const result = await http("GET", `/places/${currentPlace()}/alternatives?${params}`);
      return { placeIds: (result.candidates || []).map(c => placeKey(c.id)).filter(Boolean) };
    },
    async "terms.accept"({ agreed = [] }) {
      for (const id of agreed) await http("POST", "/consents", { purpose: "TERMS", version: String(id).slice(0, 32), decision: "GRANTED" });
      return {};
    },
    async "pairing.begin"() {
      // seed는 이미 페어링된 차량이다. 실제 QR 이미지 생성(qrPayload → PNG)은 웹에 인코더가 없어 미구현
      if (config.linkId) return { sessionId: "seed-linked", qrImageUrl: await assetDataUrl() };
      const pairing = await http("POST", "/pairings", undefined, { auth: "vehicle" });
      return { sessionId: pairing.id || pairing.pairingId, qrImageUrl: await assetDataUrl(), qrPayload: pairing.qrPayload };
    },
    async "pairing.status"({ sessionId }) { return { status: sessionId === "seed-linked" ? "paired" : "pending" }; },
    "vehicle.setting": ({ key, value }) => savePlan({ [key]: value }),
    "vehicle.settings.save": ({ settings }) => savePlan(settings),
    async "vehicle.sleep.start"({ settings }) {
      if (settings) await savePlan(settings);
      const session = await http("GET", `/sleep-sessions/${need("sessionId")}`);
      const state = await http("GET", `/vehicles/${need("vehicleId")}/state`);
      const preflight = await http("POST", `/sleep-sessions/${config.sessionId}/preflight`, { stateRevision: state.revision });
      if (preflight.status === "BLOCKED" || preflight.blockers?.length) {
        const why = (preflight.blockers || []).map(b => b.message || b.code || b).join(", ");
        throw new Error("지금은 수면 모드를 시작할 수 없어요" + (why ? `: ${why}` : "."));
      }
      return http("POST", `/sleep-sessions/${config.sessionId}/start`, {
        preflightId: preflight.id || preflight.preflightId, planVersion: session.planVersion, userConfirmed: true, userActionId: crypto.randomUUID() });
    },
    "vehicle.sleep.stop": () => http("POST", `/sleep-sessions/${need("sessionId")}/stop`, { reason: "USER_STOP" }),
    async "safety.acknowledge"({ type }) {
      const known = sessionStorage.getItem("chabak-live:alertId");
      if (known) {
        sessionStorage.removeItem("chabak-live:alertId");
        return http("POST", `/alerts/${known}/acknowledgements`, { action: "OK" }, { auth: kind === "cid" && config.carToken ? "vehicle" : "user" });
      }
      const alerts = await http("GET", `/sleep-sessions/${need("sessionId")}/alerts`);
      const list = Array.isArray(alerts) ? alerts : alerts.items || [];
      const target = list.find(a => a.status !== "ACKED" && (type !== "approach" || a.kind === "ACCESS_DETECTED")) || list[0];
      if (!target) return { mode: "local" }; // 서버에 경보가 없으면 화면만 닫는다(모의 경보)
      return http("POST", `/alerts/${target.id || target.alertId}/acknowledgements`, { action: "OK" }, { auth: kind === "cid" && config.carToken ? "vehicle" : "user" });
    },
    "pairing.current": () => ({ status: config.linkId ? "paired" : "none" }),
    // live 데모 이벤트: 서버에 모의 경보를 올려 WS 경로로 화면이 바뀌게 한다
    async "demo.event"({ event }) {
      const raise = (alertKind, severity, evidence) => http("POST", "/alerts", { sessionId: need("sessionId"), kind: alertKind, severity,
        sourceEventId: "demo-" + crypto.randomUUID(), evidence, executionMode: "MOCK" });
      if (event === "approach") return raise("ACCESS_DETECTED", "CRITICAL", { zone: "REAR_LEFT", dwellSec: 14 });
      if (event === "weather") return raise("HEAVY_RAIN", "CRITICAL", { warning: "호우경보", source: "DEMO" });
      if (event === "co2" || event === "co") {
        if (!config.carToken) throw new Error("CO₂·CO 시나리오는 차량 화면(carToken)에서만 보낼 수 있어요.");
        // 서버는 진행 중인 수면 세션에서만 이 경보를 만든다(아니면 201이어도 경보 없음)
        const session = await http("GET", `/sleep-sessions/${need("sessionId")}`);
        if (session.status !== "ACTIVE") throw new Error("이산화탄소·일산화탄소 경보는 수면 모드 중에만 생겨요. 먼저 수면 모드를 시작해 주세요.");
        return http("POST", "/demo/scenarios", { vehicleId: need("vehicleId"), sessionId: need("sessionId"), scenario: event === "co" ? "CO_DETECTED" : "CO2_CRITICAL" }, { auth: "vehicle" });
      }
      return { mode: "local" };
    },
    async "reviews.create"({ text }) {
      // 화면에 별점 입력이 없어 중립값 3으로 보낸다(서버는 1–5 필수)
      return http("POST", "/reviews", { tripId: need("tripId"), rating: 3, text });
    },
  };

  // 화면 설정 ↔ 서버 취침 계획(plan). 서버 plan에 없는 항목(조도·공조/절전 모드·화재 감지·문 잠금)은 차량 로컬
  async function savePlan(changes) {
    const session = await http("GET", `/sleep-sessions/${need("sessionId")}`);
    const plan = { ...session.plan };
    const timezone = plan.timezone || "Asia/Seoul";
    if ("heating" in changes) plan.targetTempC = changes.heating;
    if ("heating-enabled" in changes) plan.heatEnabled = changes["heating-enabled"];
    if ("approach-detection" in changes) plan.accessAlertEnabled = changes["approach-detection"];
    if ("sleep-music" in changes) plan.musicDurationMin = changes["sleep-music"];
    if (changes["sleep-music-enabled"] === false) plan.musicDurationMin = 0;
    if ("wake-time" in changes) plan.wakeAt = nextWakeAt(changes["wake-time"]);
    const before = JSON.stringify(session.plan);
    if (JSON.stringify(plan) === before) return { value: Object.values(changes)[0], mode: "local" };
    await http("PATCH", `/sleep-sessions/${config.sessionId}/plan`, { plan: { ...plan, timezone }, expectedVersion: session.planVersion });
    return { value: Object.values(changes)[0] };
  }
  // 분(0–1439) → 다음에 올 그 시각(한국 시각 기준) ISO
  function nextWakeAt(minutes) {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600e3);
    const target = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 0, minutes) - 9 * 3600e3);
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    return target.toISOString();
  }
  let qrDataUrl;
  async function assetDataUrl() {
    // 시연용: 화면에 이미 있는 QR 그림을 data URL로(app.js는 data:image/png 또는 https만 허용)
    if (qrDataUrl) return qrDataUrl;
    const img = document.querySelector("[data-pair-qr] img");
    const blob = await (await fetch(img?.getAttribute("src") ? new URL(img.getAttribute("src"), location.href) : "")).blob();
    qrDataUrl = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
    return qrDataUrl;
  }

  integration.configure(async ({ event, payload }) => {
    try {
      if (routes[event]) return { ok: true, data: await routes[event](payload) };
      if (LOCAL.has(event)) return { ok: true, data: { ...integration.local(event, payload), mode: "local" } };
      return { ok: true, data: { ...integration.local(event, payload), mode: "local-pending" } }; // 매핑 확정 전
    } catch (error) {
      return { ok: false, error: { message: error.message || "요청을 처리할 수 없어요." } };
    }
  });

  // 실시간: WS /v1/ws?token=…&vehicleId=… → 화면 이벤트로 전달
  const seen = new Set();
  let lastSeen = "";
  const prefix = kind === "cid" ? "cid-" : "mobile-";
  const flash = (text) => { try { if (text) sessionStorage.setItem("chabak-haru:flash", JSON.stringify(text)); } catch { /* 안내만 생략 */ } };
  const goTo = (target, text) => { flash(text); location.assign(prefix + target + ".html" + location.search); };
  const SCREENS = { ACCESS_DETECTED: "approach-alert", HEAVY_RAIN: "weather-alert" };
  const NOTICE = {
    CO_DETECTED: ["일산화탄소 경보", "실내 일산화탄소가 위험 수준이에요. 바로 차 밖으로 나가세요."],
    CO2_CRITICAL: ["이산화탄소 경보", "실내 이산화탄소가 매우 높아요. 머리가 아프거나 답답하면 잠시 밖으로 나가세요."],
    CO_ELEVATED: ["", "실내 일산화탄소가 올라가고 있어요."],
    CO2_HIGH: ["", "실내 이산화탄소가 높아요. 외기 유입을 늘리고 있는지 확인해 주세요."],
    SENSOR_DISCONNECTED: ["", "CO·CO₂ 측정기 연결이 끊겼어요. 측정기를 확인해 주세요."],
  };
  const pendingAlerts = new Map(); // alertId → 휴대폰 지연 타이머(D9)
  function onAlert(alert) {
    const target = SCREENS[alert.kind];
    if (target) {
      const open = () => {
        pendingAlerts.delete(alert.alertId);
        try { sessionStorage.setItem("chabak-live:alertId", alert.alertId); } catch { /* 확인 시 목록에서 찾음 */ }
        if (!screen.endsWith(target)) goTo(target);
      };
      // D9: 접근 경보는 차 화면 먼저, 응답이 없을 때만 휴대폰(기본 30초)
      if (alert.kind === "ACCESS_DETECTED" && kind === "mobile") pendingAlerts.set(alert.alertId, setTimeout(open, (alert.userResponseTimeoutSec || 30) * 1000));
      else open();
      return;
    }
    const [title, text] = NOTICE[alert.kind] || ["", "경보가 발생했어요: " + alert.kind];
    const widgets = window.ChabakWidgets;
    if (alert.severity === "CRITICAL" && title && widgets) {
      widgets.panel(title, text, [{ label: "확인했어요", run: () => http("POST", `/alerts/${alert.alertId}/acknowledgements`, { action: "OK" },
        { auth: kind === "cid" && config.carToken ? "vehicle" : "user" }).catch(error => widgets.message(error.message)) }]);
    } else widgets?.message(text);
  }
  function onAcked(ack) {
    const timer = pendingAlerts.get(ack.alertId);
    if (timer) { clearTimeout(timer); pendingAlerts.delete(ack.alertId); return; } // 차에서 확인 → 휴대폰은 울리지 않음
    let current = "";
    try { current = sessionStorage.getItem("chabak-live:alertId") || ""; } catch { /* 없음 */ }
    if (/approach-alert|weather-alert/.test(screen) && (!current || current === ack.alertId)) {
      try { sessionStorage.removeItem("chabak-live:alertId"); } catch { /* 무시 */ }
      goTo("sleep-mode", "다른 기기에서 경보를 확인했어요.");
    }
  }
  async function connect(attempt = 0) {
    if (!config.vehicleId) return;
    const token = kind === "cid" && config.carToken ? config.carToken : await userAuth().catch(() => "");
    if (!token) return;
    const url = new URL(base.replace(/^http/, "ws") + "/ws");
    url.searchParams.set("token", token);
    url.searchParams.set("vehicleId", config.vehicleId);
    if (lastSeen) url.searchParams.set("since", lastSeen);
    const socket = new WebSocket(url);
    socket.onmessage = ({ data }) => {
      let message;
      try { message = JSON.parse(data); } catch { return; }
      if (message.eventId) {
        if (seen.has(message.eventId)) return; // at-least-once 중복 제거
        seen.add(message.eventId);
        lastSeen = message.occurredAt || lastSeen;
      }
      const payload = message.payload || {};
      if (message.type === "STATE_SNAPSHOT") {
        const values = {};
        const v = (metric) => payload.changed?.[metric]?.value;
        if (v("evSocPct") != null) values["vehicle-soc"] = Math.round(v("evSocPct")) + "%";
        if (v("cabinTempC") != null) values["cabin-temperature"] = Number(v("cabinTempC")).toFixed(1) + "°C";
        if (v("co2Ppm") != null) values["cabin-co2"] = Math.round(v("co2Ppm")) + "ppm";
        if (Object.keys(values).length) integration.publish("ui.state", { values });
      }
      if (message.type === "ALERT_RAISED") onAlert(payload);
      if (message.type === "ALERT_ACKED") onAcked(payload);
      if (message.type === "PLAN_UPDATED" && payload.status === "STOPPED" && screen.endsWith("sleep-mode"))
        goTo("sunrise-alarm", "수면 모드가 끝났어요.");
      if (message.type === "LINK_HEALTH_CHANGED" && payload.status === "ACTIVE") integration.publish("pairing.paired", payload);
      integration.publish("server." + (message.type || "event"), message);
    };
    socket.onclose = ({ code }) => {
      if (code === 4403 || code === 4400) return; // 연결 없음·잘못된 요청은 재시도하지 않음
      if (code === 4401 && kind !== "cid") { userToken = ""; try { sessionStorage.removeItem(tokenKey); } catch { /* 무시 */ } }
      setTimeout(() => connect(attempt + 1), Math.min(30000, 1000 * 2 ** attempt));
    };
    socket.onopen = () => { attempt = 0; };
  }
  connect();
})();
