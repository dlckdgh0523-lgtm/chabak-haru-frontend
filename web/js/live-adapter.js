"use strict";

// ?mode=live 웹 어댑터: 화면 이벤트 → 백엔드 REST(/v1)·WebSocket(/v1/ws).
// 서버에 API가 없는 기능은 LOCAL 목록에서 미리보기와 같은 로컬 값으로 처리한다.
(() => {
  const integration = window.ChabakIntegration;
  if (!integration || integration.demo) return;

  const query = new URLSearchParams(location.search);
  // 설정은 주소 쿼리로 한 번 넘기면 localStorage에 남는다. 예: ?mode=live&api=http://localhost:3000/v1&vehicleId=…&vehicleToken=…
  const KEYS = ["api", "user", "vehicleId", "vehicleToken", "sessionId", "tripId", "placeId"];
  const config = {};
  for (const key of KEYS) {
    let value = query.get(key);
    try {
      if (value) localStorage.setItem("chabak-live:" + key, value);
      else value = localStorage.getItem("chabak-live:" + key);
    } catch { /* 저장소를 못 쓰면 이번 페이지에서만 쓴다 */ }
    config[key] = value || "";
  }
  const base = (config.api || "http://localhost:3000/v1").replace(/\/$/, "");

  // 서버에 없는 기능(BACKEND-DIFF 3장): live에서도 로컬 처리
  const LOCAL = new Set([
    "terms.document", "place.phone", "places.bookmark", "places.filters",
    "alarm.set", "alarm.snooze", "alarm.stop",
    "route.accept", "route.start", "route.dismiss", "route.detour", "route.destination", "parking.sunrise",
    "voice.start", "voice.stop", "safety.vehicleSignal", "safety.sos", "safety.evacuation.route",
    "vehicle.v2l.details", "vehicle.utility.enable", "pairing.skip", "contacts.finish", "ui.ready",
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
      if (!config.vehicleToken) throw new Error("차량 토큰이 설정되지 않았어요. 주소에 vehicleToken을 넣어 주세요.");
      headers.Authorization = "Bearer " + config.vehicleToken;
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
    if (!response.ok) throw new Error(data.message || `서버 오류 (${response.status})`);
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
      const briefing = await http("GET", `/places/${encodeURIComponent(need("placeId"))}/briefing`);
      return { reviews: (briefing.reviews?.items || []).map(item => item.text).filter(Boolean) };
    },
  };

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
  async function connect(attempt = 0) {
    if (!config.vehicleId) return;
    const token = document.body.dataset.kind === "cid" && config.vehicleToken ? config.vehicleToken : await userAuth().catch(() => "");
    if (!token) return;
    const url = new URL(base.replace(/^http/, "ws") + "/ws");
    url.searchParams.set("token", token);
    url.searchParams.set("vehicleId", config.vehicleId);
    const socket = new WebSocket(url);
    socket.onmessage = ({ data }) => {
      let message;
      try { message = JSON.parse(data); } catch { return; }
      if (message.type === "PAIRING_CONFIRMED") integration.publish("pairing.paired", message);
      integration.publish("server." + (message.type || "event"), message);
    };
    socket.onclose = ({ code }) => {
      if (code === 4401 || code === 4403) return; // 인증 실패는 재시도하지 않음
      setTimeout(() => connect(attempt + 1), Math.min(30000, 1000 * 2 ** attempt));
    };
    socket.onopen = () => { attempt = 0; };
  }
  connect();
})();
