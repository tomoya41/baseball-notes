package jp.baseballdata.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import android.view.Window;
import android.content.res.Configuration;
import android.webkit.WebView;
import android.net.Uri;

public class MainActivity extends BridgeActivity {
    private static final String WEB_ROUTE = "baseball.webRoute";
    private static final int MAX_ROUTE_LENGTH = 8192;
    private String restoredRoute;
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
    @Override public void onCreate(Bundle savedInstanceState) {
        String route = savedInstanceState == null ? null : savedInstanceState.getString(WEB_ROUTE);
        restoredRoute = isSavedRoute(route) ? route : null;
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        registerPlugin(FavoriteNotificationsPlugin.class);
        registerPlugin(RouteRestorePlugin.class);
        EdgeToEdge.enable(this);
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        getBridge().addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView webView) { applyFontLayout(webView); }
        });
        applyFontLayout(getBridge().getWebView());
    }
    @Override public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (getBridge() != null) {
            String url = getBridge().getWebView().getUrl();
            String route = savedRoute(url);
            // A pre-router loading page must not consume a pending cold link.
            if (route == null) return;
            outState.putString(WEB_ROUTE, route);
        }
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
