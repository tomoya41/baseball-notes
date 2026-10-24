package jp.baseballdata.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.WebViewListener;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import android.view.Window;
import android.content.res.Configuration;
import android.webkit.WebView;
import android.net.Uri;
import android.content.Intent;

public class MainActivity extends BridgeActivity {
    private static final String WEB_ROUTE = "baseball.webRoute";
    private static final int MAX_ROUTE_LENGTH = 8192;
    private String restoredRoute;
    private volatile String currentRoute;
    private volatile boolean routerObserved;
    private String visitedRoute;
    private boolean visitedRouteObserved;
    private boolean initialIntentPending = true;
    private static boolean isSavedRoute(String route) {
        if (route == null || route.length() > MAX_ROUTE_LENGTH) return false;
        String path = Uri.decode(route.split("\\?", 2)[0]);
        return path.startsWith("/NPB/") || path.startsWith("/MLB/") || path.equals("/privacy");
    }
    static String savedRoute(String url) {
        String route = url == null ? null : Uri.parse(url).getEncodedFragment();
        return isSavedRoute(route) ? route : null;
    }
    String consumeRestoredRoute() {
        String route = restoredRoute;
        restoredRoute = null;
        return route;
    }
    void rememberRoute(String route) {
        currentRoute = isSavedRoute(route) ? route : null;
        routerObserved = true;
    }
    void observeVisitedRoute(String url) {
        // The initial loading URL has no fragment; retain a pending restore.
        // Invalid/oversized app fragments explicitly clear the previous route.
        if (url == null || Uri.parse(url).getEncodedFragment() == null) return;
        visitedRoute = savedRoute(url);
        visitedRouteObserved = true;
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        String route = savedInstanceState == null ? null : savedInstanceState.getString(WEB_ROUTE);
        restoredRoute = isSavedRoute(route) ? route : null;
        currentRoute = restoredRoute;
        routerObserved = restoredRoute != null;
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        registerPlugin(FavoriteNotificationsPlugin.class);
        registerPlugin(RouteRestorePlugin.class);
        EdgeToEdge.enable(this);
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                super.doUpdateVisitedHistory(view, url, isReload);
                observeVisitedRoute(url);
            }
        });
        getBridge().addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView webView) { applyFontLayout(webView); }
        });
        applyFontLayout(getBridge().getWebView());
    }
    @Override public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (getBridge() != null) {
            String url = getBridge().getWebView().getUrl();
            // History callbacks run on the Activity thread before recreation;
            // the asynchronous JS acknowledgement can still describe the prior
            // screen. Keep that acknowledgement only as a pre-router fallback.
            String route = visitedRouteObserved ? visitedRoute : routerObserved ? currentRoute : savedRoute(url);
            // A pre-router loading page must not consume a pending cold link.
            outState.remove(WEB_ROUTE);
            if (route == null) return;
            outState.putString(WEB_ROUTE, route);
        }
    }
    @Override protected void onNewIntent(Intent intent) {
        // Pinned Capacitor BridgeActivity.load invokes this once during create.
        // A restored Activity must not replay that original URI; real later
        // external intents are always forwarded without a time-based filter.
        boolean initial = initialIntentPending;
        initialIntentPending = false;
        if (initial && restoredRoute != null) return;
        super.onNewIntent(intent);
    }
    // WebView text zoom can enlarge painted glyphs without enlarging flex bases.
    // Expose only OS font scale for layout; never reduce the user's text zoom.
    private void applyFontLayout(WebView webView) {
        float scale = getResources().getConfiguration().fontScale;
        webView.evaluateJavascript("(()=>{const r=document.documentElement;if(!r)return;" +
            "r.style.setProperty('--android-font-scale','" + Float.toString(scale) + "');" +
            "r.toggleAttribute('data-large-font'," + (scale >= 1.5f) + ");})()", null);
    }
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        EdgeToEdge.enable(this);
        if (getBridge() != null) applyFontLayout(getBridge().getWebView());
    }
}
