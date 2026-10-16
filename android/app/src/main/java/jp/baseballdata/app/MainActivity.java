package jp.baseballdata.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import android.view.Window;
import android.content.res.Configuration;
import android.webkit.WebView;
import android.content.Intent;
import android.net.Uri;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends BridgeActivity {
    private static final String WEB_STATE = "baseball.webState";
    private static final String WEB_ROUTE = "baseball.webRoute";
    private static final int MAX_ROUTE_LENGTH = 8192;
    private static final int MAX_WEB_STATE_BYTES = 128 * 1024;
    private static boolean isSavedRoute(String route) {
        if (route == null || route.length() > MAX_ROUTE_LENGTH) return false;
        String path = Uri.decode(route.split("\\?", 2)[0]);
        return path.startsWith("/NPB/") || path.startsWith("/MLB/") || path.equals("/privacy");
    }
    static String savedRoute(String url) {
        String route = url == null ? null : Uri.parse(url).getEncodedFragment();
        return isSavedRoute(route) ? route : null;
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        String route = savedInstanceState == null ? null : savedInstanceState.getString(WEB_ROUTE);
        boolean resume = isSavedRoute(route);
        Bundle webState = !resume ? null : savedInstanceState.getBundle(WEB_STATE);
        Intent launchIntent = getIntent();
        // A recreated Activity resumes its current WebView route, not the URI
        // which originally opened the task. New external intents still use the
        // normal Capacitor appUrlOpen path.
        if (resume && launchIntent != null) setIntent(new Intent(launchIntent).setData(null));
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        registerPlugin(FavoriteNotificationsPlugin.class);
        EdgeToEdge.enable(this);
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        getBridge().addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView webView) { applyFontLayout(webView); }
        });
        if (resume && (webState == null || getBridge().getWebView().restoreState(webState) == null)) {
            getBridge().getWebView().loadUrl(getBridge().getLocalUrl() + "/#" + route);
        }
        applyFontLayout(getBridge().getWebView());
    }
    @Override public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (getBridge() != null) {
            String url = getBridge().getWebView().getUrl();
            String route = savedRoute(url);
            // A pre-router loading page must not consume a pending cold link.
            if (!isSavedRoute(route)) return;
            outState.putString(WEB_ROUTE, route);
            if (WebViewFeature.isFeatureSupported(WebViewFeature.SAVE_STATE)) {
                Bundle webState = new Bundle();
                WebViewCompat.saveState(getBridge().getWebView(), webState, MAX_WEB_STATE_BYTES, false);
                outState.putBundle(WEB_STATE, webState);
            }
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
