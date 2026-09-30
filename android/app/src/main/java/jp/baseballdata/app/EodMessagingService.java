package jp.baseballdata.app;

import android.Manifest;
import android.app.*;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.*;
import org.json.JSONObject;

public class EodMessagingService extends FirebaseMessagingService {
    static boolean isFavoritePlayer(String saved, String playerId) {
        try {
            var items = new JSONObject(saved == null ? "{}" : saved).optJSONArray("items");
            if (items == null) return false;
            for (int i = 0; i < items.length(); i++) {
                var item = items.optJSONObject(i);
                if (item != null && "NPB".equals(item.optString("league")) && "player".equals(item.optString("kind")) &&
                    playerId.equals(item.optString("entityId"))) return true;
            }
        } catch (Exception ignored) { /* Corrupt local data cannot authorize delivery. */ }
        return false;
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        var prefs = getSharedPreferences("eod-notifications", 0);
        if (!prefs.getBoolean("enabled", false)) return;
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        var data = message.getData(); String id = data.get("eventId"), link = data.get("deepLink");
        if (id == null || !id.matches("npb:notification:eod:20[0-9]{2}-[0-9]{2}-[0-9]{2}:[0-9a-f-]{36}") || link == null ||
            !link.matches("baseballnotes://NPB/players/[0-9a-f-]{36}")) return;
        String playerId = Uri.parse(link).getLastPathSegment();
        if (!isFavoritePlayer(getSharedPreferences("CapacitorStorage", 0).getString("baseball:favorites:v1", null), playerId)) return;
        if (prefs.contains(id)) return;
        var manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26)
            manager.createNotificationChannel(new NotificationChannel("eod-updates", "選手の成績更新", NotificationManager.IMPORTANCE_DEFAULT));
        Intent intent = new Intent(this, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse(link))
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        var notification = new NotificationCompat.Builder(this, "eod-updates").setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(data.get("title")).setContentText(data.get("body")).setContentIntent(pending).setAutoCancel(true).build();
        manager.notify(id, 0, notification);
        var edit = prefs.edit();
        if (prefs.getAll().size() > 500) for (String key : prefs.getAll().keySet()) if (key.startsWith("npb:notification:")) edit.remove(key);
        edit.putBoolean(id, true).apply();
    }
}
