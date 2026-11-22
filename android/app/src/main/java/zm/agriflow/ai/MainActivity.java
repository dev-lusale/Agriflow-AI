package zm.agriflow.ai;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * AgriFlow AI main screen.
 * Android's WebView does not update navigator.onLine by itself, so the web app's
 * online/offline badge and sync queue would think the phone is always online.
 * We watch real connectivity and pass it to the WebView (fires 'online'/'offline' events).
 */
public class MainActivity extends BridgeActivity {
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback callback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        connectivity = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivity == null) return;
        pushNetworkState();
        callback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network network) { pushNetworkState(); }
            @Override public void onLost(Network network) { pushNetworkState(); }
            @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) { pushNetworkState(); }
        };
        try {
            connectivity.registerDefaultNetworkCallback(callback);
        } catch (RuntimeException ignored) {
            callback = null;
        }
    }

    private boolean hasInternet() {
        Network active = connectivity.getActiveNetwork();
        if (active == null) return false;
        NetworkCapabilities caps = connectivity.getNetworkCapabilities(active);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void pushNetworkState() {
        final boolean online = hasInternet();
        runOnUiThread(() -> {
            if (bridge == null) return;
            WebView web = bridge.getWebView();
            if (web != null) web.setNetworkAvailable(online);
        });
    }

    @Override
    public void onDestroy() {
        if (connectivity != null && callback != null) {
            try { connectivity.unregisterNetworkCallback(callback); } catch (RuntimeException ignored) { }
        }
        super.onDestroy();
    }
}
