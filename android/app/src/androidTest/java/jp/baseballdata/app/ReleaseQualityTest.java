package jp.baseballdata.app;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.Intent;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Parcel;
import android.view.MotionEvent;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
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
        while (System.currentTimeMillis() - start < 40000) { if (js("document.body?.innerText || ''").contains(text)) return System.currentTimeMillis()-start; Thread.sleep(100); }
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
    private void setNetwork(boolean online) throws Exception {
        shell("cmd connectivity airplane-mode " + (online ? "disable" : "enable"));
        shell("svc wifi " + (online ? "enable" : "disable"));
        shell("svc data " + (online ? "enable" : "disable"));
        ConnectivityManager manager = InstrumentationRegistry.getInstrumentation().getTargetContext().getSystemService(ConnectivityManager.class);
        long start=System.currentTimeMillis();
        while(System.currentTimeMillis()-start<30000) {
            android.net.Network active=manager.getActiveNetwork();
            NetworkCapabilities capabilities=active==null?null:manager.getNetworkCapabilities(active);
            if(online ? capabilities!=null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) : active==null) {
                Thread.sleep(500); return;
            }
            Thread.sleep(250);
        }
        fail("Actual emulator transport did not become " + (online?"validated online":"offline"));
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
    private String preference(String key) throws Exception {
        js("delete document.documentElement.dataset.qaPreference;Capacitor.Plugins.Preferences.get({key:'" + key + "'}).then(v=>document.documentElement.dataset.qaPreference=v.value || 'null')");
        waitCondition("Native preference loaded", "document.documentElement.dataset.qaPreference!==undefined");
        return js("document.documentElement.dataset.qaPreference");
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
    private static boolean expectedFontTransition(RuntimeException transition) {
        String message = String.valueOf(transition.getMessage());
        return transition instanceof NullPointerException
            ? message.equals("Cannot run onActivity since Activity has been destroyed already")
            : transition instanceof IllegalStateException && message.endsWith("but was DESTROYED");
    }
    @Test public void fontTransitionGuardDoesNotHideUnrelatedFailures() {
        assertTrue(expectedFontTransition(new NullPointerException("Cannot run onActivity since Activity has been destroyed already")));
        assertTrue(expectedFontTransition(new IllegalStateException("Activity's stage must be [PAUSED, RESUMED, STOPPED] but was DESTROYED")));
        assertFalse(expectedFontTransition(new NullPointerException("WebView is null")));
        assertFalse(expectedFontTransition(new IllegalStateException("Unexpected route state")));
        assertFalse(expectedFontTransition(new RuntimeException("Cannot run onActivity since Activity has been destroyed already")));
    }
    private void fontScaleAndRecreate(float scale) throws Exception {
        shell("settings put system font_scale " + scale);
        // fontScale deliberately uses normal OS recreation. Do not ask
        // ActivityScenario to recreate the old Activity while Android replaces it.
        // Observe the new WebView's actual native-provided layout scale first.
        long start = System.currentTimeMillis(), readySince = 0;
        while (System.currentTimeMillis() - start < 20000) {
            boolean ready = false;
            try {
                if (scenario.getState() == androidx.lifecycle.Lifecycle.State.RESUMED)
                    ready = js("document.documentElement ? getComputedStyle(document.documentElement).getPropertyValue('--android-font-scale').trim() : ''").equals(Float.toString(scale));
            } catch (RuntimeException transition) {
                // Only this bounded, expected configuration transition may wait.
                // A destroyed app that never resumes still fails the deadline.
                if (!expectedFontTransition(transition)) throw transition;
            }
            if (!ready) readySince = 0;
            else if (readySince == 0) readySince = System.currentTimeMillis();
            else if (System.currentTimeMillis() - readySince >= 500) {
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.recreate(); return;
            }
            Thread.sleep(100);
        }
        fail("Native font configuration did not settle at " + scale + "; Activity=" + scenario.getState());
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
    private void waitIme(boolean visible) throws Exception {
        AtomicReference<Boolean> actual = new AtomicReference<>(false);
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < 15000) {
            scenario.onActivity(activity -> {
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(activity.getWindow().getDecorView());
                actual.set(insets != null && insets.isVisible(WindowInsetsCompat.Type.ime()));
            });
            if (actual.get() == visible) return;
            Thread.sleep(100);
        }
        fail("Actual soft keyboard visibility should be " + visible);
    }
    private void tapSearchInput() throws Exception {
        // Send a real Android touch, rather than claiming a DOM focus opens the IME.
        js("document.querySelector('main input[type=search]').scrollIntoView({block:'center'})");
        waitPaint();
        org.json.JSONArray point = new org.json.JSONArray(js("(()=>{const r=document.querySelector('main input[type=search]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth]})()"));
        AtomicReference<float[]> screen = new AtomicReference<>();
        scenario.onActivity(activity -> {
            android.webkit.WebView web = activity.getBridge().getWebView();
            int[] location = new int[2]; web.getLocationOnScreen(location);
            float scale = web.getWidth() / (float) point.optDouble(2);
            screen.set(new float[]{location[0] + (float) point.optDouble(0)*scale, location[1] + (float) point.optDouble(1)*scale});
        });
        long now = android.os.SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, screen.get()[0], screen.get()[1], 0);
        MotionEvent up = MotionEvent.obtain(now, now+60, MotionEvent.ACTION_UP, screen.get()[0], screen.get()[1], 0);
        try {
            InstrumentationRegistry.getInstrumentation().sendPointerSync(down);
            InstrumentationRegistry.getInstrumentation().sendPointerSync(up);
        } finally { down.recycle(); up.recycle(); }
        waitIme(true);
    }
    @After public void close() throws Exception { shell("settings put system font_scale 1.0"); shell("wm size 360x800"); shell("cmd connectivity airplane-mode disable"); shell("svc wifi enable"); shell("svc data enable"); if (scenario != null) scenario.close(); }
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
        waitCondition("Back returned Home", "location.hash.includes('/NPB/home') && !!document.querySelector('main')");
        assertTrue("Back returns to the league Home", js("location.hash").contains("/NPB/home"));
        setNetwork(false);
        js("location.hash='#/MLB/sources'"); waitText("Retrosheet"); waitText("Chadwick");
        setNetwork(true);
        long homeStart = System.currentTimeMillis(); js("location.hash='#/MLB/home'");
        // A transient fetch error after restoring transport needs the real Retry
        // control. Waiting for a heading first would fail before the bounded
        // recovery helper can verify the actual four-player statistics.
        waitHomeStatistics();
        System.out.println("PERF mlb_home_ms=" + (System.currentTimeMillis() - homeStart));
        assertEquals("Four actual Player summaries", "4", js("document.querySelectorAll('.follow-player').length"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        setTheme("light", "ライト"); waitViewport(360); screenshot("mlb-home-360-light");
        setTheme("dark", "ダーク"); waitViewport(360); screenshot("mlb-home-360-dark");
        waitCondition("Dated Home portrait loaded", "document.querySelector('.home-player-lead .licensed-player-photo img')?.naturalWidth>0");
        assertEquals("Photo year remains explicit next to 2025 stats", "true", js("document.querySelector('.home-player-lead .licensed-player-photo')?.textContent.includes('2024年撮影')"));
        assertEquals("Lead counting/rate values do not overlap", "true", js("Array.from(document.querySelectorAll('.home-player-lead .follow-statline')).every(line=>{const values=line.querySelectorAll('strong');return values.length===2 && values[0].getBoundingClientRect().right<=values[1].getBoundingClientRect().left;})"));
        for (float scale : new float[]{1.5f,2.0f}) {
            fontScaleAndRecreate(scale); waitHomeStatistics(); waitViewport(360);
            assertEquals("Home photo/metrics retain enlarged text without overflow", "true", js("document.documentElement.scrollWidth<=innerWidth && document.querySelectorAll('.bottom-nav a').length===5"));
            assertEquals("Large Home tab labels stay on one line", "true", js("Array.from(document.querySelectorAll('.home-mode-nav>button')).every(b=>{const r=document.createRange();r.selectNodeContents(b);return r.getClientRects().length===1;})"));
            assertEquals("Large Home text puts statistics before the supplementary portrait", "true", js("document.querySelector('.home-player-lead .follow-player-stats').getBoundingClientRect().top<document.querySelector('.home-player-lead .licensed-player-photo').getBoundingClientRect().top"));
            screenshot("mlb-home-font-" + scale + "-dark");
            setTheme("light", "ライト"); waitViewport(360); screenshot("mlb-home-font-" + scale + "-light");
            setTheme("dark", "ダーク");
        }
        fontScaleAndRecreate(1.0f); waitHomeStatistics(); waitViewport(360);
        js("location.hash='#/NPB/home?homeSeason=autumn'");
        waitCondition("NPB seasonal links and saved games", "document.querySelectorAll('.seasonal-stories>a').length===3 && document.querySelectorAll('.today-board .scoreboard-row').length===2");
        assertEquals("Seasonal Home has no horizontal overflow", "true", js("document.documentElement.scrollWidth<=innerWidth")); screenshot("npb-home-360-dark");
        setTheme("light", "ライト"); shell("wm size 600x1000");
        // A recreated Surface prevents the emulator compositor retaining the old 360px buffer.
        scenario.recreate(); waitText("BASEBALL"); js("location.hash='#/MLB/home'"); waitViewport(600); waitHomeStatistics();
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth")); screenshot("mlb-home-600");
        for (int width : new int[]{390,768,1280}) {
            shell("wm size " + width + "x1000"); scenario.recreate(); waitText("BASEBALL");
            js("location.hash='#/MLB/home'"); waitViewport(width); waitHomeStatistics();
            assertEquals("Home has no overflow at " + width,"true",js("document.documentElement.scrollWidth<=innerWidth"));
            screenshot("mlb-home-" + width);
        }
        shell("wm size 360x800"); scenario.recreate(); waitText("BASEBALL"); waitViewport(360);
        js("location.hash='#/MLB/schedule?season=2025&date=2025-09-28'");
        waitCondition("Historical schedule rendered", "location.hash.includes('/MLB/schedule') && !!document.querySelector('.date-ribbon') && document.querySelectorAll('.scoreboard-row').length===15 && !document.querySelector('.skeleton-page')");
        assertEquals("true", js("!!document.querySelector('button[aria-label=\"前日\"]')"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth")); screenshot("mlb-schedule-360");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f"),
            InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
        scenario.close(); scenario = ActivityScenario.launch(intent);
        long playerStart = System.currentTimeMillis();
        waitCondition("Loaded Ohtani profile", "location.hash.includes('e70b8d12') && document.querySelector('.player-identity h1')?.textContent==='大谷翔平' && document.querySelector('.headline-stats')?.textContent.includes('1.014') && !document.querySelector('.skeleton-page')");
        System.out.println("PERF historical_player_ms=" + (System.currentTimeMillis()-playerStart));
        screenshot("mlb-player-360");
        js("document.querySelector('button[aria-label=\"選手の操作\"]').click()");
        waitCondition("Player actions dialog", "!!document.querySelector('dialog[open]')");
        scenario.onActivity(activity -> activity.getOnBackPressedDispatcher().onBackPressed());
        waitCondition("Back closes actions without leaving Player", "!document.querySelector('dialog[open]') && location.hash.includes('e70b8d12')");
        fontScaleAndRecreate(1.5f); waitText("大谷翔平"); waitViewport(360);
        assertEquals("Large system font has no horizontal overflow", "true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        assertEquals("Expanded headline numbers remain one readable line", "true", js("Array.from(document.querySelectorAll('.headline-stats dd')).length>0 && Array.from(document.querySelectorAll('.headline-stats dd')).every(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects().length===1;})"));
        screenshot("mlb-player-font-150");
        shell("wm size 800x360"); scenario.recreate(); waitText("大谷翔平"); waitViewport(800);
        assertEquals("Landscape has no horizontal overflow", "true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        screenshot("mlb-player-landscape");
        shell("wm size 360x800"); fontScaleAndRecreate(1.0f); waitText("大谷翔平"); waitViewport(360);
        assertTrue(js("location.hash").contains("e70b8d12"));
        assertEquals("true", js("!!document.querySelector('button[aria-label=\"大谷翔平をお気に入りに追加\"]')"));
        js("document.querySelector('button[aria-label=\"大谷翔平をお気に入りに追加\"]').click()");
        waitCondition("Favorite saved", "!!document.querySelector('button[aria-label=\"大谷翔平をお気に入りから削除\"]')");
        // Exercise actual React controls and the Native Preferences adapter, not an injected library fixture.
        js("document.querySelector('button[aria-label=\"選手の操作\"]').click()");
        waitCondition("Player collection action", "!!document.querySelector('button[aria-label=\"大谷翔平をコレクションに整理\"]')");
        js("(()=>{const b=document.querySelector('button[aria-label=\"大谷翔平をコレクションに整理\"]');b.focus();b.click();})()");
        waitCondition("Collection picker", "!!document.querySelector('dialog[aria-label=\"大谷翔平のコレクション\"] input[maxlength=\"60\"]')");
        js("(()=>{const e=document.querySelector('dialog[aria-label=\"大谷翔平のコレクション\"] input[maxlength=\"60\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'端末QA');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
        waitPaint();
        js("document.querySelector('dialog[aria-label=\"大谷翔平のコレクション\"] .library-picker-content form').requestSubmit()");
        waitCondition("Created Collection label", "Array.from(document.querySelectorAll('dialog label')).some(e=>e.textContent==='端末QA')");
        js("Array.from(document.querySelectorAll('dialog label')).find(e=>e.textContent==='端末QA').querySelector('input').click()");
        waitCondition("Collection membership saved in UI", "Array.from(document.querySelectorAll('dialog label')).find(e=>e.textContent==='端末QA')?.querySelector('input').checked");
        assertTrue("Collection persists canonical ID", preference("baseball:personal-library:v1").contains("e70b8d12-aa41-50c0-9c1b-d468d451355f"));
        scenario.onActivity(activity -> activity.getOnBackPressedDispatcher().onBackPressed());
        waitCondition("Back closes top picker only and restores focus after unmount", "document.querySelectorAll('dialog').length===1 && document.querySelectorAll('dialog[open]').length===1 && document.activeElement?.getAttribute('aria-label')==='大谷翔平をコレクションに整理'");
        assertEquals("Picker focus returns to its trigger", "true", js("document.activeElement?.getAttribute('aria-label')==='大谷翔平をコレクションに整理'"));
        scenario.onActivity(activity -> activity.getOnBackPressedDispatcher().onBackPressed());
        waitCondition("Back closes parent actions", "!document.querySelector('dialog[open]') && location.hash.includes('e70b8d12')");
        js("location.hash='#/MLB/watch-center'"); waitText("フォローの変化");
        waitCondition("Watch observation finished", "Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='データを確認' && !b.disabled)");
        js("document.querySelector('.watch-preferences').open=true");
        js("Array.from(document.querySelectorAll('.watch-preferences label')).find(e=>e.textContent==='確認できる連続記録').querySelector('input').click()");
        waitCondition("Watch rule off", "!Array.from(document.querySelectorAll('.watch-preferences label')).find(e=>e.textContent==='確認できる連続記録')?.querySelector('input').checked");
        String savedWatch = preference("baseball:personal-watch:v1");
        assertFalse("Watch preference written through native adapter", new org.json.JSONObject(savedWatch).getJSONObject("preferences").getBoolean("streaks"));
        screenshot("watch-rules-360");
        js("location.hash='#/MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f/analysis'");
        System.out.println("PERF analysis_ms=" + waitText("高度分析"));
        js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='対戦・状況別を見る').click()");
        System.out.println("PERF bvp_ms=" + waitText("対戦投手を検索"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        js("location.hash='#/MLB/games/mlb%3Agame%3A0000523f-86d2-5c92-b466-d191e31baf38'");
        long gameStart = System.currentTimeMillis();
        waitCondition("Loaded Game score and participants", "location.hash.includes('0000523f') && !!document.querySelector('.score-hero') && document.querySelectorAll('.mlb-box-team').length===2 && document.querySelectorAll('.mlb-box-team tbody tr').length>18 && !document.querySelector('.skeleton-page')");
        System.out.println("PERF game_detail_ms=" + (System.currentTimeMillis()-gameStart));
        waitCondition("Transient favorite confirmation dismissed", "!document.querySelector('.toast')");
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        screenshot("mlb-game-360");
        js("Array.from(document.querySelectorAll('.game-jump-nav button')).find(b=>b.textContent==='選手成績').click()");
        waitCondition("Box jump transfers focus", "document.activeElement?.getAttribute('data-game-section')==='box'");
        js("document.querySelectorAll('.game-box-switch button')[1].click()");
        waitCondition("Home box selected without losing game", "location.hash.includes('boxSide=home') && document.querySelectorAll('[role=tabpanel]:not([hidden])').length===1 && document.querySelectorAll('.game-box-switch button')[1].getAttribute('aria-selected')==='true'");
        assertEquals("Standard phone uses comparable table", "table", js("getComputedStyle(document.querySelector('[role=tabpanel]:not([hidden]) .box-primary table')).display"));
        assertEquals("Box metric targets are 44px and do not overlap adjacent metrics", "true", js("Array.from(document.querySelectorAll('[role=tabpanel]:not([hidden]) .box-primary thead tr')).every(row=>{const buttons=Array.from(row.querySelectorAll('.metric-help-label')).map(e=>e.getBoundingClientRect());return buttons.every((r,i)=>r.width>=44&&r.height>=44&&(!buttons[i+1]||r.right<=buttons[i+1].left+0.5));})"));
        screenshot("mlb-box-score-360");
        for (String scale : new String[]{"1.5","2.0"}) {
            fontScaleAndRecreate(Float.parseFloat(scale));waitText("選手成績");waitViewport(360);
            waitCondition("Box scope survives recreation", "location.hash.includes('boxSide=home') && !!document.querySelector('[role=tabpanel]:not([hidden]) .box-primary table')");
            assertEquals("Large text retains labelled table layout", "block", js("getComputedStyle(document.querySelector('[role=tabpanel]:not([hidden]) .box-primary table')).display"));
            assertEquals("Large box has no horizontal overflow", "true", js("document.documentElement.scrollWidth<=innerWidth"));
            screenshot("mlb-box-score-font-"+scale.replace(".",""));
        }
        fontScaleAndRecreate(1.0f);waitText("選手成績");
        js("new Promise(resolve=>{const q=indexedDB.open('baseball-public-responses-v1');q.onsuccess=()=>{const db=q.result;if(!db.objectStoreNames.length){resolve(0);return;}const r=db.transaction(db.objectStoreNames[0]).objectStore(db.objectStoreNames[0]).openCursor();let max=0;r.onsuccess=()=>{const c=r.result;if(c){max=Math.max(max,c.value.bytes||0);c.continue();}else resolve(max);};};}).then(n=>document.documentElement.dataset.cachemax=String(n))");
        for (int i=0; i<100 && js("document.documentElement.dataset.cachemax || 'pending'").equals("pending"); i++) Thread.sleep(50);
        assertTrue("Persistent public response cache measured", Long.parseLong(js("document.documentElement.dataset.cachemax")) > 0);
        System.out.println("PERF largest_cached_response_bytes=" + js("document.documentElement.dataset.cachemax"));
        js("location.hash='#/MLB/search'"); System.out.println("PERF search_ms=" + waitText("選手一覧"));
        assertEquals("Search input is available", "true", js("!!document.querySelector('main input[type=search]')"));
        // Real last-validated Player/manifest cache must survive a process/activity restart.
        setNetwork(false);
        scenario.close(); scenario = ActivityScenario.launch(intent);
        long offline = waitText("大谷翔平"); waitText("保存済みデータ");
        System.out.println("PERF offline_player_ms=" + offline);
        assertEquals("true", js("!!document.querySelector('button[aria-label=\"大谷翔平をお気に入りから削除\"]')"));
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        js("location.hash='#/MLB/library?tab=collections'"); waitText("端末QA"); waitText("大谷翔平");
        assertEquals("true", js("document.documentElement.scrollWidth <= window.innerWidth"));
        screenshot("collections-offline-restart");
        String beforeOfflineWatch = preference("baseball:personal-watch:v1");
        js("location.hash='#/MLB/watch-center'"); waitText("オフラインです。");
        js("document.querySelector('.watch-preferences').open=true");
        assertEquals("Watch rule survives Activity restart", "false", js("Array.from(document.querySelectorAll('.watch-preferences label')).find(e=>e.textContent==='確認できる連続記録')?.querySelector('input').checked"));
        assertEquals("Offline Watch does not advance baselines, alerts or read state", beforeOfflineWatch, preference("baseball:personal-watch:v1"));
        screenshot("watch-offline-restart");
        setNetwork(true);
        js("location.hash='#/MLB/my'"); waitText("大谷翔平");
    }
    @Test public void publicRoutesLargeFontAndActualKeyboardBack() throws Exception {
        scenario = ActivityScenario.launch(MainActivity.class); waitText("BASEBALL");
        setNetwork(true);
        js("location.hash='#/MLB/form?season=2024&asOfDate=2024-08-20&period=7'");
        waitCondition("Historical HOT actual results", "document.querySelectorAll('.form-entry').length>0 && !document.querySelector('.skeleton-page')");
        assertTrue("HOT keeps exact Historical date", js("document.body.innerText").contains("2024-08-20"));
        assertEquals("Bounded HOT rendering", "true", js("document.querySelectorAll('.form-entry').length<=20"));
        screenshot("hot-actual-360");
        js("location.hash='#/MLB/records?season=2024'");
        waitCondition("Historical Records data", "location.hash.includes('/MLB/records') && document.querySelectorAll('main a[href*=\"/players/\"]').length>0 && !document.querySelector('.skeleton-page')");
        screenshot("records-actual-360");
        js("location.hash='#/MLB/compare?season=2024'"); waitText("比較する選手名");
        // Real UI selection, using existing verified names, does not merge identities.
        for (String name : new String[]{"大谷翔平", "鈴木誠也"}) {
            waitCondition("Compare search input", "!!document.querySelector('main input[type=search]')");
            js("(()=>{const e=document.querySelector('main input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'"+name+"');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
            waitCondition("Exact verified compare result", "Array.from(document.querySelectorAll('.compare-search button.player-row strong')).some(e=>e.textContent==='"+name+"')");
            js("Array.from(document.querySelectorAll('.compare-search button.player-row')).find(e=>e.querySelector('strong')?.textContent==='"+name+"').click()");
            waitCondition("Compare player selected", "document.querySelector('.compare-selection')?.textContent.includes('"+name+"')");
        }
        waitCondition("Two real comparison columns", "document.querySelector('.compare-table tbody tr td') && document.querySelector('.compare-table tbody tr').querySelectorAll('td').length===2 && !document.querySelector('.skeleton-page')");
        assertEquals("Comparison is not all unavailable", "true", js("Array.from(document.querySelectorAll('.compare-table td')).some(e=>e.textContent.trim()!=='—')"));
        assertEquals("Two-player matrix stays a semantic table at standard font", "table", js("getComputedStyle(document.querySelector('.compare-table table')).display"));
        assertEquals("Results precede secondary conditions", "true", js("document.querySelector('.compare-results').compareDocumentPosition(document.querySelector('.compare-options')) & Node.DOCUMENT_POSITION_FOLLOWING ? true:false"));
        assertEquals("Each real metric has two independent columns", "true", js("Array.from(document.querySelectorAll('.compare-table tbody tr')).every(row=>row.querySelectorAll('td').length===2)"));
        screenshot("compare-actual-360");
        fontScaleAndRecreate(2.0f); waitText("BASEBALL"); waitViewport(360);
        js("location.hash='#/MLB/players/mlb%3Aplayer%3Ae70b8d12-aa41-50c0-9c1b-d468d451355f?season=2024'");
        waitCondition("200% font Player metrics", "document.querySelector('.headline-stats')?.textContent.includes('1.036')");
        assertEquals("200% system font page has no horizontal overflow", "true", js("document.documentElement.scrollWidth<=innerWidth"));
        scenario.onActivity(activity -> assertTrue("Do not disable OS large text", activity.getBridge().getWebView().getSettings().getTextZoom() >= 180));
        waitCondition("Large metric glyphs fit their cells without overlap", "Array.from(document.querySelectorAll('.headline-stats dd')).every(e=>{const r=document.createRange();r.selectNodeContents(e);const text=r.getBoundingClientRect(),cell=e.parentElement.getBoundingClientRect();return text.left>=cell.left-1&&text.right<=cell.right+1;})");
        assertEquals("Header actions stay inside the viewport", "true", js("Array.from(document.querySelectorAll('.app-header a,.app-header button')).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})"));
        screenshot("player-font-200");
        js("location.hash='#/MLB/form?season=2024&asOfDate=2024-08-20&period=7'");
        waitCondition("200% font HOT results", "document.querySelectorAll('.form-entry').length>0 && !document.querySelector('.skeleton-page')");
        assertEquals("HOT large text stays within the viewport", "true", js("document.documentElement.scrollWidth<=innerWidth"));
        assertEquals("Compact stat guides retain full touch targets", "true", js("Array.from(document.querySelectorAll('.form-entry .metric-help-label')).every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44;})"));
        waitCondition("HOT metric glyphs fit without overlapping adjacent values", "Array.from(document.querySelectorAll('.form-entry .explorer-values dd')).every(e=>{const r=document.createRange();r.selectNodeContents(e);const text=r.getBoundingClientRect(),cell=e.parentElement.getBoundingClientRect();return text.left>=cell.left-1&&text.right<=cell.right+1;})");
        screenshot("hot-font-200");
        fontScaleAndRecreate(1.0f); waitText("BASEBALL"); waitViewport(360);
        js("location.hash='#/MLB/search?season=2024'");
        waitCondition("Actual Player Search", "location.hash.includes('/MLB/search') && !!document.querySelector('main input[type=search]') && !document.querySelector('.skeleton-page')");
        tapSearchInput();
        screenshot("search-actual-keyboard");
        assertEquals("Keyboard focus is on search", "true", js("document.activeElement===document.querySelector('main input[type=search]')"));
        shell("input keyevent KEYCODE_BACK"); waitIme(false);
        assertTrue("First system Back dismisses IME without leaving Search", js("location.hash").contains("/MLB/search"));
        screenshot("search-keyboard-back");
    }
    @Test public void compactHistoricalDirectoryPreservesDetailsAndSources() throws Exception {
        scenario = ActivityScenario.launch(MainActivity.class); waitText("BASEBALL"); setNetwork(true);
        js("location.hash='#/NPB/history?season=2025'");
        waitCondition("Real historical directory", "document.querySelectorAll('.historical-player-list article').length>0 && !document.querySelector('.skeleton-page')");
        assertEquals("Three primary statistics per team-season row", "true", js("Array.from(document.querySelectorAll('.historical-row-summary')).every(e=>e.querySelectorAll('dd').length===3)"));
        js("document.querySelector('.historical-player-list').scrollIntoView({block:'start'})");
        screenshot("npb-history-directory-360-light");
        js("document.querySelector('.historical-player-details').open=true");
        waitCondition("Details retain revision, license and comparison control", "document.querySelector('.historical-player-details[open] a[href*=oldid]') && document.querySelector('.historical-player-details[open] a[href*=creativecommons]') && document.querySelector('.historical-player-details[open] input[type=checkbox]')");
        screenshot("npb-history-directory-details-360");
        fontScaleAndRecreate(2.0f); waitText("BASEBALL"); waitViewport(360);
        waitCondition("Directory renders at system 200%", "document.querySelectorAll('.historical-row-summary').length>0");
        assertEquals("200% historical directory has no root overflow", "true", js("document.documentElement.scrollWidth<=innerWidth"));
        js("document.querySelector('.historical-player-list').scrollIntoView({block:'start'})");
        screenshot("npb-history-directory-200-light");
        setTheme("dark", "ダーク"); js("location.hash='#/NPB/history?season=2025'"); waitText("シーズン履歴");
        js("document.querySelector('.historical-player-list').scrollIntoView({block:'start'})");
        screenshot("npb-history-directory-200-dark");
        fontScaleAndRecreate(1.0f); waitText("BASEBALL");
    }
    @Test public void datedNpbPortraitKeepsIdentityAndCaptureYearAtLargeFont() throws Exception {
        scenario = ActivityScenario.launch(MainActivity.class); waitText("BASEBALL"); setNetwork(true);
        js("location.hash='#/NPB/players/54f9b289-4717-4fb8-b1c3-7c8cf37e2e42'");
        waitCondition("Exact reviewed NPB portrait loads", "document.querySelector('.player-identity h1')?.textContent==='近藤健介' && document.querySelector('.licensed-player-photo img')?.complete && document.querySelector('.licensed-player-photo img')?.naturalWidth>0");
        assertTrue("Visible caption dates the portrait independently of the stats",js("document.querySelector('.licensed-player-photo').innerText").contains("2023年撮影"));
        waitViewport(360); screenshot("npb-kondo-photo-360");
        fontScaleAndRecreate(2.0f); waitText("BASEBALL"); waitViewport(360);
        waitCondition("Portrait remains on exact canonical profile", "location.hash.includes('54f9b289') && document.querySelector('.licensed-player-photo img')?.naturalWidth>0");
        assertEquals("Dated NPB portrait does not overflow at 200%", "true", js("document.documentElement.scrollWidth<=innerWidth"));
        screenshot("npb-kondo-photo-200-light");
        setTheme("dark", "ダーク"); js("location.hash='#/NPB/players/54f9b289-4717-4fb8-b1c3-7c8cf37e2e42'"); waitText("2023年撮影"); screenshot("npb-kondo-photo-200-dark");
        fontScaleAndRecreate(1.0f); waitText("BASEBALL");
    }
    @Test public void npbHistoricalYearsAndLargeFont() throws Exception {
        Intent link = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://NPB/history?season=2025&player=a1ca7cac-f9be-4993-a78c-bcd1e1ae3399&years=2023,2024,2025&q=%E4%BD%90%E8%97%A4%E8%BC%9D%E6%98%8E"));
        link.setClassName("com.tomoya41.baseballnotes", "jp.baseballdata.app.MainActivity");
        scenario = ActivityScenario.launch(link);
        waitText("2023 / 2024 / 2025年の収録行合計");
        waitText("0.924");
        waitCondition("Actual trend values and axis", "document.querySelectorAll('.progression-axis').length===3 && Array.from(document.querySelectorAll('.progression-value')).map(n=>n.textContent).join(',')==='0.837,0.766,0.924'");
        assertTrue("Historical scope is visible before disclosure", js("document.body.innerText").contains("一部収録"));
        js("document.querySelector('.historical-coverage>summary').click()");
        waitText("全選手の成績・ランキングではありません");
        js("document.querySelector('.historical-coverage>summary').click()");
        assertEquals("Canonical player preserved by native deep link", "true", js("location.hash.includes('a1ca7cac-f9be-4993-a78c-bcd1e1ae3399') && location.hash.includes('season=2025')"));
        waitCondition("Comparison attribution", "!!document.querySelector('[aria-label=\"年度比較・合計データの出典\"] a[href*=\"oldid=\"]')");
        String historicalHash=js("location.hash");
        for (String scale : new String[]{"1.5", "2.0"}) {
            fontScaleAndRecreate(Float.parseFloat(scale));
            waitText("2023 / 2024 / 2025年の収録行合計"); waitViewport(360);
            waitCondition("OS font scale reaches Historical view", "Number(getComputedStyle(document.documentElement).getPropertyValue('--android-font-scale')) >= " + scale);
            assertEquals("Historical view has no horizontal overflow at " + scale, "true", js("document.documentElement.scrollWidth <= window.innerWidth"));
            assertEquals("All five large-text navigation labels fit on one line", "true", js("Array.from(document.querySelectorAll('.bottom-nav a')).length===5 && Array.from(document.querySelectorAll('.bottom-nav a')).every(a=>{const s=a.querySelector('span'),r=document.createRange();r.selectNodeContents(s);const t=r.getBoundingClientRect(),b=a.getBoundingClientRect();return r.getClientRects().length===1 && t.left>=b.left-1 && t.right<=b.right+1 && t.top>=b.top-1 && t.bottom<=b.bottom+1 && b.bottom<=innerHeight;})"));
            js("document.querySelector('.progression-chart').scrollIntoView({block:'center'})");
            screenshot("npb-history-font-" + scale.replace(".", "") + "-light");
            setTheme("dark", "ダーク"); js("location.hash='" + historicalHash + "'");
            waitText("2023 / 2024 / 2025年の収録行合計"); waitViewport(360);
            assertEquals("Dark large-text navigation is fully visible", "true", js("Array.from(document.querySelectorAll('.bottom-nav a')).every(a=>{const r=document.createRange();r.selectNodeContents(a.querySelector('span'));const t=r.getBoundingClientRect(),b=a.getBoundingClientRect();return r.getClientRects().length===1 && t.left>=b.left-1 && t.right<=b.right+1 && t.bottom<=b.bottom+1;})"));
            js("document.querySelector('.progression-chart').scrollIntoView({block:'center'})");
            screenshot("npb-history-font-" + scale.replace(".", "") + "-dark");
            setTheme("light", "ライト"); js("location.hash='" + historicalHash + "'");
            waitText("2023 / 2024 / 2025年の収録行合計");
        }
        fontScaleAndRecreate(1.0f); waitText("0.924");
        screenshot("npb-history-360");
    }
    @Test public void npbTeamPlayerBrowseSortAndBackAtLargeFont() throws Exception {
        Intent link = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://NPB/teams/npb:team:tigers/players?season=2025&role=pitching&sort=innings"));
        link.setClassName("com.tomoya41.baseballnotes", "jp.baseballdata.app.MainActivity");
        scenario = ActivityScenario.launch(link);
        waitText("阪神の選手"); waitText("175.1"); waitViewport(360);
        assertEquals("Historical pitching leader and no borrowed number", "true", js("document.querySelector('.team-player-list .player-row')?.textContent.includes('村上頌樹') && !document.querySelector('.roster-number')"));
        js("document.querySelector('.team-player-list .player-row').click()");
        waitCondition("Exact historical player year/role", "location.hash.includes('/seasons?season=2025&role=pitching') && document.querySelector('h1')?.textContent==='村上頌樹'");
        waitCondition("Historical source remains reachable", "!!document.querySelector('a[href*=\"oldid=\"]')");
        shell("input keyevent KEYCODE_BACK"); waitText("阪神の選手"); waitText("175.1");
        assertTrue("System Back restores innings sort", js("location.hash").contains("sort=innings"));
        js("document.querySelector('.team-player-list .player-row').click()");
        waitCondition("Profile opened before UI Back", "location.hash.includes('/seasons?season=2025&role=pitching') && document.querySelector('h1')?.textContent==='村上頌樹'");
        js("const year=document.querySelector('[aria-label=\"選手成績の年度\"]');year.value='2024';year.dispatchEvent(new Event('change',{bubbles:true}))");
        waitCondition("Changing profile year retains original roster return", "location.hash.includes('season=2024') && document.querySelector('main .back-link')?.getAttribute('href').includes('season=2025&role=pitching&sort=innings')");
        js("document.querySelector('main .back-link').click()"); waitText("阪神の選手"); waitText("175.1");
        assertTrue("UI Back preserves year and innings sort", js("location.hash").contains("season=2025&role=pitching&sort=innings"));
        String rosterHash=js("location.hash");
        for(String scale:new String[]{"1.5","2.0"}) {
            fontScaleAndRecreate(Float.parseFloat(scale)); waitText("175.1"); waitViewport(360);
            assertEquals("Roster large-font has no overflow", "true", js("document.documentElement.scrollWidth<=innerWidth"));
            screenshot("team-players-"+scale.replace(".","")+"-light");
            setTheme("dark","ダーク"); js("location.hash='"+rosterHash+"'"); waitText("175.1"); waitViewport(360);
            assertEquals("Roster dark large-font has no overflow", "true", js("document.documentElement.scrollWidth<=innerWidth"));
            screenshot("team-players-"+scale.replace(".","")+"-dark");
            setTheme("light","ライト"); js("location.hash='"+rosterHash+"'"); waitText("175.1");
        }
        fontScaleAndRecreate(1.0f); waitText("175.1");
    }
    @Test public void npbPlayerCompetitionDeepLinkAndLargeFont() throws Exception {
        Intent link = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://NPB/players/21a327b4-3924-422a-a1fc-d853e236a201/seasons?season=2025&role=pitching&competition=postseason&stage=npb_cs_final"));
        link.setClassName("com.tomoya41.baseballnotes", "jp.baseballdata.app.MainActivity");
        scenario = ActivityScenario.launch(link);
        waitText("2025年 · CS ファイナル"); waitText("5.2");
        waitCondition("Exact native competition", "location.hash.includes('stage=npb_cs_final') && location.hash.includes('role=pitching') && !!document.querySelector('a[href*=\"oldid=110944738\"]')");
        String scopedHash=js("location.hash");
        for(String scale:new String[]{"1.5","2.0"}) {
            fontScaleAndRecreate(Float.parseFloat(scale)); waitText("5.2"); waitViewport(360);
            assertEquals("Scoped player has no large-font overflow", "true", js("document.documentElement.scrollWidth<=innerWidth"));
            screenshot("npb-player-competition-font-" + scale.replace(".", "") + "-light");
            setTheme("dark", "ダーク"); js("location.hash='"+scopedHash+"'"); waitText("5.2"); waitViewport(360);
            assertEquals("Dark scoped player has no large-font overflow", "true", js("document.documentElement.scrollWidth<=innerWidth"));
            screenshot("npb-player-competition-font-" + scale.replace(".", "") + "-dark");
            setTheme("light", "ライト"); js("location.hash='"+scopedHash+"'"); waitText("5.2");
        }
        waitCondition("Current profile link available after Directory validation", "Array.from(document.querySelectorAll('main a')).some(a=>a.textContent==='2026年の選手ページへ')");
        js("Array.from(document.querySelectorAll('main a')).find(a=>a.textContent==='2026年の選手ページへ').click()");
        // The same name exists on both screens. Wait for the destination route
        // and a rendered Current profile before sending a real system Back.
        waitCondition("Current profile navigation committed", "location.hash==='#/NPB/players/21a327b4-3924-422a-a1fc-d853e236a201' && !document.querySelector('.skeleton-page') && document.querySelector('.player-screen h1')?.textContent==='東克樹'");
        waitText("東克樹"); waitPaint();
        assertEquals("Current profile has a router-owned Back entry", "true", js("Number.isInteger(history.state?.idx) && history.state.idx>0"));
        System.out.println("NPB_QA_HISTORY " + js("JSON.stringify({hash:location.hash,state:history.state,length:history.length})"));
        scenario.onActivity(activity -> System.out.println("NPB_QA_WEBVIEW_BACK " + activity.getBridge().getWebView().canGoBack()));
        shell("input keyevent KEYCODE_BACK"); waitText("2025年 · CS ファイナル");
        assertTrue("System Back preserves the exact stage", js("location.hash").contains("stage=npb_cs_final"));
    }
    @Test public void npbSavedCsAndProgressionRemainSeparateAtLargeFont() throws Exception {
        Intent link = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://NPB/cs?season=2026&stage=npb_cs_final&role=pitching"));
        link.setClassName("com.tomoya41.baseballnotes", "jp.baseballdata.app.MainActivity");
        scenario = ActivityScenario.launch(link);
        waitText("2026 クライマックスシリーズ"); waitText("リバン・モイネロ");
        waitCondition("Bounded CS results", "document.querySelectorAll('a.player-row').length>0 && document.querySelectorAll('a.player-row').length<=30");
        js("Array.from(document.querySelectorAll('a.player-row')).find(a=>a.textContent.includes('リバン・モイネロ')).click()");
        waitText("2026年 · CS ファイナル"); waitText("2.2");
        assertTrue("CS sample stays explicit", js("document.body.innerText").contains("CS全試合・選手の大会通算成績ではありません"));
        String csHash=js("location.hash");
        waitPaint();
        scenario.onActivity(activity -> {
            Bundle saved = new Bundle(); activity.onSaveInstanceState(saved);
            assertEquals("The native snapshot uses the selected SPA player, not the original list", csHash.substring(1), saved.getString("baseball.webRoute"));
        });
        for(String scale:new String[]{"1.5","2.0"}) {
            fontScaleAndRecreate(Float.parseFloat(scale)); waitText("2.2"); waitViewport(360);
            assertEquals("Recreation retains the selected player, not the initial CS list", csHash, js("location.hash"));
            assertEquals("CS has no overflow at " + scale, "true", js("document.documentElement.scrollWidth<=innerWidth"));
            screenshot("npb-cs-font-" + scale.replace(".", "") + "-light");
            setTheme("dark", "ダーク"); js("location.hash='"+csHash+"'"); waitText("2.2");
            assertEquals("Dark CS has no overflow", "true", js("document.documentElement.scrollWidth<=innerWidth"));
            screenshot("npb-cs-font-" + scale.replace(".", "") + "-dark");
            setTheme("light", "ライト"); js("location.hash='"+csHash+"'"); waitText("2.2");
        }
        fontScaleAndRecreate(1.0f); waitText("2.2");
        shell("input keyevent KEYCODE_BACK"); waitText("2026 クライマックスシリーズ");
        assertTrue("Cold restored Back retains CS stage and role", js("location.hash").contains("stage=npb_cs_final") && js("location.hash").contains("role=pitching"));
        waitText("リバン・モイネロ");
        js("Array.from(document.querySelectorAll('a.player-row')).find(a=>a.textContent.includes('リバン・モイネロ')).click()");
        waitText("2026年 · CS ファイナル"); waitText("2.2");
        js("const s=document.querySelector('select[aria-label=\"選手成績の年度\"]');s.value='2025';s.dispatchEvent(new Event('change',{bubbles:true}))");
        waitText("成績の変化");
        assertTrue("Year switch resets unsupported stage", js("location.hash").contains("competition=regular"));
        assertFalse("No stale CS stage in Regular", js("location.hash").contains("stage="));
        waitCondition("Accessible progression chart with four primary samples", "!!document.querySelector('svg[aria-label*=\"年度推移\"]') && document.querySelectorAll('.player-progression > dl.explorer-values dd').length===4");
        screenshot("npb-progression-360");
        shell("input keyevent KEYCODE_BACK"); waitText("2026年 · CS ファイナル"); waitText("2.2");
    }
    @Test public void historicalCohortKeepsSelectionAndScopeAtLargeFont() throws Exception {
        scenario=ActivityScenario.launch(MainActivity.class);
        waitText("BASEBALL");
        js("location.hash='#/NPB/history?season=2025&role=pitching&cohort=birthYear'");
        // Use the actual UI to pick an admitted reference; no guessed identity/name merge.
        waitText("基準の選手");
        waitCondition("Reference options loaded", "Array.from(document.querySelectorAll('select')).some(s=>Array.from(s.options).some(o=>o.value==='3c4b8e86-5a0c-48cb-aeba-44676de9fa38'))");
        js("const s=Array.from(document.querySelectorAll('select')).find(s=>Array.from(s.options).some(o=>o.value==='3c4b8e86-5a0c-48cb-aeba-44676de9fa38'));s.value='3c4b8e86-5a0c-48cb-aeba-44676de9fa38';s.dispatchEvent(new Event('change',{bubbles:true}))");
        waitText("1995年生まれ");
        waitCondition("Two independently indexed peers", "document.querySelectorAll('.explorer-results input[type=checkbox]').length>=2");
        js("document.querySelectorAll('.explorer-results input[type=checkbox]')[0].click()");
        waitText("比較 1/4人");
        js("document.querySelectorAll('.explorer-results input[type=checkbox]')[1].click()");
        waitText("比較 2/4人");
        assertEquals("Comparison keeps its year and sample caveat", "true", js("!!document.querySelector('section[aria-label=\"同期の成績比較\"]') && document.body.innerText.includes('規定資格や優劣の判定ではありません')"));
        String route=js("location.hash");screenshot("npb-cohort-360");
        fontScaleAndRecreate(2.0f);waitText("比較 2/4人");waitViewport(360);
        assertEquals("Recreation retains cohort and selected canonical IDs",route,js("location.hash"));
        assertEquals("Cohort large text has no horizontal overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));
        assertEquals("Expanded cohort statistic values remain readable on one line","true",js("Array.from(document.querySelectorAll('.historical-cohort .explorer-values dd')).every(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects().length===1;})"));
        screenshot("npb-cohort-font-20");
    }
    @Test public void sameAgeSeasonsAndPlayerStoryRetainScopeAndLargeText() throws Exception {
        scenario=ActivityScenario.launch(MainActivity.class);waitText("BASEBALL");
        js("location.hash='#/NPB/history?cohort=ageSeason&age=26&role=batting&recentPlayers=a1ca7cac-f9be-4993-a78c-bcd1e1ae3399,852bed28-a3f1-4b60-8a1f-950cc2947686&sort1=HR'");
        waitText("2025年 · 年末26歳");waitText("2024年 · 年末26歳");
        waitCondition("Both actual age seasons loaded", "!!document.querySelector('section[aria-label=\"同年齢の比較結果\"]')");
        assertTrue("Collected seasons are not full career totals", js("document.body.innerText").contains("完全なキャリアではありません"));
        screenshot("npb-age-season-360");String route=js("location.hash");
        fontScaleAndRecreate(2.0f);waitText("2025年 · 年末26歳");waitText("2024年 · 年末26歳");waitViewport(360);
        assertEquals("Age comparison restores exact years, role and IDs",route,js("location.hash"));
        assertEquals("Age comparison large text has no overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));
        screenshot("npb-age-season-font-20");
        js("location.hash='#/NPB/players/852bed28-a3f1-4b60-8a1f-950cc2947686/seasons?season=2024&role=batting&story=1'");
        waitText("選手経歴");waitText("収録されたシーズンへ");waitText("2024年 · 年末26歳");
        assertEquals("Story keeps scope and recorded source links","true",js("!!document.querySelector('section[aria-label=\"経歴と収録シーズンのつながり\"] a[href*=\"story=1\"]') && location.hash.includes('season=2024')"));
        assertEquals("Story large text has no overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));
        screenshot("npb-story-font-20");
        js("location.hash='#/NPB/history?season=2025&role=batting&cohort=schoolYear&peer=852bed28-a3f1-4b60-8a1f-950cc2947686&recentPlayers=a1ca7cac-f9be-4993-a78c-bcd1e1ae3399,852bed28-a3f1-4b60-8a1f-950cc2947686'");
        waitText("1998年4月2日〜1999年4月1日生まれ");waitText("比較 2/4人");waitViewport(360);
        assertTrue("Japanese grade includes early-year and prior calendar-year birthdays",js("document.body.innerText").contains("1999-03-13生まれ") && js("document.body.innerText").contains("1998-04-21生まれ"));
        assertEquals("Japanese grade large text has no overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));
        screenshot("npb-school-cohort-font-20");
        js("location.hash='#/NPB/players/3c4b8e86-5a0c-48cb-aeba-44676de9fa38/more'");waitText("経歴と年度成績をたどる");
        assertEquals("Pitcher More story entry keeps pitching role","true",js("document.querySelector('a[href*=\"story=1\"]')?.getAttribute('href').includes('role=pitching')"));
        js("document.querySelector('a[href*=\"story=1\"]').click()");waitText("収録されたシーズンへ");
        js("Array.from(document.querySelectorAll('section[aria-label=\"経歴と収録シーズンのつながり\"] a')).find(a=>a.getAttribute('href')?.includes('season=2025')).click()");
        waitText("2025年の投球成績");assertTrue("Collected pitcher year retains role",js("location.hash").contains("role=pitching"));
    }
    @Test public void collectedClubComparisonPreservesSamplesAndAnnualNavigation() throws Exception {
        scenario=ActivityScenario.launch(MainActivity.class);waitText("BASEBALL");
        js("location.hash='#/NPB/players/54f9b289-4717-4fb8-b1c3-7c8cf37e2e42/seasons?season=2025&role=batting&years=2022,2023,2024,2025&trendMetric=AVG'");
        waitText("球団別に見比べる · 2球団");
        js("Array.from(document.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent==='球団別に見比べる · 2球団').open=true");
        waitText("収録年度：2022年 · 396打席");waitText("収録年度：2023 / 2024 / 2025年 · 1455打席");
        assertEquals("Club rates recompute actual collected hits and at-bats", "true", js("document.querySelector('section[aria-label=\"ソフトバンクの収録成績\"]')?.textContent.includes('0.307')"));
        js("Array.from(document.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent.startsWith('球団別に見比べる')).scrollIntoView({block:'start'})");
        screenshot("npb-club-comparison-360");
        fontScaleAndRecreate(2.0f);waitText("球団別に見比べる · 2球団");waitViewport(360);
        js("Array.from(document.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent.startsWith('球団別に見比べる')).open=true");
        assertEquals("Club comparison large text has no overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));
        js("Array.from(document.querySelectorAll('details')).find(d=>d.querySelector('summary')?.textContent.startsWith('球団別に見比べる')).scrollIntoView({block:'start'})");
        screenshot("npb-club-comparison-font-20");
        js("document.querySelector('section[aria-label=\"日本ハムの収録成績\"] a').click()");waitText("2022年の打撃成績");
        assertTrue("Annual detail keeps exact year and role",js("location.hash").contains("season=2022&role=batting&years=2022"));
    }
    @Test public void postseasonGameDetailUsesExactGameScopeAndScalesText() throws Exception {
        Intent link=new Intent(Intent.ACTION_VIEW,Uri.parse("baseballnotes://NPB/games/npb%3Agame%3Ac0e3700f483b5a5239d5?competition=postseason&stage=npb_cs_final"));
        link.setClassName("com.tomoya41.baseballnotes","jp.baseballdata.app.MainActivity");
        scenario=ActivityScenario.launch(link);waitText("ポストシーズン · CS ファイナル");waitText("選手成績");
        assertFalse("Unselected team's name is not shown as the active box",js("document.body.innerText").contains("森下翔太"));
        js("document.querySelectorAll('.game-box-switch [role=tab]')[1].click()");waitText("森下翔太");
        assertEquals("CS game shows source's single-game HR, not stage total","true",js("Array.from(document.querySelectorAll('[role=tabpanel]:not([hidden]) th.stat-table-identity')).some(th=>th.textContent.includes('森下翔太') && th.parentElement.querySelectorAll('td')[2]?.textContent==='HR2')"));
        assertEquals("Exactly one team is visible","1",js("String(document.querySelectorAll('[role=tabpanel]:not([hidden])').length)"));
        assertTrue("Selected team is restorable from URL",js("location.hash").contains("boxSide=home"));
        assertEquals("Per-game source is reachable","true",js("!!document.querySelector('a[href*=\"oldid=111424439\"]')"));
        screenshot("npb-cs-game-detail-360");
        fontScaleAndRecreate(2.0f);waitText("森下翔太");waitViewport(360);
        assertEquals("CS detail remains within the viewport at 200 percent","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("npb-cs-game-detail-font-20");
        js("Array.from(document.querySelectorAll('a')).find(a=>a.textContent==='森下翔太').click()");waitText("2026年 · CS ファイナル");
        assertTrue("Player link retains postseason/role",js("location.hash").contains("competition=postseason&stage=npb_cs_final&role=batting"));
    }
    @Test public void npbSeriesColdDeepLinkKeepsAdvantageAndSystemBackAtLargeFont() throws Exception {
        Intent link=new Intent(Intent.ACTION_VIEW,Uri.parse("baseballnotes://NPB/postseason/series/npb%3Aseries%3A19106473-c7b5-5171-bf77-40b5d93190a0?season=2026"));
        link.setClassName("com.tomoya41.baseballnotes","jp.baseballdata.app.MainActivity");
        scenario=ActivityScenario.launch(link);waitText("試合3勝 ＋ アドバンテージ2勝");
        String seriesHash=js("location.hash");
        fontScaleAndRecreate(2.0f);waitText("試合3勝 ＋ アドバンテージ2勝");waitViewport(360);
        assertEquals("Series survives recreation",seriesHash,js("location.hash"));
        assertEquals("Series has no 200-percent overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));
        screenshot("npb-series-font-20-light");
        setTheme("dark","ダーク");js("location.hash='"+seriesHash+"'");waitText("試合3勝 ＋ アドバンテージ2勝");
        assertEquals("Dark series has no 200-percent overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));
        screenshot("npb-series-font-20-dark");
        js("document.querySelector('a.scoreboard-row').click()");waitText("ポストシーズン · CS ファイナル");waitText("選手成績");
        assertEquals("Game exposes accessible box score teams","2",js("String(document.querySelectorAll('.game-box-switch [role=tab]').length)"));
        assertTrue("Game retains exact competition",js("location.hash").contains("competition=postseason&stage=npb_cs_final"));
        shell("input keyevent KEYCODE_BACK");waitText("試合3勝 ＋ アドバンテージ2勝");
        assertEquals("Real system Back returns to exact series",seriesHash,js("location.hash"));
    }
    @Test public void japanSeriesScheduledGameKeepsNullResultsAndNativeBackAtLargeFont() throws Exception {
        Intent link=new Intent(Intent.ACTION_VIEW,Uri.parse("baseballnotes://NPB/postseason/series/npb%3Aseries%3Afae89d8d-b1f8-5675-82e8-d9136be4f7c1?season=2026"));
        link.setClassName("com.tomoya41.baseballnotes","jp.baseballdata.app.MainActivity");
        scenario=ActivityScenario.launch(link);waitText("日程・試合詳細");waitText("4勝先取");
        String route=js("location.hash");setTheme("light","ライト");js("location.hash='"+route+"'");waitText("日程・試合詳細");
        fontScaleAndRecreate(2.0f);waitText("日程・試合詳細");waitViewport(360);
        assertEquals("Japan Series route survives recreation",route,js("location.hash"));
        assertEquals("Seven admitted Games","7",js("String(document.querySelectorAll('a.scoreboard-row').length)"));
        assertEquals("No 200-percent overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("japan-series-font-20-light");
        setTheme("dark","ダーク");js("location.hash='"+route+"'");waitText("日程・試合詳細");
        assertEquals("Dark Japan Series has no 200-percent overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("japan-series-font-20-dark");
        js("document.querySelector('a.scoreboard-row[href*=\"8aabfefe82d76006b9a9\"]').click()");waitText("第2戦 · ソフトバンク対DeNA");waitText("結果・打撃・投球成績はまだ収録していません");
        assertTrue("Scheduled Game retains Japan Series scope",js("location.hash").contains("stage=japan_series"));
        assertEquals("No fabricated box score","0",js("String(document.querySelectorAll('main table').length)"));
        shell("input keyevent KEYCODE_BACK");waitText("日程・試合詳細");assertEquals("System Back returns to exact series",route,js("location.hash"));
    }
    @Test public void japanSeriesHomeKeepsResultsFirstAndPortraitNavigationAtLargeFont() throws Exception {
        Intent link=new Intent(Intent.ACTION_VIEW,Uri.parse("baseballnotes://NPB/home"));
        link.setClassName("com.tomoya41.baseballnotes","jp.baseballdata.app.MainActivity");
        scenario=ActivityScenario.launch(link);waitText("BASEBALL");
        org.junit.Assume.assumeTrue("Japan Series editorial period only",Boolean.parseBoolean(js("(()=>{const d=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());return d>='2026-10-24'&&d<='2026-11-08';})()")));
        waitCondition("Validated static Japan Series Home","!!document.querySelector('.japan-home-result')");
        assertEquals("Japan Series precedes regular controls","true",js("document.querySelector('.home-hub').firstElementChild.classList.contains('japan-home')"));
        waitCondition("Three independently identified portraits load","Array.from(document.querySelectorAll('.japan-home-players img')).filter(i=>i.complete&&i.naturalWidth>0).length===3");
        assertEquals("Photo links retain capture dates","3",js("String(document.querySelectorAll('.japan-home-players figcaption').length)"));
        setTheme("light","ライト");js("location.hash='#/NPB/home'");waitCondition("Japan Series Home","!!document.querySelector('.japan-home-result')");
        fontScaleAndRecreate(2.0f);waitCondition("Japan Series survives font recreation","!!document.querySelector('.japan-home-result')");waitViewport(360);
        assertEquals("Light Home 200 percent has no overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("japan-home-font-20-light");
        setTheme("dark","ダーク");js("location.hash='#/NPB/home'");waitCondition("Dark Japan Series Home","!!document.querySelector('.japan-home-result')");
        assertEquals("Dark Home 200 percent has no overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("japan-home-font-20-dark");
        String resultHref=js("document.querySelector('.japan-home-result').getAttribute('href')");
        String resultRoute=resultHref.contains("#")?resultHref.substring(resultHref.indexOf('#')):"#"+resultHref;
        js("document.querySelector('.japan-home-result').click()");waitText("イニング別得点");
        assertTrue("Home result keeps Japan Series scope",js("location.hash").contains("stage=japan_series"));
        assertEquals("Home opens the exact latest admitted result",resultRoute,js("location.hash"));
        assertEquals("Latest final has actual completed inning evidence","true",js("document.querySelectorAll('.series-innings tbody tr').length>=9 && document.querySelectorAll('.series-innings tbody tr').length<=30"));
        shell("input keyevent KEYCODE_BACK");waitCondition("Back to Home","!!document.querySelector('.japan-home-result')");
        js("document.querySelector('.japan-home-player-link').click()");waitText("牧秀悟");
        waitCondition("Exact canonical portrait on Player","!!document.querySelector('.player-identity img[alt*=\"牧秀悟\"]')");
        shell("input keyevent KEYCODE_BACK");waitCondition("Player Back returns to Japan Series Home","!!document.querySelector('.japan-home-result')");
    }
    @Test public void additionalJapanSeriesPortraitsKeepIdentityDatesAndLargeText() throws Exception {
        scenario=ActivityScenario.launch(MainActivity.class);waitText("BASEBALL");
        String[][] players={{"21a327b4-3924-422a-a1fc-d853e236a201","東克樹","2018"},{"fe02470d-7c15-4c03-8a17-d6d339445ebe","周東佑京","2021"}};
        for(int i=0;i<players.length;i++){
            String[] p=players[i];setTheme(i==0?"light":"dark",i==0?"ライト":"ダーク");
            js("location.hash='#/NPB/players/"+p[0]+"'");waitText(p[1]);
            waitCondition("Exact dated informational portrait loaded","document.querySelector('.player-identity h1')?.textContent==='"+p[1]+"' && document.querySelector('.player-identity img')?.naturalWidth>0");
            fontScaleAndRecreate(2.0f);waitText(p[2]+"年撮影");waitViewport(360);
            assertEquals("No large-text portrait overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));
            assertTrue("Exact canonical route survives recreation",js("location.hash").contains(p[0]));
            assertTrue("Photo retains independent source link",js("document.querySelector('.licensed-player-photo figcaption a').getAttribute('href')").contains("/MLB/sources"));
            screenshot("japan-portrait-"+i+"-font-20");
        }
    }
    @Test public void draftPreviewRemainsSeparateFromResultsAtLargeFont() throws Exception {
        Intent link=new Intent(Intent.ACTION_VIEW,Uri.parse("baseballnotes://NPB/talent/2026?view=preview&forecast=final"));
        link.setClassName("com.tomoya41.baseballnotes","jp.baseballdata.app.MainActivity");
        scenario=ActivityScenario.launch(link);waitText("2026ドラフト直前最終予想");waitText("保留0枠");
        String route=js("location.hash");setTheme("light","ライト");js("location.hash='"+route+"'");waitText("2026ドラフト直前最終予想");
        fontScaleAndRecreate(2.0f);waitText("2026ドラフト直前最終予想");waitViewport(360);
        assertEquals("Thirty-six unique reviewed winning selections","36",js("String(document.querySelectorAll('main article').length)"));
        assertEquals("Every final forecast has reviewed eligibility","36",js("String(document.querySelectorAll('main article > a.player-row').length)"));
        assertEquals("Final forecast holds no unsafe targets","0",js("String(Array.from(document.querySelectorAll('main article')).filter(e=>e.textContent.includes('予想を保留')).length)"));
        assertEquals("Yamada has no active forecast link","false",js("Array.from(document.querySelectorAll('main article > a.player-row')).some(e=>e.textContent.includes('山田凜虎'))"));
        assertEquals("Draft preview no large-font overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("draft-2026-font-20-light");
        setTheme("dark","ダーク");js("location.hash='"+route+"'");waitText("2026ドラフト直前最終予想");
        assertEquals("Dark draft preview no overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("draft-2026-font-20-dark");
        js("Array.from(document.querySelectorAll('nav[aria-label=\"ドラフト特集の表示\"] a')).find(a=>a.textContent==='指名結果').click()");
        waitText("収録 122件");waitText("支配下 74 / 育成 48");waitText("当選は未確認");
        assertEquals("Bounded twenty result rows and three independent lottery groups","23",js("String(document.querySelectorAll('main article').length)"));
        assertEquals("Result list at 200 percent has no overflow","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("draft-2026-results-font-20-dark");
        js("Array.from(document.querySelectorAll('main button')).find(b=>b.textContent==='次の20件').click()");waitText("2 / 7ページ");
        assertEquals("Result page turns move focus to the visible result heading","true",js("document.activeElement.id==='draft-results-heading' && document.getElementById('draft-results-heading').getBoundingClientRect().top>=0 && document.getElementById('draft-results-heading').getBoundingClientRect().top<innerHeight"));
        js("Array.from(document.querySelectorAll('main button')).find(b=>b.textContent==='前の20件').click()");waitText("1 / 7ページ");
        // The two page changes are separate URL history entries; return to the archived forecast explicitly.
        shell("input keyevent KEYCODE_BACK");waitText("2 / 7ページ");shell("input keyevent KEYCODE_BACK");waitText("1 / 7ページ");
        shell("input keyevent KEYCODE_BACK");waitText("会議前の固定予想（アーカイブ）");assertEquals("Draft Back restores archived forecast",route,js("location.hash"));
    }
    @Test public void japanSeriesIdOnlyColdGameBackStaysInPostseason() throws Exception {
        Intent link=new Intent(Intent.ACTION_VIEW,Uri.parse("baseballnotes://NPB/games/npb%3Agame%3A9f6c547e7852f6c5a928"));
        link.setClassName("com.tomoya41.baseballnotes","jp.baseballdata.app.MainActivity");
        scenario=ActivityScenario.launch(link);waitText("第1戦 · ソフトバンク対DeNA");
        assertTrue("ID-only cold link gains exact postseason scope",js("location.hash").contains("stage=japan_series"));
        shell("input keyevent KEYCODE_BACK");waitText("日程・試合詳細");
        assertTrue("Cold Back cannot enter Regular schedule",js("location.hash").contains("/NPB/postseason"));
    }
    @Test public void seasonalHomeAndCollectedAgeTotalsKeepScopeAndExplicitLoading() throws Exception {
        scenario=ActivityScenario.launch(MainActivity.class);waitText("BASEBALL");
        js("location.hash='#/NPB/home?homeSeason=autumn'");
        waitCondition("Seasonal CS remains directly reachable", "!!document.querySelector('.seasonal-stories>a[href*=\"/NPB/cs?season=2026\"] .editorial-cover')");
        assertEquals("Seasonal destinations stay directly reachable", "3", js("String(document.querySelectorAll('.seasonal-stories>a').length)"));
        assertEquals("Every seasonal card keeps the collected 2026 context", "true", js("Array.from(document.querySelectorAll('.seasonal-stories>a')).every(a=>a.querySelector('.editorial-cover-copy>p')?.textContent.includes('2026') && a.getAttribute('aria-label')?.length>0)"));
        js("document.querySelector('.seasonal-feature .source-note>summary').click()");waitText("楽しみ方");
        assertEquals("Short seasonal labels retain partial-source context", "true", js("document.querySelector('.seasonal-feature').textContent.includes('CSは一部収録')"));
        screenshot("npb-seasonal-home-360");
        js("location.hash='#/NPB/history?cohort=ageSeason&age=26&ageMode=collected&role=batting&recentPlayers=92a02594-a4f7-498c-bb83-8a41855b4645'");
        waitText("収録分の合計を読み込む");
        assertEquals("Age totals wait for the user before annual loading","false",js("!!document.querySelector('[aria-label=\"収録分の記録ウォッチ\"]')"));
        js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='収録分の合計を読み込む').click()");
        waitText("記録への歩み");waitText("合計対象：2023・2024・2025年");
        assertEquals("Collected comparison never claims complete Career","true",js("document.body.innerText.includes('年齢到達日までの通算や完全なキャリアではありません')"));
        screenshot("npb-age-collected-360");
        fontScaleAndRecreate(2.0f);waitText("収録分の合計を読み込む");waitViewport(360);
        assertEquals("Collected comparison has no overflow at 200 percent","true",js("document.documentElement.scrollWidth<=innerWidth"));screenshot("npb-age-collected-font-20");
    }
    @Test public void sourcedPlayerEventsKeepEvidenceAndLargeFont() throws Exception {
        Intent link = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://NPB/moves?kind=trade&player=3deea6d2-3347-430e-93c3-26ca2ebf15fa"));
        link.setClassName("com.tomoya41.baseballnotes", "jp.baseballdata.app.MainActivity");
        scenario = ActivityScenario.launch(link); waitText("杉浦稔大"); waitText("金銭トレードの記載");
        assertEquals("Events retain exact licensed source", "true", js("!!document.querySelector('a[href*=\"oldid=111421457\"]')"));
        assertEquals("Events do not certify current membership", "true", js("document.body.innerText.includes('現在の所属や登録の認定ではありません')"));
        screenshot("npb-player-events-360");
        fontScaleAndRecreate(2.0f); waitText("金銭トレードの記載"); waitViewport(360);
        assertEquals("Events fit at 200 percent", "true", js("document.documentElement.scrollWidth<=innerWidth")); screenshot("npb-player-events-font-20");
        assertTrue("Recreation retains event conditions", js("location.hash").contains("kind=trade&player=3deea6d2-3347-430e-93c3-26ca2ebf15fa"));
        js("location.hash='#/NPB/players/3deea6d2-3347-430e-93c3-26ca2ebf15fa/seasons?season=2025&role=pitching&story=1'");
        waitText("収録されたシーズンへ");
        js("Array.from(document.querySelectorAll('summary')).find(e=>e.textContent==='2026年の契約・移籍・戦力外・引退発表').click()");
        waitText("新しい記載から表示");
        assertEquals("Player history retains explicit trade evidence", "true", js("document.querySelector('section[aria-label=\"記事でたどる選手の動き\"]').textContent.includes('トレード')"));
        assertEquals("History fits at 200 percent", "true", js("document.documentElement.scrollWidth<=innerWidth")); screenshot("npb-player-event-history-font-20");
        js("location.hash='#/NPB/moves?kind=nonrenewal_notice'"); waitText("藤浪晋太郎"); waitText("戦力外通告");
        assertFalse("Nonrenewal is not promoted to free agency", js("document.querySelector('main').innerText").contains("自由契約の公示済み"));
        screenshot("npb-nonrenewal-font-20");
        js("location.hash='#/NPB/moves?kind=release'"); waitText("萩尾匡也"); waitText("自由契約");
        assertEquals("Release filter keeps its explicit participant only", "1", js("String(document.querySelectorAll('article.explorer-result').length)"));
        assertEquals("Other clause participants stay out of the free-contract filter", "false", js("Array.from(document.querySelectorAll('article.explorer-result h2')).some(e=>/山田龍聖|岡田悠希/.test(e.textContent))"));
        assertEquals("Release retains independent player identity", "true", js("!!document.querySelector('article a[href*=\"db66a48c-6dea-4b0c-8d10-b17e34a49856\"]')"));
        assertEquals("Free-contract observation fits at 200 percent", "true", js("document.documentElement.scrollWidth<=innerWidth"));
        scenario.recreate(); waitText("萩尾匡也");
        assertTrue("Recreation retains free-contract filter", js("location.hash").contains("kind=release"));
        screenshot("npb-release-font-20");
    }
    @Test public void longNavigationHistoryHasBoundedRecreationState() throws Exception {
        assertEquals("/NPB/search?q=A%26B%3DC%25", MainActivity.savedRoute("https://localhost/#/NPB/search?q=A%26B%3DC%25"));
        assertEquals("/privacy", MainActivity.savedRoute("https://localhost/#/privacy"));
        assertNull("Pre-router load does not consume cold links", MainActivity.savedRoute("https://localhost/"));
        assertNull("Oversized routes are not put in Activity state", MainActivity.savedRoute("https://localhost/#/NPB/search?q=" + "x".repeat(8200)));
        Intent link = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://NPB/cs?season=2026&stage=npb_cs_final&role=pitching"));
        link.setClassName("com.tomoya41.baseballnotes", "jp.baseballdata.app.MainActivity");
        scenario = ActivityScenario.launch(link);
        waitText("2026 クライマックスシリーズ"); waitText("リバン・モイネロ");
        String route = js("location.hash");
        // Inflate actual WebView history without fetching any extra payload.
        js("(()=>{const original=location.href;for(let i=0;i<160;i++)history.pushState({},'',original+'&q='+('history-'+i+'-').repeat(450));history.pushState({},'',original)})()");
        scenario.onActivity(activity -> {
            Bundle state = new Bundle(); activity.onSaveInstanceState(state);
            Parcel parcel = Parcel.obtain();
            try {
                parcel.writeBundle(state);
                assertTrue("Activity state remains below 192 KiB after long history", parcel.dataSize() < 192 * 1024);
                System.out.println("NPB_QA_SAVED_STATE_BYTES " + parcel.dataSize());
            } finally { parcel.recycle(); }
        });
        scenario.recreate(); waitText("2026 クライマックスシリーズ"); waitText("リバン・モイネロ");
        assertEquals("Long-history recreation retains the current scoped route", route, js("location.hash"));
        js("location.hash='#/NPB/cs?season=2026&q=A%26B%3DC%25'");
        waitCondition("Encoded search rendered", "document.querySelector('main input[type=search]')?.value==='A&B=C%'");
        scenario.recreate();
        waitCondition("Encoded search survives recreation", "document.querySelector('main input[type=search]')?.value==='A&B=C%'");
        scenario.onActivity(activity -> {
            // A delayed acknowledgement of the prior screen must not win over
            // the WebView's actual visited route when rotation saves state.
            activity.rememberRoute("/NPB/cs?season=2026&stage=npb_cs_final&role=pitching");
            Bundle saved = new Bundle(); activity.onSaveInstanceState(saved);
            assertEquals("Visited encoded route wins over delayed bridge acknowledgement",
                "/NPB/cs?season=2026&q=A%26B%3DC%25", saved.getString("baseball.webRoute"));
        });
        js("location.hash='#/privacy'"); waitText("プライバシー・データ");
        scenario.recreate(); waitText("プライバシー・データ");
        assertEquals("Top-level privacy is a resumable app screen", "#/privacy", js("location.hash"));
        scenario.onActivity(activity -> activity.onNewIntent(link));
        waitText("2026 クライマックスシリーズ"); waitText("リバン・モイネロ");
        assertTrue("The same genuine external launch URI is not suppressed after bootstrap", js("location.hash").contains("stage=npb_cs_final"));
        js("location.hash='#/NPB/cs?season=2026&q='+ 'x'.repeat(8300)");
        waitCondition("Oversized filter rendered", "document.querySelector('main input[type=search]')?.value.length===8300");
        waitPaint();
        scenario.onActivity(activity -> {
            Bundle saved = new Bundle(); activity.onSaveInstanceState(saved);
            assertNull("Oversized current route clears the old privacy/CS snapshot", saved.getString("baseball.webRoute"));
        });
    }
    @Test public void npbRegularGameRemainsUsableWhenDetailApiIsUnavailable() throws Exception {
        Intent link = new Intent(Intent.ACTION_VIEW, Uri.parse("baseballnotes://NPB/schedule?date=2026-10-08"));
        link.setClass(InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
        scenario = ActivityScenario.launch(link);
        waitCondition("Cold schedule link retains its exact date", "location.hash==='#/NPB/schedule?date=2026-10-08' && !!document.querySelector('.date-ribbon')");
        waitText("ヤクルト");
        js("document.querySelector('main a[href*=\"49a69ad2efd3bf67d3e5\"]').click()");
        waitCondition("Requested regular Game is rendered", "location.hash.includes('49a69ad2efd3bf67d3e5') && !!document.querySelector('.score-hero')");
        waitText("阪神"); waitText("ヤクルト");
        assertFalse("Saved result is not replaced by a whole-page API failure", js("document.querySelector('main').innerText").contains("試合データを取得できませんでした"));
        boolean summary = js("Boolean(document.querySelector('[aria-label=\"球団の選手を探す\"]'))").equals("true");
        if (summary) {
            waitText("保存済みの結果 · 更新未確認"); waitText("個人成績は現在取得できません");
            assertEquals("Score-only fallback does not fabricate player rows", "0", js("document.querySelectorAll('main table').length"));
            screenshot("npb-regular-saved-result");
            js("document.querySelector('[aria-label=\"球団の選手を探す\"] a[href*=\"tigers\"]').click()");
            waitText("阪神の選手");
            waitCondition("Saved team players are available", "!!document.querySelector('main .team-player-list .player-row')");
            js("document.querySelector('main .team-player-list .player-row').click()");
            waitCondition("Canonical player profile opened", "/#\\/NPB\\/players\\/[0-9a-f-]{36}/.test(location.hash) && !!document.querySelector('main h1')");
            shell("input keyevent KEYCODE_BACK"); waitText("阪神の選手");
            shell("input keyevent KEYCODE_BACK"); waitText("個人成績は現在取得できません");
        }
        assertEquals("Game result fits mobile viewport", "true", js("document.documentElement.scrollWidth<=innerWidth"));
        shell("input keyevent KEYCODE_BACK"); waitText("日程・結果");
        assertTrue("Back retains the selected schedule date", js("location.hash").contains("date=2026-10-08"));
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
