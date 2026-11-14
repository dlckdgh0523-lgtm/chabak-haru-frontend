package com.chabakharu.handoff;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String ASSET_PREFIX = "/assets/";
    private static final String START = ORIGIN + ASSET_PREFIX + "screens/mobile-onboarding-welcome.html";
    private static final int CAMERA_REQUEST = 101;
    private static final Set<String> ALLOWED_EVENTS = eventSet(
        "route.accept", "route.dismiss", "route.start", "route.detour", "route.destination",
        "place.reviews", "place.phone", "places.filters", "places.bookmark", "parking.sunrise",
        "vehicle.utility.enable", "vehicle.setting", "vehicle.settings.save", "vehicle.sleep.start",
        "vehicle.sleep.stop", "vehicle.v2l.details", "safety.evacuation.route",
        "safety.acknowledge", "safety.vehicleSignal", "safety.sos", "alarm.set", "alarm.snooze", "alarm.stop",
        "terms.document", "terms.accept", "pairing.begin", "pairing.confirm", "pairing.status", "pairing.skip",
        "contacts.list", "contacts.update", "contacts.reorder", "contacts.test", "contacts.finish",
        "voice.start", "voice.stop", "ui.ready"
    );

    private static final Set<String> STATE_EVENTS = eventSet(
        "ui.state", "vehicle.settings", "places.results", "contacts.updated", "pairing.paired", "map.updated"
    );

    private static Set<String> eventSet(String... names) {
        return Collections.unmodifiableSet(new HashSet<>(Arrays.asList(names)));
    }

    private final ExecutorService operations = new ThreadPoolExecutor(
        1, 1, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>(24)
    );
    private BackendGateway gateway;
    private WebView web;
    private PermissionRequest cameraRequest;
    private boolean alive;

    protected BackendGateway createGateway() {
        return BackendGateway.unavailable();
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        alive = true;
        gateway = createGateway();
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(mask, mask);
            }
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            TextView unavailable = new TextView(this);
            unavailable.setText(R.string.webview_unavailable);
            unavailable.setPadding(32, 50, 32, 32);
            setContentView(unavailable);
            return;
        }

        FrameLayout layout = new FrameLayout(this);
        layout.setBackgroundColor(Color.rgb(250, 252, 255));
        web = new WebView(this);
        layout.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(layout);

        View.OnApplyWindowInsetsListener insetsListener = (view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets edges = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                int keyboard = insets.getInsets(WindowInsets.Type.ime()).bottom;
                layout.setPadding(edges.left, edges.top, edges.right, Math.max(edges.bottom, keyboard));
                return WindowInsets.CONSUMED;
            }
            return insets;
        };
        layout.setOnApplyWindowInsetsListener(insetsListener);
        layout.requestApplyInsets();
        configureWebView();
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack
            );
        }
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(START + (BuildConfig.DEMO_UI ? "" : "?mode=live"));
        }
    }

    private void configureWebView() {
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler(ASSET_PREFIX, new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        web.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (trusted(uri)) return loader.shouldInterceptRequest(uri);
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override public void onPageCommitVisible(WebView view, String url) {
                if (url != null) updateSystemBars(Uri.parse(url).getPath());
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (trusted(uri)) return false;
                if (request.isForMainFrame() && "tel".equals(uri.getScheme())
                    && uri.getSchemeSpecificPart().matches("\\+?[0-9-]{7,20}")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_DIAL, uri));
                    } catch (ActivityNotFoundException ignored) {
                        // The device has no dialer.
                    }
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> authorizeCamera(request));
            }

            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (cameraRequest == request) cameraRequest = null;
                });
            }
        });

        WebViewCompat.addWebMessageListener(web, "ChabakNative", Collections.singleton(ORIGIN),
            (view, message, source, main, reply) -> {
                if (main && originMatches(source)) processMessage(message.getData(), reply);
            }
        );
    }

    private void updateSystemBars(String page) {
        if (page == null) return;
        boolean dark = page.matches(".*/mobile-(sleep-mode|weather-alert|approach-alert|sunrise-alarm|onboarding-scan)\\.html");
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(dark ? 0 : mask, mask);
            }
            if (web.getParent() instanceof FrameLayout parent)
                parent.setBackgroundColor(dark ? Color.rgb(23, 29, 57) : Color.rgb(250, 252, 255));
        } else {
            getWindow().setStatusBarColor(dark ? Color.rgb(23, 29, 57) : Color.rgb(250, 252, 255));
            getWindow().setNavigationBarColor(dark ? Color.rgb(23, 29, 57) : Color.rgb(250, 252, 255));
            getWindow().getDecorView().setSystemUiVisibility(dark ? 0
                : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    private static boolean originMatches(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private static boolean trusted(Uri uri) {
        return originMatches(uri) && uri.getPath() != null && uri.getPath().startsWith(ASSET_PREFIX);
    }

    private void authorizeCamera(PermissionRequest request) {
        String[] resources = request.getResources();
        boolean scanner = web != null && web.getUrl() != null
            && "/assets/screens/mobile-onboarding-scan.html".equals(Uri.parse(web.getUrl()).getPath());
        if (!alive || !scanner || !originMatches(request.getOrigin()) || resources.length != 1
            || !PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resources[0]) || cameraRequest != null) {
            request.deny();
            return;
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            return;
        }
        cameraRequest = request;
        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        PermissionRequest request = cameraRequest;
        if (requestCode != CAMERA_REQUEST || request == null) return;
        cameraRequest = null;
        if (results.length == 1 && results[0] == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            request.deny();
        }
    }

    private void processMessage(String json, JavaScriptReplyProxy reply) {
        if (!alive || json == null || json.length() > 16000) return;

        String requestId;
        String event;
        JSONObject payload;
        try {
            JSONObject envelope = new JSONObject(json);
            requestId = envelope.getString("id");
            event = envelope.getString("event");
            payload = envelope.getJSONObject("payload");
        } catch (JSONException ignored) {
            return;
        }
        if (!requestId.matches("[A-Za-z0-9-]{1,96}")) return;
        if (!ALLOWED_EVENTS.contains(event)) {
            sendReply(reply, requestId, null, "unsupported_event", "지원되지 않는 요청이에요.");
            return;
        }
        try {
            operations.execute(() -> {
                try {
                    sendReply(reply, requestId, gateway.dispatch(event, payload, requestId), null, null);
                } catch (BackendGateway.UnavailableException ignored) {
                    sendReply(reply, requestId, null, "not_configured", "차량 또는 서버 연결을 사용할 수 없어요.");
                } catch (Exception ignored) {
                    sendReply(reply, requestId, null, "operation_failed", "요청을 처리할 수 없어요.");
                }
            });
        } catch (RejectedExecutionException ignored) {
            sendReply(reply, requestId, null, "busy", "요청이 많아요. 잠시 후 다시 시도해 주세요.");
        }
    }

    private void sendReply(JavaScriptReplyProxy reply, String id, JSONObject data, String code, String message) {
        runOnUiThread(() -> {
            if (!alive) return;
            try {
                JSONObject result = new JSONObject().put("id", id).put("ok", code == null);
                if (code == null) result.put("data", data == null ? new JSONObject() : data);
                else result.put("error", new JSONObject().put("code", code).put("message", message));
                reply.postMessage(result.toString());
            } catch (JSONException | IllegalStateException ignored) {
                // The WebView may have navigated away before the reply.
            }
        });
    }

    /** Publish an allowlisted event received by the native vehicle or notification layer. */
    public void publishState(String event, JSONObject payload) {
        if (payload == null || !STATE_EVENTS.contains(event)) return;
        runOnUiThread(() -> {
            if (!alive || web == null || web.getUrl() == null || !trusted(Uri.parse(web.getUrl()))) return;
            web.evaluateJavascript("window.ChabakIntegration?.publish(" + JSONObject.quote(event)
                + ", JSON.parse(" + JSONObject.quote(payload.toString()) + "))", null);
        });
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        if (web != null) web.saveState(state);
        super.onSaveInstanceState(state);
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        navigateBack();
    }

    private void navigateBack() {
        if (web != null && web.canGoBack()) web.goBack();
        else finish();
    }

    @Override protected void onDestroy() {
        alive = false;
        if (cameraRequest != null) cameraRequest.deny();
        cameraRequest = null;
        operations.shutdownNow();
        if (web != null) {
            web.stopLoading();
            if (web.getParent() instanceof FrameLayout parent) parent.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
