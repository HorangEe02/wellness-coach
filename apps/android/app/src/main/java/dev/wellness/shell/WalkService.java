package dev.wellness.shell;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;

// Records one walk with the GPS: distance and moving time, the same fields Pace-Coach's records keep.
// A foreground service so it keeps going with the screen off. The page reads the totals through WebBridge.
public class WalkService extends Service implements LocationListener {
  static volatile boolean recording = false;
  static volatile long start = 0;
  static volatile double distM = 0;
  static volatile double activeSec = 0;
  static final float MAX_ACCURACY_M = 30;   // ignore fixes worse than this
  static final float MOVING_MPS = 0.5f;     // slower than this counts as a stop (auto rest)
  static final long MAX_GAP_MS = 30000;     // a longer gap between fixes is not counted as walking
  static final float MAX_MPS = 4f;          // faster than a brisk run: a GPS jump, not walking
  Location last;

  static final String STOP = "dev.wellness.shell.STOP_WALK";

  static void reset() { start = System.currentTimeMillis(); distM = 0; activeSec = 0; }

  @Override public int onStartCommand(Intent intent, int flags, int id) {
    String ch = "walk";
    NotificationManager nm = getSystemService(NotificationManager.class);
    nm.createNotificationChannel(new NotificationChannel(ch, "산책 기록", NotificationManager.IMPORTANCE_LOW));
    PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
    Notification n = new Notification.Builder(this, ch).setContentTitle("산책 기록 중").setContentText("앱을 열어 끝낼 수 있어요")
      .setSmallIcon(android.R.drawable.ic_menu_mylocation).setOngoing(true).setContentIntent(open).build();
    // Always promote first, even for a stop: a foreground service that ends before startForeground() crashes the app
    // (ForegroundServiceDidNotStartInTimeException, seen when "stop" was tapped right after "start").
    if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION); else startForeground(1, n);
    if (STOP.equals(intent == null ? null : intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
    last = null;
    try {
      getSystemService(LocationManager.class).requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000, 3, this, Looper.getMainLooper());
    } catch (SecurityException e) { recording = false; stopSelf(); }
    return START_NOT_STICKY;
  }

  @Override public void onLocationChanged(Location loc) {
    if (loc.hasAccuracy() && loc.getAccuracy() > MAX_ACCURACY_M) return;
    if (last != null) {
      long gap = loc.getTime() - last.getTime();
      float d = last.distanceTo(loc);
      float mps = gap > 0 ? d / (gap / 1000f) : 0;
      if (gap > 0 && gap <= MAX_GAP_MS && mps >= MOVING_MPS && mps <= MAX_MPS) { distM += d; activeSec += gap / 1000.0; }
    }
    last = loc;
  }

  @Override public void onDestroy() {
    recording = false;
    getSystemService(LocationManager.class).removeUpdates(this);
    super.onDestroy();
  }

  @Override public IBinder onBind(Intent i) { return null; }
}
