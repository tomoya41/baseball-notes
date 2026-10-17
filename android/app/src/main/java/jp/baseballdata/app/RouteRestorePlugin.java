package jp.baseballdata.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** One-shot, private Activity route; never exports browsing history or data. */
@CapacitorPlugin(name = "RouteRestore")
public class RouteRestorePlugin extends Plugin {
    @PluginMethod public void consume(PluginCall call) {
        JSObject result = new JSObject();
        String route = ((MainActivity) getActivity()).consumeRestoredRoute();
        if (route != null) result.put("route", route);
        call.resolve(result);
    }
}
