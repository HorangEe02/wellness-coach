package dev.wellness.shell;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

// Native shell around the coach screen served by packages/agent/src/server.ts.
// The phone reaches the PC through `adb reverse tcp:8787 tcp:8787`, so the URL is the phone's own localhost.
public class MainActivity extends Activity {
  static final String ORIGIN = "http://localhost:8787";
  static final String APP_URL = ORIGIN + "/";
  static final String OFFLINE_URL = "file:///android_asset/offline.html";
  WebView web;
  WebBridge bridge;

  @Override protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    // debug builds only: lets chrome://inspect on the PC look at the page
    if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
    web = new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        String s = u.getScheme();
        if ("tel".equals(s)) { startActivity(new Intent(Intent.ACTION_DIAL, u)); return true; } // 109 / 119 buttons
        if (isApp(u.toString())) return false;
        if ("file".equals(s)) return false;
        startActivity(new Intent(Intent.ACTION_VIEW, u)); // anything else opens outside the app, away from the bridge
        return true;
      }
      // The bridge answers only while our own page is shown: exact origin, not any localhost port.
      @Override public void onPageStarted(WebView v, String url, android.graphics.Bitmap icon) { bridge.trusted = isApp(url); }
      @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
        if (r.isForMainFrame()) v.loadUrl(OFFLINE_URL); // server off or adb reverse missing
      }
    });
    // targetSdk 35+ draws edge to edge: keep the page clear of the status bar, navigation bar and keyboard.
    // The padding goes on a container because WebView ignores its own padding when laying out the page.
    FrameLayout root = new FrameLayout(this);
    root.addView(web);
    root.setOnApplyWindowInsetsListener((v, insets) -> {
      if (Build.VERSION.SDK_INT >= 30) {
        Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
        v.setPadding(i.left, i.top, i.right, i.bottom);
      } else {
        v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
      }
      return insets;
    });
    bridge = new WebBridge(this, web);
    web.addJavascriptInterface(bridge, "Native");
    setContentView(root);
    web.loadUrl(APP_URL);
    if (Build.VERSION.SDK_INT >= 29) ask(new String[] { Manifest.permission.ACTIVITY_RECOGNITION }); // step sensor
  }

  static boolean isApp(String url) { return url != null && url.startsWith(APP_URL); }

  void ask(String[] perms) { runOnUiThread(() -> requestPermissions(perms, 1)); }

  @Override public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
    for (int i = 0; i < perms.length; i++) {
      if (Manifest.permission.ACTIVITY_RECOGNITION.equals(perms[i]) && results[i] == PackageManager.PERMISSION_GRANTED) bridge.startSteps();
    }
  }

  @Override protected void onDestroy() {
    bridge.destroy();
    web.destroy();
    super.onDestroy();
  }
}
