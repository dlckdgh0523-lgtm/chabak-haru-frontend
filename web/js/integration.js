"use strict";

(() => {
  const mock = {
    "terms.document": () => ({
      text: "미리보기용 약관 자리입니다. 운영 환경에서 서버가 반환하는 약관 전문과 버전을 표시합니다.",
      version: "demo",
    }),
    "place.reviews": () => ({
      reviews: [
        "파도 소리 말고는 아무 소리도 없어요. 트렁크 열면 바로 해가 떠서 좋아요.",
        "새벽에 바람이 세서 생각보다 추웠어요. 화장실은 도보 6분 멀지 않아요.",
      ],
    }),
    "pairing.begin": () => ({ status:"demo", sessionId:"demo-session" }),
    "pairing.status": () => ({ status:"pending" }),
    "pairing.confirm": () => ({ status:"demo" }),
    "contacts.list": () => ({ contacts:[
      { id:"first", name:"이차박", maskedPhone:"010-****-1234" },
      { id:"second", name:"이하루", maskedPhone:"010-****-5678" },
    ] }),
    "vehicle.v2l.details": payload => payload.normal ? { label:"냉장고 (1번 포트)", temperature:15, observedAt:"18:16", status:"charging" }
      : { label:"냉장고 (1번 포트)", temperature:48, observedAt:"18:16", status:"overheated" },
  };
  const demo = new URLSearchParams(location.search).get("mode") !== "live";
  const timeoutMs = 12000;
  const handlers = new Set();
  const waiting = new Map();
  let provider;
  let serial = 0;
  const bridge = window.ChabakNative;

  if (bridge && typeof bridge.postMessage === "function") {
    bridge.onmessage = ({data}) => {
      let result;
      try { result = JSON.parse(data); }
      catch { return; }
      if (result.event && result.payload && typeof result.payload === "object") {
        for (const handler of handlers) handler(result.event, result.payload);
        return;
      }
      const operation = waiting.get(result.id);
      if (!operation) return;
      clearTimeout(operation.timeout);
      waiting.delete(result.id);
      if (result.ok) operation.resolve(result.data || {});
      else operation.reject(new Error(result.error?.message || "요청을 처리할 수 없어요."));
    };
  }

  async function request(event, payload = {}) {
    if (typeof event !== "string" || !payload || typeof payload !== "object") throw new TypeError("잘못된 요청 형식");
    const id = globalThis.crypto?.randomUUID?.() || "ch-" + Date.now() + "-" + ++serial;
    const envelope = { id, event, payload, screen:document.body.dataset.screen };
    if (demo) {
      const data = mock[event]?.(payload) ?? {};
      return { ...data, mode:"demo", accepted:true };
    }
    if (provider) {
      let timeout;
      try {
        const result = await Promise.race([
          Promise.resolve().then(() => provider(envelope)),
          new Promise((_, reject) => timeout = setTimeout(() => reject(new Error("응답이 지연되었어요.")), timeoutMs)),
        ]);
        if (!result || result.ok !== true) throw new Error(result?.error?.message || "요청을 처리할 수 없어요.");
        return result.data || {};
      } finally { clearTimeout(timeout); }
    }
    if (!bridge || typeof bridge.postMessage !== "function") throw new Error("연결 서비스가 설정되어 있지 않아요.");
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiting.delete(id);
        reject(new Error("응답이 지연되었어요."));
      }, timeoutMs);
      waiting.set(id, {resolve,reject,timeout});
      bridge.postMessage(JSON.stringify(envelope));
    });
  }

  window.ChabakIntegration = Object.freeze({
    demo, request,
    configure(adapter) {
      if (typeof adapter !== "function") throw new TypeError("adapter는 함수여야 합니다.");
      provider = adapter;
      window.dispatchEvent(new Event("chabak-adapter-ready"));
    },
    subscribe(handler) {
      if (typeof handler !== "function") throw new TypeError("handler는 함수여야 합니다.");
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    publish(event,payload) {
      if (typeof event !== "string" || !payload || typeof payload !== "object") return;
      for (const handler of handlers) handler(event,payload);
    },
  });
})();
