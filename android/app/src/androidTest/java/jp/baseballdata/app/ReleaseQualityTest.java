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
        scenario.onActivity(activity -> assertNull("Shared UI has no native action bar", activity.getSupportActionBar()));
        scenario.onActivity(activity -> assertTrue("No platform title bar obscures the shared header",
            activity.getActionBar() == null || !activity.getActionBar().isShowing()));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        js("location.hash='#/privacy'"); waitText("プライバシー・データ");
        js("document.body.insertAdjacentHTML('beforeend','<dialog id=qatest>QA</dialog>');document.getElementById('qatest').showModal()");
        scenario.onActivity(activity -> activity.getOnBackPressedDispatcher().onBackPressed());
        Thread.sleep(300); assertEquals("false", js("document.getElementById('qatest').open"));
        scenario.onActivity(activity -> activity.getOnBackPressedDispatcher().onBackPressed());
        waitText("野球がある、毎日。");
        assertTrue("Back returns to the league Home", js("location.hash").contains("/NPB/home"));
        shell("svc wifi disable"); shell("svc data disable");
        js("location.hash='#/MLB/sources'"); waitText("Retrosheet"); waitText("Chadwick");
        shell("svc wifi enable"); shell("svc data enable");
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
        js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='対戦・状況別を見る').click()");
        System.out.println("PERF bvp_ms=" + waitText("対戦投手を検索"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        js("location.hash='#/MLB/games/mlb%3Agame%3A0000523f-86d2-5c92-b466-d191e31baf38'");
        System.out.println("PERF game_detail_ms=" + waitText("試合結果"));
        waitText("PA");
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        js("new Promise(resolve=>{const q=indexedDB.open('baseball-public-responses-v1');q.onsuccess=()=>{const db=q.result;if(!db.objectStoreNames.length){resolve(0);return;}const r=db.transaction(db.objectStoreNames[0]).objectStore(db.objectStoreNames[0]).openCursor();let max=0;r.onsuccess=()=>{const c=r.result;if(c){max=Math.max(max,c.value.bytes||0);c.continue();}else resolve(max);};};}).then(n=>document.documentElement.dataset.cachemax=String(n))");
        for (int i=0; i<100 && js("document.documentElement.dataset.cachemax || 'pending'").equals("pending"); i++) Thread.sleep(50);
        assertTrue("Persistent public response cache measured", Long.parseLong(js("document.documentElement.dataset.cachemax")) > 0);
        System.out.println("PERF largest_cached_response_bytes=" + js("document.documentElement.dataset.cachemax"));
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
        String fixture = "{\"items\":[{\"league\":\"NPB\",\"kind\":\"player\",\"entityId\":\"canonical-player\"}]}";
        assertTrue(EodMessagingService.isFavoritePlayer(fixture, "canonical-player"));
        assertFalse(EodMessagingService.isFavoritePlayer(fixture, "removed-player"));
        assertFalse(EodMessagingService.isFavoritePlayer(fixture.replace("NPB", "MLB"), "canonical-player"));
        assertFalse(EodMessagingService.isFavoritePlayer("corrupt", "canonical-player"));
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
