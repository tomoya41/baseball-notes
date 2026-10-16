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

public class MainActivity extends BridgeActivity {
    private static final String WEB_STATE = "baseball.webState";
    @Override public void onCreate(Bundle savedInstanceState) {
        Bundle webState = savedInstanceState == null ? null : savedInstanceState.getBundle(WEB_STATE);
        Intent launchIntent = getIntent();
        // A recreated Activity resumes its current WebView route, not the URI
        // which originally opened the task. New external intents still use the
        // normal Capacitor appUrlOpen path.
        if (webState != null && launchIntent != null) setIntent(new Intent(launchIntent).setData(null));
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        registerPlugin(FavoriteNotificationsPlugin.class);
        EdgeToEdge.enable(this);
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        getBridge().addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView webView) { applyFontLayout(webView); }
        });
        if (webState != null && getBridge().getWebView().restoreState(webState) == null && launchIntent != null) {
            onNewIntent(launchIntent);
        }
        applyFontLayout(getBridge().getWebView());
    }
    @Override public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (getBridge() != null) {
            String url = getBridge().getWebView().getUrl();
            String route = url == null ? null : Uri.parse(url).getFragment();
            // A pre-router loading page must not consume a pending cold link.
            if (route == null || !(route.startsWith("/NPB/") || route.startsWith("/MLB/"))) return;
            Bundle webState = new Bundle();
            if (getBridge().getWebView().saveState(webState) != null) outState.putBundle(WEB_STATE, webState);
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
