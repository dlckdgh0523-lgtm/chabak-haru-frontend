package com.chabakharu.handoff;

import org.json.JSONObject;

/**
 * The app team supplies its authenticated transport and vehicle SDK handlers here.
 * Calls run off the UI thread. Return only the data expected by the web contract.
 */
public interface BackendGateway {
    JSONObject dispatch(String event, JSONObject payload, String requestId) throws Exception;

    static BackendGateway unavailable() {
        return (event, payload, requestId) -> {
            throw new UnavailableException();
        };
    }

    final class UnavailableException extends Exception {
        public UnavailableException() { super("차량 또는 서버 연결을 사용할 수 없어요."); }
    }
}
