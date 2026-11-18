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
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// window.Native for docs/mockups/app.js. Only pages from localhost or the bundled assets load in this WebView
// (MainActivity.shouldOverrideUrlLoading), so only our own page can call these methods.
// Voice stays on the phone: the on-device recognizer and an offline Korean TTS voice only. If either is missing
// the app says so instead of using a cloud engine (docs/DESIGN.md stage 7).
public class WebBridge implements SensorEventListener {
  final MainActivity act;
  final WebView web;
  final SharedPreferences prefs;
  SpeechRecognizer stt;
  TextToSpeech tts;
  volatile boolean ttsReady = false;
  volatile boolean trusted = false; // set by MainActivity: true only on http://localhost:8787/
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
    act.stopService(new Intent(act, WalkService.class));
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
    act.getSystemService(SensorManager.class).unregisterListener(this);
    if (stt != null) stt.destroy();
    tts.shutdown();
  }
}
