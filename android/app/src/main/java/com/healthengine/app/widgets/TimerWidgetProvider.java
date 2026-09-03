package com.healthengine.app.widgets;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.widget.RemoteViews;

import com.healthengine.app.R;

import org.json.JSONObject;

/**
 * Homescreen-виджет «Таймер»: автономный таймер отдыха.
 * Работает БЕЗ открытия приложения: пресеты, старт/пауза, сброс.
 * Тики — через AlarmManager (ELAPSED_REALTIME), состояние — в WidgetStore.
 */
public class TimerWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_CMD = "com.healthengine.app.action.TIMER_CMD";
    public static final String ACTION_TICK = "com.healthengine.app.action.TIMER_TICK";
    public static final String EXTRA_CMD = "cmd";
    public static final String EXTRA_SECONDS = "seconds";

    public static final String CMD_PRESET = "preset";
    public static final String CMD_TOGGLE = "toggle";
    public static final String CMD_RESET = "reset";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        try {
            if (intent == null || intent.getAction() == null) return;
            String action = intent.getAction();
            if (ACTION_CMD.equals(action)) {
                handleCmd(context, intent);
            } else if (ACTION_TICK.equals(action)) {
                handleTick(context);
            }
        } catch (Exception ignored) {}
    }

    static void handleCmd(Context context, Intent intent) {
        String cmd = intent.getStringExtra(EXTRA_CMD);
        if (cmd == null) return;
        JSONObject st = WidgetStore.getTimer(context);
        long now = SystemClock.elapsedRealtime();
        try {
            boolean running = st.optBoolean("running", false);
            int duration = st.optInt("durationSec", 90);
            int remaining = st.optInt("remainingSec", duration);
            if (CMD_PRESET.equals(cmd)) {
                int seconds = intent.getIntExtra(EXTRA_SECONDS, 0);
                if (seconds <= 0) return;
                if (seconds > 3600) seconds = 3600;
                st.put("durationSec", seconds);
                st.put("remainingSec", seconds);
                st.put("running", true);
                st.put("endAt", now + seconds * 1000L);
                WidgetStore.putTimer(context, st);
                scheduleTick(context);
            } else if (CMD_TOGGLE.equals(cmd)) {
                if (running) {
                    long endAt = st.optLong("endAt", now);
                    int rem = (int) Math.max(0, (endAt - now) / 1000L);
                    st.put("remainingSec", rem);
                    st.put("running", false);
                    WidgetStore.putTimer(context, st);
                    cancelTick(context);
                } else {
                    if (remaining <= 0) remaining = duration;
                    st.put("remainingSec", remaining);
                    st.put("running", true);
                    st.put("endAt", now + remaining * 1000L);
                    WidgetStore.putTimer(context, st);
                    scheduleTick(context);
                }
            } else if (CMD_RESET.equals(cmd)) {
                st.put("remainingSec", duration);
                st.put("running", false);
                WidgetStore.putTimer(context, st);
                cancelTick(context);
            }
        } catch (Exception ignored) {}
        updateAll(context);
    }

    static void handleTick(Context context) {
        JSONObject st = WidgetStore.getTimer(context);
        if (!st.optBoolean("running", false)) return;
        long now = SystemClock.elapsedRealtime();
        long endAt = st.optLong("endAt", now);
        int remaining = (int) Math.max(0, (endAt - now) / 1000L);
        try {
            st.put("remainingSec", remaining);
            if (remaining <= 0) {
                st.put("running", false);
                WidgetStore.putTimer(context, st);
                cancelTick(context);
            } else {
                WidgetStore.putTimer(context, st);
                scheduleTick(context);
            }
        } catch (Exception ignored) {}
        updateAll(context);
    }

    public static void scheduleTick(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = tickIntent(context);
            long at = SystemClock.elapsedRealtime() + 1000L;
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
            } catch (SecurityException se) {
                try {
                    am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    public static void cancelTick(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            am.cancel(tickIntent(context));
        } catch (Exception ignored) {}
    }

    static PendingIntent tickIntent(Context context) {
        Intent i = new Intent(context, TimerWidgetProvider.class);
        i.setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(context, 90, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent cmdIntent(Context context, String cmd, int seconds, int code) {
        Intent i = new Intent(context, TimerWidgetProvider.class);
        i.setAction(ACTION_CMD);
        i.putExtra(EXTRA_CMD, cmd);
        i.putExtra(EXTRA_SECONDS, seconds);
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, TimerWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_timer);
        JSONObject st = WidgetStore.getTimer(context);
        boolean running = st.optBoolean("running", false);
        int remaining = st.optInt("remainingSec", st.optInt("durationSec", 90));
        int duration = st.optInt("durationSec", 90);
        if (running) {
            long now = SystemClock.elapsedRealtime();
            long endAt = st.optLong("endAt", now);
            remaining = (int) Math.max(0, (endAt - now) / 1000L);
        }
        int m = remaining / 60;
        int s = remaining % 60;
        String time = (m < 10 ? "0" + m : String.valueOf(m)) + ":" + (s < 10 ? "0" + s : String.valueOf(s));
        if (!running && remaining == 0) {
            v.setTextViewText(R.id.w_timer_time, "Готово!");
            v.setTextViewText(R.id.w_timer_state, "нажмите сброс");
        } else {
            v.setTextViewText(R.id.w_timer_time, time);
            v.setTextViewText(R.id.w_timer_state, running ? "идёт…" : "пауза");
        }
        try {
            int max = Math.max(1, duration);
            v.setProgressBar(R.id.w_timer_bar, max, Math.max(0, Math.min(max, remaining)), false);
        } catch (Exception ignored) {}
        v.setTextViewText(R.id.w_timer_toggle, running ? "Пауза" : "Старт");

        v.setOnClickPendingIntent(R.id.w_timer_p30, cmdIntent(context, CMD_PRESET, 30, 91));
        v.setOnClickPendingIntent(R.id.w_timer_p60, cmdIntent(context, CMD_PRESET, 60, 92));
        v.setOnClickPendingIntent(R.id.w_timer_p90, cmdIntent(context, CMD_PRESET, 90, 93));
        v.setOnClickPendingIntent(R.id.w_timer_p180, cmdIntent(context, CMD_PRESET, 180, 94));
        v.setOnClickPendingIntent(R.id.w_timer_toggle, cmdIntent(context, CMD_TOGGLE, 0, 95));
        v.setOnClickPendingIntent(R.id.w_timer_reset, cmdIntent(context, CMD_RESET, 0, 96));
        v.setOnClickPendingIntent(R.id.w_timer_open,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_TRAINING, 97));
        return v;
    }
}
