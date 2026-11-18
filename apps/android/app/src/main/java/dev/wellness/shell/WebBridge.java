package dev.wellness.shell;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// window.Native for docs/mockups/app.js. Only the bundled screen (MainActivity.WEB_ROOT) can call these methods.
// Voice stays on the phone: the on-device recognizer and an offline Korean TTS voice only. If either is missing
// the app says so instead of using a cloud engine (docs/DESIGN.md stage 7).
public class WebBridge implements SensorEventListener {
  static final String SERVER = "http://localhost:8787"; // the PC, through `adb reverse tcp:8787 tcp:8787`
  static final byte[] AAD = "wellness-v1".getBytes(StandardCharsets.UTF_8);
  final MainActivity act;
  final WebView web;
  final SharedPreferences prefs;
  final ExecutorService net = Executors.newFixedThreadPool(2);
  final SecureRandom random = new SecureRandom();
  SpeechRecognizer stt;
  TextToSpeech tts;
  volatile boolean ttsReady = false;
  volatile boolean trusted = false; // set by MainActivity: true only while the bundled screen is shown
  volatile long stepCounter = -1; // cumulative since boot, from the sensor

  WebBridge(MainActivity act, WebView web) {
    this.act = act;
    this.web = web;
    prefs = act.getSharedPreferences("bridge", Context.MODE_PRIVATE);
    tts = new TextToSpeech(act, status -> {
      if (status != TextToSpeech.SUCCESS || tts.getVoices() == null) return;
      for (Voice v : tts.getVoices()) {
        if ("ko".equals(v.getLocale().getLanguage()) && !v.isNetworkConnectionRequired()) { tts.setVoice(v); ttsReady = true; return; }
      }
    });
    startSteps();
  }

  boolean granted(String p) { return act.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED; }

  // ---------- server API, sealed with the pairing key (packages/agent/src/pairing.ts) ----------
  // The key is put into files/pairing-key by tools/android/pair.mjs through `adb shell run-as`; no other app can write
  // there. Calls run off the UI thread and answer through window.__nativeApi(id, status, json); status 0 = transport
  // failure with a reason: "unpaired", "unreachable" or "unverified" (the answer was not sealed with our key).
  @JavascriptInterface public void api(int id, String method, String path, String device, String bodyJson) {
    if (!trusted) return;
    net.execute(() -> {
      byte[] key = pairingKey();
      if (key == null) { answer(id, 0, "unpaired"); return; }
      String nonce;
      String sealed;
      try {
        byte[] n = new byte[16];
        random.nextBytes(n);
        StringBuilder hex = new StringBuilder();
        for (byte b : n) hex.append(String.format("%02x", b));
        nonce = hex.toString();
        JSONObject env = new JSONObject().put("ts", System.currentTimeMillis()).put("nonce", nonce).put("method", method)
          .put("path", path).put("device", device).put("body", bodyJson == null || bodyJson.isEmpty() ? JSONObject.NULL : new JSONObject(bodyJson));
        sealed = seal(key, env.toString());
      } catch (Exception e) { answer(id, 0, "bad-request"); return; }
      String reply;
      try {
        HttpURLConnection c = (HttpURLConnection) new URL(SERVER + path).openConnection();
        c.setConnectTimeout(3000);
        c.setReadTimeout(90000); // the self-harm judge can take ~10 s
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("content-type", "text/plain; charset=utf-8");
        try (OutputStream o = c.getOutputStream()) { o.write(sealed.getBytes(StandardCharsets.UTF_8)); }
        if (c.getResponseCode() != 200) { answer(id, 0, c.getResponseCode() == 401 ? "unpaired" : "unverified"); return; }
        try (InputStream in = c.getInputStream()) { reply = readAll(in); }
      } catch (Exception e) { answer(id, 0, "unreachable"); return; }
      try {
        JSONObject r = new JSONObject(open(key, reply));
        if (!nonce.equals(r.optString("nonce"))) throw new SecurityException("reply for another request");
        answer(id, r.getInt("status"), r.isNull("body") ? "null" : r.get("body").toString());
      } catch (Exception e) { answer(id, 0, "unverified"); }
    });
  }

  byte[] pairingKey() {
    try {
      String hex = new String(Files.readAllBytes(new File(act.getFilesDir(), "pairing-key").toPath()), StandardCharsets.UTF_8).trim();
      if (!hex.matches("[0-9a-f]{64}")) return null;
      byte[] k = new byte[32];
      for (int i = 0; i < 32; i++) k[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
      return k;
    } catch (Exception e) { return null; }
  }

  // base64(iv[12] | ciphertext | tag[16]), AES-256-GCM, AAD "wellness-v1": same as pairing.ts
  String seal(byte[] key, String text) throws Exception {
    byte[] iv = new byte[12];
    random.nextBytes(iv);
    Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
    c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
    c.updateAAD(AAD);
    byte[] ct = c.doFinal(text.getBytes(StandardCharsets.UTF_8)); // ciphertext followed by the tag
    byte[] out = new byte[12 + ct.length];
    System.arraycopy(iv, 0, out, 0, 12);
    System.arraycopy(ct, 0, out, 12, ct.length);
    return Base64.encodeToString(out, Base64.NO_WRAP);
  }

  String open(byte[] key, String sealed) throws Exception {
    byte[] buf = Base64.decode(sealed.trim(), Base64.DEFAULT);
    if (buf.length < 29) throw new SecurityException("too short");
    Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
    c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, Arrays.copyOfRange(buf, 0, 12)));
    c.updateAAD(AAD);
    return new String(c.doFinal(buf, 12, buf.length - 12), StandardCharsets.UTF_8); // throws if a byte changed
  }

  static String readAll(InputStream in) throws Exception {
    ByteArrayOutputStream b = new ByteArrayOutputStream();
    byte[] chunk = new byte[8192];
    for (int n; (n = in.read(chunk)) > 0; ) b.write(chunk, 0, n);
    return b.toString("UTF-8");
  }

  void answer(int id, int status, String json) {
    act.runOnUiThread(() -> web.evaluateJavascript("window.__nativeApi && window.__nativeApi(" + id + "," + status + "," + JSONObject.quote(json) + ")", null));
  }

  // ---------- walk ----------
  @JavascriptInterface public String startWalk() {
    if (!trusted) return "untrusted";
    if (!granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
      act.ask(Build.VERSION.SDK_INT >= 33
        ? new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.POST_NOTIFICATIONS }
        : new String[] { Manifest.permission.ACCESS_FINE_LOCATION });
      return "permission";
    }
    if (!act.getSystemService(LocationManager.class).isProviderEnabled(LocationManager.GPS_PROVIDER)) return "gps-off";
    WalkService.reset();
    WalkService.recording = true;
    act.startForegroundService(new Intent(act, WalkService.class));
    return "ok";
  }

  @JavascriptInterface public String walkStatus() {
    if (!trusted) return "untrusted";
    return walkJson(WalkService.recording);
  }

  @JavascriptInterface public String stopWalk() {
    if (!trusted) return "untrusted";
    String out = walkJson(false);
    act.startForegroundService(new Intent(act, WalkService.class).setAction(WalkService.STOP)); // see WalkService.onStartCommand
    WalkService.recording = false;
    return out;
  }

  String walkJson(boolean recording) {
    try {
      return new JSONObject().put("recording", recording).put("start", WalkService.start)
        .put("distM", WalkService.distM).put("activeSec", WalkService.activeSec).toString();
    } catch (JSONException e) { return "{\"recording\":false}"; }
  }

  // Walks the server could not take yet, kept until the next app start.
  @JavascriptInterface public synchronized void keepUnsent(String walk) {
    if (!trusted) return;
    try {
      JSONArray a = new JSONArray(prefs.getString("unsent", "[]"));
      a.put(new JSONObject(walk));
      prefs.edit().putString("unsent", a.toString()).apply();
    } catch (JSONException ignored) { }
  }

  @JavascriptInterface public synchronized String takeUnsent() {
    if (!trusted) return "untrusted";
    String s = prefs.getString("unsent", "[]");
    prefs.edit().remove("unsent").apply();
    return s;
  }

  // ---------- steps ----------
  void startSteps() {
    if (Build.VERSION.SDK_INT >= 29 && !granted(Manifest.permission.ACTIVITY_RECOGNITION)) return; // MainActivity asks at start
    SensorManager sm = act.getSystemService(SensorManager.class);
    Sensor s = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    if (s != null) sm.registerListener(this, s, SensorManager.SENSOR_DELAY_NORMAL);
  }

  @Override public void onSensorChanged(SensorEvent e) { stepCounter = (long) e.values[0]; }
  @Override public void onAccuracyChanged(Sensor s, int a) { }

  // shortcut: counts from the first sensor reading of the day while the app was alive, so steps taken before the
  // app first ran today are missed. Health Connect daily totals are the upgrade when that matters.
  @JavascriptInterface public synchronized int stepsToday() {
    if (!trusted) return -1;
    long now = stepCounter;
    if (now < 0) return -1;
    String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    boolean sameDay = day.equals(prefs.getString("day", ""));
    long base = prefs.getLong("base", -1);
    long carried = sameDay ? prefs.getLong("carried", 0) : 0;
    if (!sameDay || base < 0 || now < base) {
      // a reboot resets the sensor: keep what was counted today before it
      if (sameDay && base >= 0) carried += Math.max(0, prefs.getLong("lastSeen", base) - base);
      base = now;
      prefs.edit().putString("day", day).putLong("base", base).putLong("carried", carried).apply();
    }
    prefs.edit().putLong("lastSeen", now).apply();
    return (int) (carried + now - base);
  }

  // ---------- voice ----------
  @JavascriptInterface public boolean voiceAvailable() {
    if (!trusted) return false;
    return Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(act);
  }

  @JavascriptInterface public String listen() {
    if (!trusted) return "untrusted";
    if (Build.VERSION.SDK_INT < 31 || !voiceAvailable()) return "unavailable";
    if (!granted(Manifest.permission.RECORD_AUDIO)) { act.ask(new String[] { Manifest.permission.RECORD_AUDIO }); return "permission"; }
    act.runOnUiThread(() -> {
      if (stt == null) {
        stt = SpeechRecognizer.createOnDeviceSpeechRecognizer(act);
        stt.setRecognitionListener(new Listener());
      }
      Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
      i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
      i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR");
      i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
      stt.startListening(i);
    });
    return "ok";
  }

  @JavascriptInterface public void stopListening() {
    if (!trusted) return;
    act.runOnUiThread(() -> { if (stt != null) stt.cancel(); });
  }

  // Empty text stops whatever is being read out.
  @JavascriptInterface public void speak(String text) {
    if (!trusted) return;
    if (!ttsReady) return;
    if (text == null || text.isEmpty()) { tts.stop(); return; }
    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "reply");
  }

  void call(String fn, String arg) {
    act.runOnUiThread(() -> web.evaluateJavascript("window." + fn + " && window." + fn + "(" + JSONObject.quote(arg) + ")", null));
  }

  class Listener implements RecognitionListener {
    @Override public void onResults(Bundle b) {
      ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
      if (r != null && !r.isEmpty() && !r.get(0).trim().isEmpty()) call("onNativeSpeech", r.get(0));
      else call("onNativeSpeechError", "잘 듣지 못했어요. 다시 말씀해 주세요.");
    }
    @Override public void onPartialResults(Bundle b) {
      ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
      if (r != null && !r.isEmpty()) call("onNativeSpeechPartial", r.get(0));
    }
    @Override public void onError(int e) {
      call("onNativeSpeechError", e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
        ? "잘 듣지 못했어요. 다시 말씀해 주세요." : "음성 인식을 하지 못했어요 (오류 " + e + ").");
    }
    @Override public void onReadyForSpeech(Bundle b) { }
    @Override public void onBeginningOfSpeech() { }
    @Override public void onRmsChanged(float v) { }
    @Override public void onBufferReceived(byte[] b) { }
    @Override public void onEndOfSpeech() { }
    @Override public void onEvent(int t, Bundle b) { }
  }

  void destroy() {
    net.shutdownNow();
    act.getSystemService(SensorManager.class).unregisterListener(this);
    if (stt != null) stt.destroy();
    tts.shutdown();
  }
}
