package jp.baseballdata.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** User-selected JSON document only; no broad storage permission, path input or automatic upload. */
@CapacitorPlugin(name = "PersonalBackupFiles")
public class PersonalBackupFilesPlugin extends Plugin {
    private boolean saving;
    private synchronized void finished() { saving = false; }
    @PluginMethod public synchronized void save(PluginCall call) {
        if (saving) { call.reject("保存操作が進行中です。"); return; }
        String text = call.getString("text"), name = call.getString("filename");
        try {
            if (text == null || text.getBytes(StandardCharsets.UTF_8).length > 1000000 || name == null || !name.matches("baseball-notes-backup-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json")) throw new IllegalArgumentException();
            JSONObject body = new JSONObject(text);
            if (!"baseball-notes-personal-backup".equals(body.optString("format")) || body.optInt("version") != 1) throw new IllegalArgumentException();
            saving = true;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(call, intent, "documentCreated");
        } catch (Exception ignored) { saving = false; call.reject("バックアップを保存できません。"); }
    }
    @ActivityCallback private void documentCreated(PluginCall call, ActivityResult result) {
        if (call == null) { finished(); return; }
        if (result.getResultCode() != Activity.RESULT_OK) { finished(); JSObject value = new JSObject(); value.put("saved", false); call.resolve(value); return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null || !"content".equals(uri.getScheme())) { finished(); call.reject("保存先を確認できません。"); return; }
        getBridge().execute(() -> {
            String text = call.getString("text");
            if (text == null || text.getBytes(StandardCharsets.UTF_8).length > 1000000) { finished(); call.reject("保存内容を確認できません。"); return; }
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new IllegalStateException();
                stream.write(text.getBytes(StandardCharsets.UTF_8)); stream.flush();
            } catch (Exception ignored) { finished(); call.reject("ファイルを保存できません。"); return; }
            finished();
            JSObject value = new JSObject(); value.put("saved", true); call.resolve(value);
        });
    }
}
