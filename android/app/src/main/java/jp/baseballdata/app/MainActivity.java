package jp.baseballdata.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import android.view.Window;
import android.content.res.Configuration;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        registerPlugin(FavoriteNotificationsPlugin.class);
        EdgeToEdge.enable(this);
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        getBridge().addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView webView) { applyFontLayout(webView); }
        });
        applyFontLayout(getBridge().getWebView());
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
