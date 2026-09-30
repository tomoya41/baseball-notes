package jp.baseballdata.app;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.Intent;
import android.net.Uri;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.JSONTokener;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ReleaseQualityTest {
    private ActivityScenario<MainActivity> scenario;
    private String js(String expression) throws Exception {
        AtomicReference<String> value = new AtomicReference<>(); CountDownLatch latch = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(expression, result -> { value.set(result); latch.countDown(); }));
        assertTrue("WebView callback", latch.await(10, TimeUnit.SECONDS));
        Object parsed = new JSONTokener(value.get()).nextValue(); return String.valueOf(parsed);
    }
    private long waitText(String text) throws Exception {
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < 40000) { if (js("document.body.innerText").contains(text)) return System.currentTimeMillis()-start; Thread.sleep(100); }
        fail("Screen did not load: " + text + " / " + js("document.body.innerText")); return 0;
    }
    private void shell(String command) throws Exception {
        InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command).close();
    }
    @After public void close() throws Exception { shell("svc wifi enable"); shell("svc data enable"); if (scenario != null) scenario.close(); }
    @Test public void shellDeepLinksBackAndHistorical() throws Exception {
        long start = System.currentTimeMillis(); scenario = ActivityScenario.launch(MainActivity.class);
        waitText("BASEBALL"); System.out.println("PERF shell_ms=" + (System.currentTimeMillis()-start));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        js("location.hash='#/privacy'"); waitText("プライバシー・データ");
        js("document.body.insertAdjacentHTML('beforeend','<dialog id=qatest>QA</dialog>');document.getElementById('qatest').showModal()");
        scenario.onActivity(activity -> activity.getOnBackPressedDispatcher().onBackPressed());
        Thread.sleep(300); assertEquals("false", js("document.getElementById('qatest').open"));
        scenario.onActivity(activity -> activity.getOnBackPressedDispatcher().onBackPressed());
        waitText("今日の野球");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f"),
            InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
        scenario.close(); scenario = ActivityScenario.launch(intent);
        long player = waitText("大谷翔平"); System.out.println("PERF historical_player_ms=" + player);
        assertTrue(js("location.hash").contains("e70b8d12"));
        assertEquals("true", js("!!document.querySelector('button[aria-label=\"大谷翔平をお気に入りに追加\"]')"));
        js("document.querySelector('button[aria-label=\"大谷翔平をお気に入りに追加\"]').click()");
        waitText("お気に入りを保存しました");
        js("location.hash='#/MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f/analysis'");
        System.out.println("PERF analysis_ms=" + waitText("高度分析"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        js("location.hash='#/MLB/search'"); System.out.println("PERF search_ms=" + waitText("選手を探す"));
        // Real last-validated Player/manifest cache must survive a process/activity restart.
        shell("svc wifi disable"); shell("svc data disable"); Thread.sleep(1500);
        scenario.close(); scenario = ActivityScenario.launch(intent);
        long offline = waitText("大谷翔平"); waitText("保存済みデータ");
        System.out.println("PERF offline_player_ms=" + offline);
        assertEquals("true", js("!!document.querySelector('button[aria-label=\"大谷翔平をお気に入りから削除\"]')"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        shell("svc wifi enable"); shell("svc data enable");
        js("location.hash='#/MLB/my'"); waitText("大谷翔平");
    }
    @Test public void nativePreferencesSurviveRestartAndFirebaseDisabled() throws Exception {
        scenario = ActivityScenario.launch(MainActivity.class); waitText("BASEBALL");
        js("Capacitor.Plugins.Preferences.set({key:'qa-persistence',value:'canonical-key'}).then(()=>document.documentElement.dataset.qa='saved')");
        for (int i=0; i<100 && !js("document.documentElement.dataset.qa").equals("saved"); i++) Thread.sleep(50);
        assertEquals("saved", js("document.documentElement.dataset.qa"));
        scenario.close(); scenario = ActivityScenario.launch(MainActivity.class); waitText("BASEBALL");
        js("Capacitor.Plugins.Preferences.get({key:'qa-persistence'}).then(v=>document.documentElement.dataset.qa=v.value)");
        for (int i=0; i<100 && !js("document.documentElement.dataset.qa").equals("canonical-key"); i++) Thread.sleep(50);
        assertEquals("canonical-key", js("document.documentElement.dataset.qa"));
        js("Capacitor.Plugins.FavoriteNotifications.status().then(v=>document.documentElement.dataset.fcm=String(v.configured))");
        for (int i=0; i<100 && !js("document.documentElement.dataset.fcm").equals("false"); i++) Thread.sleep(50);
        assertEquals("false", js("document.documentElement.dataset.fcm"));
        js("Capacitor.Plugins.Preferences.remove({key:'qa-persistence'})");
    }
}
