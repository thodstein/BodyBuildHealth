package com.healthengine.app.widgets;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.healthengine.app.MainActivity;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * WidgetBridgePlugin — Capacitor-мост «WebView <-> homescreen-виджеты».
 *
 * JS пишет снапшоты (тренировка/комплаенс/питание) и команды таймера,
 * забирает очередь быстрого добавления и one-shot launch target.
 * Вне native (web/Telegram) плагин недоступен — JS-сторона молча
 * деградирует к localStorage-фолбэку, виджетов там нет.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private void updateAll(Context ctx) {
        try {
            TrainingWidgetProvider.updateAll(ctx);
        } catch (Exception ignored) {}
        try {
            ComplianceWidgetProvider.updateAll(ctx);
        } catch (Exception ignored) {}
        try {
            NutritionWidgetProvider.updateAll(ctx);
        } catch (Exception ignored) {}
        try {
            TimerWidgetProvider.updateAll(ctx);
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void syncTraining(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONObject obj = new JSONObject();
            obj.put("title", call.getString("title", ""));
            obj.put("subtitle", call.getString("subtitle", ""));
            obj.put("meta", call.getString("meta", ""));
            obj.put("updatedAt", System.currentTimeMillis());
            WidgetStore.putJson(ctx, WidgetStore.KEY_TRAINING, obj);
            TrainingWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("syncTraining failed");
        }
    }

    @PluginMethod
    public void syncCompliance(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONObject obj = new JSONObject();
            obj.put("pct", call.getInt("pct", 0));
            obj.put("label", call.getString("label", ""));
            obj.put("detail", call.getString("detail", ""));
            obj.put("updatedAt", System.currentTimeMillis());
            WidgetStore.putJson(ctx, WidgetStore.KEY_COMPLIANCE, obj);
            ComplianceWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("syncCompliance failed");
        }
    }

    @PluginMethod
    public void syncNutrition(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONObject obj = new JSONObject();
            obj.put("kcal", call.getInt("kcal", 0));
            obj.put("targetKcal", call.getInt("targetKcal", 0));
            obj.put("protein", call.getInt("protein", 0));
            obj.put("waterMl", call.getInt("waterMl", 0));
            obj.put("queue", WidgetStore.queueSize(ctx));
            obj.put("updatedAt", System.currentTimeMillis());
            WidgetStore.putJson(ctx, WidgetStore.KEY_NUTRITION, obj);
            NutritionWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("syncNutrition failed");
        }
    }

    @PluginMethod
    public void queueWater(PluginCall call) {
        try {
            Context ctx = getContext();
            int ml = call.getInt("ml", 250);
            if (ml <= 0) ml = 250;
            if (ml > 2000) ml = 2000;
            JSONObject item = new JSONObject();
            item.put("type", "water");
            item.put("ml", ml);
            item.put("ts", System.currentTimeMillis());
            int size = WidgetStore.enqueue(ctx, item);
            NutritionWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("queue", size);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("queueWater failed");
        }
    }

    @PluginMethod
    public void queueNutrition(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONObject item = new JSONObject();
            item.put("type", "food");
            item.put("name", call.getString("name", ""));
            item.put("kcal", call.getInt("kcal", 0));
            item.put("p", call.getInt("p", 0));
            item.put("f", call.getInt("f", 0));
            item.put("c", call.getInt("c", 0));
            item.put("meal", call.getString("meal", "snack"));
            item.put("ts", System.currentTimeMillis());
            int size = WidgetStore.enqueue(ctx, item);
            NutritionWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("queue", size);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("queueNutrition failed");
        }
    }

    @PluginMethod
    public void drainQueue(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONArray arr = WidgetStore.drainQueue(ctx);
            NutritionWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("items", arr.toString());
            ret.put("count", arr.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("drainQueue failed");
        }
    }

    @PluginMethod
    public void queueSize(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("queue", WidgetStore.queueSize(getContext()));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("queueSize failed");
        }
    }

    // ---- Timer ----

    @PluginMethod
    public void timerCommand(PluginCall call) {
        try {
            Context ctx = getContext();
            String action = call.getString("action", "toggle");
            int seconds = call.getInt("seconds", 0);
            JSONObject st = WidgetStore.getTimer(ctx);
            long now = SystemClock.elapsedRealtime();
            boolean running = st.optBoolean("running", false);
            int duration = st.optInt("durationSec", 90);
            int remaining = st.optInt("remainingSec", duration);

            if ("preset".equals(action) && seconds > 0) {
                if (seconds > 3600) seconds = 3600;
                duration = seconds;
                remaining = seconds;
                running = true;
                st.put("durationSec", duration);
                st.put("remainingSec", remaining);
                st.put("running", true);
                st.put("endAt", now + remaining * 1000L);
                TimerWidgetProvider.scheduleTick(ctx);
            } else if ("start".equals(action)) {
                if (seconds > 0) {
                    if (seconds > 3600) seconds = 3600;
                    duration = seconds;
                    remaining = seconds;
                    st.put("durationSec", duration);
                }
                if (remaining <= 0) remaining = duration;
                running = true;
                st.put("remainingSec", remaining);
                st.put("running", true);
                st.put("endAt", now + remaining * 1000L);
                TimerWidgetProvider.scheduleTick(ctx);
            } else if ("pause".equals(action)) {
                if (running) {
                    long endAt = st.optLong("endAt", now);
                    remaining = (int) Math.max(0, (endAt - now) / 1000L);
                    st.put("remainingSec", remaining);
                }
                running = false;
                st.put("running", false);
                TimerWidgetProvider.cancelTick(ctx);
            } else if ("toggle".equals(action)) {
                if (running) {
                    long endAt = st.optLong("endAt", now);
                    remaining = (int) Math.max(0, (endAt - now) / 1000L);
                    st.put("remainingSec", remaining);
                    st.put("running", false);
                    TimerWidgetProvider.cancelTick(ctx);
                    running = false;
                } else {
                    if (remaining <= 0) remaining = duration;
                    st.put("remainingSec", remaining);
                    st.put("running", true);
                    st.put("endAt", now + remaining * 1000L);
                    TimerWidgetProvider.scheduleTick(ctx);
                    running = true;
                }
            } else if ("reset".equals(action)) {
                remaining = duration;
                running = false;
                st.put("remainingSec", remaining);
                st.put("running", false);
                TimerWidgetProvider.cancelTick(ctx);
            }
            WidgetStore.putTimer(ctx, st);
            TimerWidgetProvider.updateAll(ctx);

            JSObject ret = new JSObject();
            ret.put("running", running);
            ret.put("remainingSec", remaining);
            ret.put("durationSec", duration);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("timerCommand failed");
        }
    }

    @PluginMethod
    public void getTimerState(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONObject st = WidgetStore.getTimer(ctx);
            if (st.optBoolean("running", false)) {
                long now = SystemClock.elapsedRealtime();
                long endAt = st.optLong("endAt", now);
                int remaining = (int) Math.max(0, (endAt - now) / 1000L);
                st.put("remainingSec", remaining);
                if (remaining <= 0) {
                    st.put("running", false);
                    WidgetStore.putTimer(ctx, st);
                    TimerWidgetProvider.updateAll(ctx);
                }
            }
            JSObject ret = new JSObject();
            ret.put("running", st.optBoolean("running", false));
            ret.put("remainingSec", st.optInt("remainingSec", 90));
            ret.put("durationSec", st.optInt("durationSec", 90));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("getTimerState failed");
        }
    }

    // ---- Launch target (one-shot deep link from widget tap) ----

    @PluginMethod
    public void getLaunchTarget(PluginCall call) {
        try {
            String t = WidgetStore.consumeLaunchTarget(getContext());
            JSObject ret = new JSObject();
            if (t != null) ret.put("target", t);
            else ret.put("target", null);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("getLaunchTarget failed");
        }
    }

    // ---- Pin to home screen (Android 8+) ----

    @PluginMethod
    public void requestPinWidget(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                ret.put("requested", false);
                ret.put("reason", "api<26");
                call.resolve(ret);
                return;
            }
            Context ctx = getContext();
            String kind = call.getString("kind", "training");
            Class<?> provider = providerFor(kind);
            if (provider == null) {
                ret.put("requested", false);
                ret.put("reason", "unknown-kind");
                call.resolve(ret);
                return;
            }
            AppWidgetManager mgr = ctx.getSystemService(AppWidgetManager.class);
            if (mgr == null || !mgr.isRequestPinAppWidgetSupported()) {
                ret.put("requested", false);
                ret.put("reason", "not-supported");
                call.resolve(ret);
                return;
            }
            ComponentName cn = new ComponentName(ctx, provider);
            Intent success = new Intent(ctx, MainActivity.class);
            success.setAction(WidgetStore.ACTION_OPEN);
            success.putExtra(WidgetStore.EXTRA_TARGET, kindToTarget(kind));
            PendingIntent pi = PendingIntent.getActivity(
                    ctx, ("pin:" + kind).hashCode(), success,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            mgr.requestPinAppWidget(cn, null, pi);
            ret.put("requested", true);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("requested", false);
            call.resolve(ret);
        }
    }

    private Class<?> providerFor(String kind) {
        if ("training".equals(kind)) return TrainingWidgetProvider.class;
        if ("timer".equals(kind)) return TimerWidgetProvider.class;
        if ("compliance".equals(kind)) return ComplianceWidgetProvider.class;
        if ("nutrition".equals(kind)) return NutritionWidgetProvider.class;
        return null;
    }

    private String kindToTarget(String kind) {
        if ("training".equals(kind) || "timer".equals(kind)) return WidgetStore.TARGET_TRAINING;
        if ("nutrition".equals(kind)) return WidgetStore.TARGET_NUTRITION;
        if ("compliance".equals(kind)) return WidgetStore.TARGET_SUPPORT;
        return WidgetStore.TARGET_HOME;
    }

    @PluginMethod
    public void refreshAll(PluginCall call) {
        try {
            updateAll(getContext());
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("refreshAll failed");
        }
    }
}
