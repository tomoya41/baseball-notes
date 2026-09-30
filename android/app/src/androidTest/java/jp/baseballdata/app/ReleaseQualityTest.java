package jp.baseballdata.app;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Bitmap;
import java.io.File;
import java.io.FileOutputStream;
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
        // Drain the pipe so configuration commands finish before we inspect the WebView.
        try (android.os.ParcelFileDescriptor.AutoCloseInputStream output = new android.os.ParcelFileDescriptor.AutoCloseInputStream(
                InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))) {
            byte[] buffer = new byte[1024];
            while (output.read(buffer) != -1) { /* Shell output is not test data. */ }
        }
    }
    private void waitCondition(String label, String expression) throws Exception {
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < 40000) {
            if (js("Boolean(" + expression + ")").equals("true")) return;
            Thread.sleep(100);
        }
        fail(label + " / " + js("location.hash + '\\n' + document.body.innerText"));
    }
    private void waitPaint() throws Exception {
        js("delete document.documentElement.dataset.qaPaint;requestAnimationFrame(()=>requestAnimationFrame(()=>document.documentElement.dataset.qaPaint='ready'))");
        waitCondition("Two rendered frames", "document.documentElement.dataset.qaPaint==='ready'");
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        Thread.sleep(400);
    }
    private void setTheme(String theme, String label) throws Exception {
        js("location.hash='#/MLB/my'");
        waitCondition("Appearance controls", "location.hash==='#/MLB/my' && !!document.querySelector('[aria-label=\"表示モード\"] button')");
        js("Array.from(document.querySelectorAll('[aria-label=\"表示モード\"] button')).find(b=>b.textContent==='" + label + "').click()");
        waitCondition("Explicit " + theme + " theme", "document.documentElement.dataset.theme==='" + theme + "'");
        js("location.hash='#/MLB/home'");
        waitHomeStatistics();
        waitPaint();
    }
    private void waitViewport(int width) throws Exception {
        waitCondition("Viewport " + width, "window.innerWidth===" + width);
        waitPaint();
    }
    private void waitHomeStatistics() throws Exception {
        long start = System.currentTimeMillis(); int retries = 0;
        while (System.currentTimeMillis() - start < 60000) {
            String text = js("document.body?.innerText || ''");
            if (js("location.hash").startsWith("#/MLB/home") && text.contains("1.014") && text.contains("0.696") &&
                js("document.querySelectorAll('.follow-player').length===4 && !Array.from(document.querySelectorAll('.follow-player-stats')).some(e=>e.textContent.includes('読み込'))").equals("true")) return;
            if (text.contains("再読み込み") && retries < 5) {
                Thread.sleep(3000);
                js("Array.from(document.querySelectorAll('button')).filter(b=>b.textContent==='再読み込み').forEach(b=>b.click())"); retries++;
            }
            Thread.sleep(200);
        }
        fail("Historical Home statistics did not load: " + js("document.body?.innerText || ''"));
    }
    private void screenshot(String name) throws Exception {
        waitPaint();
        File dir = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "ui-redesign");
        assertTrue(dir.isDirectory() || dir.mkdirs());
        Bitmap image = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull("Native screenshot", image);
        try (FileOutputStream file = new FileOutputStream(new File(dir, name + ".png"))) { assertTrue(image.compress(Bitmap.CompressFormat.PNG, 100, file)); }
        finally { image.recycle(); }
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
        waitText("最近の試合");
        assertTrue("Back returns to the league Home", js("location.hash").contains("/NPB/home"));
        shell("svc wifi disable"); shell("svc data disable");
        js("location.hash='#/MLB/sources'"); waitText("Retrosheet"); waitText("Chadwick");
        shell("svc wifi enable"); shell("svc data enable");
        long homeStart = System.currentTimeMillis(); js("location.hash='#/MLB/home'");
        waitText("日本人選手");
        waitHomeStatistics();
        System.out.println("PERF mlb_home_ms=" + (System.currentTimeMillis() - homeStart));
        assertEquals("Four actual Player summaries", "4", js("document.querySelectorAll('.follow-player').length"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        setTheme("light", "ライト"); waitViewport(360); screenshot("mlb-home-360-light");
        setTheme("dark", "ダーク"); waitViewport(360); screenshot("mlb-home-360-dark");
        setTheme("light", "ライト"); shell("wm size 600x1000"); waitViewport(600); waitHomeStatistics();
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth")); screenshot("mlb-home-600");
        shell("wm size 360x800"); waitViewport(360);
        js("location.hash='#/MLB/schedule?season=2025&date=2025-09-28'");
        waitCondition("Historical schedule rendered", "location.hash.includes('/MLB/schedule') && !!document.querySelector('.date-ribbon') && document.querySelectorAll('.scoreboard-row').length===15 && !document.querySelector('.skeleton-page')");
        assertEquals("true", js("!!document.querySelector('button[aria-label=\"前日\"]')"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth")); screenshot("mlb-schedule-360");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f"),
            InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
        scenario.close(); scenario = ActivityScenario.launch(intent);
        long playerStart = System.currentTimeMillis();
        waitCondition("Loaded Ohtani profile", "location.hash.includes('e70b8d12') && document.querySelector('.profile-header h1')?.textContent==='大谷翔平' && document.querySelector('.metric-primary-grid')?.textContent.includes('1.014') && !document.querySelector('.skeleton-page')");
        System.out.println("PERF historical_player_ms=" + (System.currentTimeMillis()-playerStart));
        screenshot("mlb-player-360");
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
        long gameStart = System.currentTimeMillis();
        waitCondition("Loaded Game score and participants", "location.hash.includes('0000523f') && !!document.querySelector('.score-hero') && document.querySelectorAll('.mlb-box-team').length===2 && document.querySelectorAll('.mlb-box-team tbody tr').length>18 && !document.querySelector('.skeleton-page')");
        System.out.println("PERF game_detail_ms=" + (System.currentTimeMillis()-gameStart));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        screenshot("mlb-game-360");
        js("new Promise(resolve=>{const q=indexedDB.open('baseball-public-responses-v1');q.onsuccess=()=>{const db=q.result;if(!db.objectStoreNames.length){resolve(0);return;}const r=db.transaction(db.objectStoreNames[0]).objectStore(db.objectStoreNames[0]).openCursor();let max=0;r.onsuccess=()=>{const c=r.result;if(c){max=Math.max(max,c.value.bytes||0);c.continue();}else resolve(max);};};}).then(n=>document.documentElement.dataset.cachemax=String(n))");
        for (int i=0; i<100 && js("document.documentElement.dataset.cachemax || 'pending'").equals("pending"); i++) Thread.sleep(50);
        assertTrue("Persistent public response cache measured", Long.parseLong(js("document.documentElement.dataset.cachemax")) > 0);
        System.out.println("PERF largest_cached_response_bytes=" + js("document.documentElement.dataset.cachemax"));
        js("location.hash='#/MLB/search'"); System.out.println("PERF search_ms=" + waitText("選手一覧"));
        assertEquals("Search input is available", "true", js("!!document.querySelector('main input[type=search]')"));
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
