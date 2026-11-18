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
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.IOException;

// Native shell around the coach screen. The screen ships inside the APK (assets/web, copied from docs/mockups at
// build time) and is served from a fixed https origin that only this app answers, so nothing outside the APK can
// become "our page" and reach window.Native. The PC server is used only as an API, through WebBridge.api, sealed
// with the pairing key (packages/agent/src/pairing.ts).
public class MainActivity extends Activity {
  static final String HOST = "appassets.androidplatform.net"; // reserved for in-app content; never resolves to a server
  static final String WEB_ROOT = "https://" + HOST + "/web/";
  static final String APP_URL = WEB_ROOT + "floating-coach.html?app=1";
  WebView web;
  WebBridge bridge;

  @Override protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    // debug builds only: lets chrome://inspect on the PC look at the page
    if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
    web = new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setAllowFileAccess(false);
    web.getSettings().setAllowContentAccess(false);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if ("tel".equals(u.getScheme())) { startActivity(new Intent(Intent.ACTION_DIAL, u)); return true; } // 109 / 119 buttons
        if (isApp(u.toString())) return false;
        startActivity(new Intent(Intent.ACTION_VIEW, u)); // anything else opens outside the app, away from the bridge
        return true;
      }
      // Requests to the in-app origin are answered from assets/web; everything else on that host is refused.
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if (!HOST.equals(u.getHost())) return null;
        String path = u.getPath();
        if (!"https".equals(u.getScheme()) || path == null || !path.startsWith("/web/") || path.contains("..")) return notFound();
        try {
          return new WebResourceResponse(mime(path), path.endsWith(".png") || path.endsWith(".jpg") ? null : "utf-8", getAssets().open(path.substring(1)));
        } catch (IOException e) { return notFound(); }
      }
      // The bridge answers only while our own page is shown.
      @Override public void onPageStarted(WebView v, String url, android.graphics.Bitmap icon) { bridge.trusted = isApp(url); }
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

  static boolean isApp(String url) { return url != null && url.startsWith(WEB_ROOT); }

  static String mime(String path) {
    if (path.endsWith(".html")) return "text/html";
    if (path.endsWith(".js")) return "text/javascript";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg")) return "image/jpeg";
    if (path.endsWith(".css")) return "text/css";
    return "application/octet-stream";
  }

  static WebResourceResponse notFound() {
    WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", null);
    r.setStatusCodeAndReasonPhrase(404, "Not Found");
    return r;
  }

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
