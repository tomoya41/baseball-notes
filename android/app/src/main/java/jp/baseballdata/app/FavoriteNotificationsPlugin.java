package jp.baseballdata.app;

import android.Manifest;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "FavoriteNotifications", permissions = {
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class FavoriteNotificationsPlugin extends Plugin {
    private boolean configured() { return !FirebaseApp.getApps(getContext()).isEmpty(); }
    private boolean granted() { return NotificationManagerCompat.from(getContext()).areNotificationsEnabled() &&
        (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED); }
    @PluginMethod public void status(PluginCall call) {
        JSObject value = new JSObject(); value.put("configured", configured()); value.put("granted", granted()); call.resolve(value);
    }
    @PluginMethod public void enable(PluginCall call) {
        if (!configured()) { call.reject("Firebase configuration unavailable"); return; }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult"); return;
        }
        finishEnable(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call) { finishEnable(call); }
    private void finishEnable(PluginCall call) {
        boolean allow = granted();
        if (allow) {
            getContext().getSharedPreferences("eod-notifications", 0).edit().putBoolean("enabled", true).apply();
            FirebaseMessaging.getInstance().setAutoInitEnabled(true);
        }
        JSObject value = new JSObject(); value.put("granted", allow); call.resolve(value);
    }
    @PluginMethod public void disable(PluginCall call) {
        getContext().getSharedPreferences("eod-notifications", 0).edit().putBoolean("enabled", false).apply();
        if (configured()) FirebaseMessaging.getInstance().setAutoInitEnabled(false);
        call.resolve();
    }
    private void topic(PluginCall call, boolean subscribe) {
        String topic = call.getString("topic", "");
        if (!topic.matches("npb-player-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) { call.reject("Invalid canonical topic"); return; }
        if (!configured()) { call.reject("Firebase configuration unavailable"); return; }
        if (subscribe && !granted()) { call.reject("Notifications not permitted"); return; }
        var task = subscribe ? FirebaseMessaging.getInstance().subscribeToTopic(topic) : FirebaseMessaging.getInstance().unsubscribeFromTopic(topic);
        task.addOnCompleteListener(result -> { if (result.isSuccessful()) call.resolve(); else call.reject("Topic operation failed"); });
    }
    @PluginMethod public void subscribe(PluginCall call) { topic(call, true); }
    @PluginMethod public void unsubscribe(PluginCall call) { topic(call, false); }
}
