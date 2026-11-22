package com.healthengine.app.widgets;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.healthengine.app.MainActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.regex.Pattern;

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
            WorkoutWidgetProvider.updateAll(ctx);
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
        try {
            CalendarWidgetProvider.updateAll(ctx);
        } catch (Exception ignored) {}
        try {
            NotesWidgetProvider.updateAll(ctx);
        } catch (Exception ignored) {}
        try {
            WaterQuickWidgetProvider.updateAll(ctx);
        } catch (Exception ignored) {}
        // «Быстрый сет» тоже подхватывает настройку прозрачности.
        try {
            QuickSetWidgetProvider.updateAll(ctx);
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
            obj.put("progress", Math.max(0, Math.min(100, call.getInt("progress", 0))));
            obj.put("live", call.getBoolean("live", false));
            obj.put("actionLabel", call.getString("actionLabel", ""));
            obj.put("actionTarget", call.getString("actionTarget", ""));
            obj.put("nextExercise", call.getString("nextExercise", ""));
            obj.put("weekProgress", Math.max(0, Math.min(100, call.getInt("weekProgress", 0))));
            obj.put("lastSessionDate", call.getString("lastSessionDate", ""));
            obj.put("lastSessionVolume", Math.max(0, call.getInt("lastSessionVolume", 0)));
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
            obj.put("fat", call.getInt("fat", 0));
            obj.put("carbs", call.getInt("carbs", 0));
            obj.put("targetProtein", call.getInt("targetProtein", 0));
            obj.put("targetFat", call.getInt("targetFat", 0));
            obj.put("targetCarbs", call.getInt("targetCarbs", 0));
            obj.put("waterMl", call.getInt("waterMl", 0));
            obj.put("waterTargetMl", call.getInt("waterTargetMl", 0));
            // Агрегаты за день/неделю/месяц: считает JS (collectNutrition), виджет
            // только переключает период. Ключи жёстко нормализуем — RemoteViews
            // читает их напрямую, мусор из моста ему нельзя.
            JSObject periodsRaw = call.getObject("periods");
            if (periodsRaw != null) {
                JSONObject periods = new JSONObject(periodsRaw.toString());
                JSONObject clean = new JSONObject();
                for (String key : new String[]{"day", "week", "month"}) {
                    JSONObject p = periods.optJSONObject(key);
                    if (p == null) continue;
                    JSONObject stats = new JSONObject();
                    stats.put("kcal", clampInt(p.optInt("kcal", 0)));
                    stats.put("protein", clampInt(p.optInt("protein", 0)));
                    stats.put("fat", clampInt(p.optInt("fat", 0)));
                    stats.put("carbs", clampInt(p.optInt("carbs", 0)));
                    stats.put("waterMl", clampInt(p.optInt("waterMl", 0)));
                    stats.put("days", clampInt(p.optInt("days", 0)));
                    stats.put("waterDays", clampInt(p.optInt("waterDays", 0)));
                    clean.put(key, stats);
                }
                if (clean.length() > 0) obj.put("periods", clean);
            }
            obj.put("queue", WidgetStore.queueSize(ctx));
            // Последняя запись дня — кнопка «↩» на виджете.
            JSObject lastFoodRaw = call.getObject("lastFood");
            if (lastFoodRaw != null) {
                JSONObject last = new JSONObject(lastFoodRaw.toString());
                String lname = last.optString("name", "").trim();
                if (!lname.isEmpty()) {
                    JSONObject clean = new JSONObject();
                    clean.put("name", clip(lname, 40));
                    clean.put("meal", clip(last.optString("meal", ""), 32));
                    // Адрес записи: по нему «↩» снимает именно её.
                    String ldate = last.optString("date", "");
                    if (ISO_DATE.matcher(ldate).matches()) clean.put("date", ldate);
                    int lindex = last.optInt("index", -1);
                    if (lindex >= 0) clean.put("index", lindex);
                    clean.put("kcal", clampInt(last.optInt("kcal", 0)));
                    clean.put("protein", clampInt(last.optInt("protein", 0)));
                    clean.put("fat", clampInt(last.optInt("fat", 0)));
                    clean.put("carbs", clampInt(last.optInt("carbs", 0)));
                    int qty = clampInt(last.optInt("qty", 0));
                    if (qty > 0) clean.put("qty", qty);
                    obj.put("lastFood", clean);
                }
            }
            // Последние дни (итоги + позиции) — листание дат и список дня.
            JSObject daysRaw = call.getObject("days");
            if (daysRaw != null) obj.put("days", cleanDays(new JSONObject(daysRaw.toString())));
            // Чипы «недавние / избранное».
            JSArray quickRaw = call.getArray("quick");
            if (quickRaw != null) {
                JSONArray quick = new JSONArray(quickRaw.toString());
                JSONArray cleanQuick = new JSONArray();
                for (int i = 0; i < quick.length() && cleanQuick.length() < 6; i++) {
                    JSONObject f = quick.optJSONObject(i);
                    if (f == null) continue;
                    String name = f.optString("name", "").trim();
                    if (name.isEmpty()) continue;
                    JSONObject cf = new JSONObject();
                    cf.put("name", clip(name, 28));
                    cf.put("kcal", clampInt(f.optInt("kcal", 0)));
                    cf.put("p", clampInt(f.optInt("p", 0)));
                    cf.put("f", clampInt(f.optInt("f", 0)));
                    cf.put("c", clampInt(f.optInt("c", 0)));
                    int qty = clampInt(f.optInt("qty", 0));
                    cf.put("qty", qty > 0 ? qty : 100);
                    String meal = f.optString("meal", "");
                    if (!meal.isEmpty()) cf.put("meal", clip(meal, 32));
                    if (f.optBoolean("fav", false)) cf.put("fav", true);
                    cleanQuick.put(cf);
                }
                if (cleanQuick.length() > 0) obj.put("quick", cleanQuick);
            }
            // Приёмы пищи дневника (пресеты + свои): по ним редактор еды строит
            // чипы. Без списка на виджете было только 4 приёма из 9.
            JSArray mealsRaw = call.getArray("meals");
            if (mealsRaw != null) {
                JSONArray meals = new JSONArray(mealsRaw.toString());
                JSONArray cleanMeals = new JSONArray();
                for (int i = 0; i < meals.length() && cleanMeals.length() < 20; i++) {
                    String m = meals.optString(i, "").trim();
                    if (m.isEmpty()) continue;
                    String cm = clip(m, 32);
                    boolean dup = false;
                    for (int j = 0; j < cleanMeals.length(); j++) {
                        if (cm.equalsIgnoreCase(cleanMeals.optString(j, ""))) {
                            dup = true;
                            break;
                        }
                    }
                    if (!dup) cleanMeals.put(cm);
                }
                if (cleanMeals.length() > 0) obj.put("meals", cleanMeals);
            }
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

    private static int clampInt(int value) {
        return Math.max(0, Math.min(10_000_000, value));
    }

    private static final Pattern ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

    /** Обрезка строки: лишние символы в RemoteViews всё равно не покажутся. */
    private static String clip(String value, int max) {
        String v = value == null ? "" : value.trim();
        return v.length() > max ? v.substring(0, max) : v;
    }

    /**
     * Дни дневника для виджета: только ISO-ключи, 7 самых свежих, позиции
     * обрезаны по 20. Мусор из моста в префы не попадает — widget читает JSON
     * напрямую и на неожиданных типах падает в пустой виджет.
     */
    private static JSONObject cleanDays(JSONObject days) throws JSONException {
        JSONObject out = new JSONObject();
        List<String> keys = new ArrayList<>();
        Iterator<String> it = days.keys();
        while (it.hasNext()) {
            String key = it.next();
            if (ISO_DATE.matcher(key).matches()) keys.add(key);
        }
        Collections.sort(keys);
        for (int i = Math.max(0, keys.size() - 7); i < keys.size(); i++) {
            String key = keys.get(i);
            JSONObject day = days.optJSONObject(key);
            if (day == null) continue;
            JSONObject clean = new JSONObject();
            clean.put("kcal", clampInt(day.optInt("kcal", 0)));
            clean.put("p", clampInt(day.optInt("p", 0)));
            clean.put("f", clampInt(day.optInt("f", 0)));
            clean.put("c", clampInt(day.optInt("c", 0)));
            clean.put("waterMl", clampInt(day.optInt("waterMl", 0)));
            JSONArray items = day.optJSONArray("items");
            JSONArray cleanItems = new JSONArray();
            if (items != null) {
                for (int j = 0; j < items.length() && cleanItems.length() < 20; j++) {
                    JSONObject item = items.optJSONObject(j);
                    if (item == null) continue;
                    String name = item.optString("name", "").trim();
                    if (name.isEmpty()) continue;
                    JSONObject ci = new JSONObject();
                    ci.put("name", clip(name, 40));
                    ci.put("kcal", clampInt(item.optInt("kcal", 0)));
                    ci.put("p", clampInt(item.optInt("p", 0)));
                    ci.put("f", clampInt(item.optInt("f", 0)));
                    ci.put("c", clampInt(item.optInt("c", 0)));
                    ci.put("meal", clip(item.optString("meal", ""), 32));
                    ci.put("index", Math.max(0, item.optInt("index", 0)));
                    int qty = clampInt(item.optInt("qty", 0));
                    if (qty > 0) ci.put("qty", qty);
                    cleanItems.put(ci);
                }
            }
            clean.put("items", cleanItems);
            out.put(key, clean);
        }
        return out;
    }

    /**
     * Каталог продуктов для поиска в нативном редакторе еды. JS присылает его
     * один раз на версию FOOD_DB, поэтому метод не трогает виджеты.
     */
    @PluginMethod
    public void syncNutritionFoods(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONArray arr = new JSONArray(call.getString("items", "[]"));
            JSONArray clean = new JSONArray();
            for (int i = 0; i < arr.length() && clean.length() < 2000; i++) {
                JSONObject f = arr.optJSONObject(i);
                if (f == null) continue;
                String name = f.optString("name", "").trim();
                if (name.isEmpty()) continue;
                JSONObject cf = new JSONObject();
                cf.put("n", clip(name, 48));
                cf.put("k", clampInt(f.optInt("kcal", 0)));
                cf.put("p", clampInt(f.optInt("p", 0)));
                cf.put("f", clampInt(f.optInt("f", 0)));
                cf.put("c", clampInt(f.optInt("c", 0)));
                clean.put(cf);
            }
            JSONObject obj = new JSONObject();
            obj.put("version", clip(call.getString("version", ""), 64));
            obj.put("items", clean);
            obj.put("updatedAt", System.currentTimeMillis());
            WidgetStore.putJson(ctx, WidgetStore.KEY_FOODS, obj);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("syncNutritionFoods failed");
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
            NutritionWidgetProvider.optimisticWater(ctx, ml);
            NutritionWidgetProvider.updateAll(ctx);
            try {
                WaterQuickWidgetProvider.updateAll(ctx);
            } catch (Exception ignored) {}
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("queue", size);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("queueWater failed");
        }
    }

    @PluginMethod
    public void syncCalendar(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONObject obj = new JSONObject();
            obj.put("date", call.getString("date", ""));
            obj.put("dateLabel", call.getString("dateLabel", ""));
            JSArray tasks = call.getArray("tasks");
            obj.put("tasks", tasks == null ? new JSONArray() : tasks);
            // Широкий диапазон задач для нативных режимов «неделя»/«месяц».
            JSArray items = call.getArray("items");
            if (items != null) obj.put("items", items);
            obj.put("total", Math.max(0, call.getInt("total", 0)));
            obj.put("done", Math.max(0, call.getInt("done", 0)));
            obj.put("overdue", Math.max(0, call.getInt("overdue", 0)));
            obj.put("queue", WidgetStore.queueSize(ctx));
            obj.put("updatedAt", System.currentTimeMillis());
            WidgetStore.putJson(ctx, WidgetStore.KEY_CALENDAR, obj);
            CalendarWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("syncCalendar failed");
        }
    }

    @PluginMethod
    public void syncNotes(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONObject obj = new JSONObject();
            JSArray notes = call.getArray("notes");
            obj.put("notes", notes == null ? new JSONArray() : notes);
            obj.put("total", Math.max(0, call.getInt("total", 0)));
            obj.put("pinned", Math.max(0, call.getInt("pinned", 0)));
            obj.put("updatedAt", System.currentTimeMillis());
            WidgetStore.putJson(ctx, WidgetStore.KEY_NOTES, obj);
            NotesWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("syncNotes failed");
        }
    }

    @PluginMethod
    public void syncWorkout(PluginCall call) {
        try {
            Context ctx = getContext();
            JSONObject obj = new JSONObject();
            obj.put("title", call.getString("title", ""));
            obj.put("subtitle", call.getString("subtitle", ""));
            obj.put("live", call.getBoolean("live", false));
            obj.put("startedAt", call.getString("startedAt", ""));
            obj.put("setsDone", Math.max(0, call.getInt("setsDone", 0)));
            obj.put("setsPlanned", Math.max(0, call.getInt("setsPlanned", 0)));
            obj.put("volumeKg", Math.max(0, call.getInt("volumeKg", 0)));
            obj.put("progress", Math.max(0, Math.min(100, call.getInt("progress", 0))));
            obj.put("dayIndex", Math.max(0, call.getInt("dayIndex", 0)));
            JSArray list = call.getArray("exercises");
            obj.put("exercises", list == null ? new JSONArray() : list);
            obj.put("updatedAt", System.currentTimeMillis());
            WidgetStore.putJson(ctx, WidgetStore.KEY_WORKOUT, obj);
            WorkoutWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("syncWorkout failed");
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
            int qty = call.getInt("qty", 0);
            if (qty > 0) item.put("qty", Math.min(5000, qty));
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
    public void queueTaskToggle(PluginCall call) {
        try {
            Context ctx = getContext();
            String id = call.getString("id", "");
            if (id == null || id.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("queue", WidgetStore.queueSize(ctx));
                call.resolve(ret);
                return;
            }
            boolean done = call.getBoolean("done", true);
            JSONObject item = new JSONObject();
            item.put("type", "task");
            item.put("id", id);
            item.put("done", done);
            item.put("ts", System.currentTimeMillis());
            int size = WidgetStore.enqueue(ctx, item);
            CalendarWidgetProvider.optimisticTaskDone(ctx, id, done);
            CalendarWidgetProvider.updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("queue", size);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("queueTaskToggle failed");
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

    // ---- Прозрачность фона виджетов ----

    @PluginMethod
    public void getWidgetOpacity(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("opacity", WidgetStore.getWidgetOpacity(getContext()));
        call.resolve(ret);
    }

    /** 100 / 85 / 70 / 50 — фон всех виджетов перерисовывается сразу. */
    @PluginMethod
    public void setWidgetOpacity(PluginCall call) {
        try {
            Context ctx = getContext();
            WidgetStore.setWidgetOpacity(ctx, call.getInt("opacity", 100));
            updateAll(ctx);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("opacity", WidgetStore.getWidgetOpacity(ctx));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("setWidgetOpacity failed");
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
        if ("workout".equals(kind)) return WorkoutWidgetProvider.class;
        if ("timer".equals(kind)) return TimerWidgetProvider.class;
        if ("compliance".equals(kind)) return ComplianceWidgetProvider.class;
        if ("nutrition".equals(kind)) return NutritionWidgetProvider.class;
        if ("nutrition_panel".equals(kind)) return NutritionPanelWidgetProvider.class;
        if ("water".equals(kind)) return WaterQuickWidgetProvider.class;
        if ("calendar".equals(kind)) return CalendarWidgetProvider.class;
        if ("notes".equals(kind)) return NotesWidgetProvider.class;
        return null;
    }

    private String kindToTarget(String kind) {
        if ("training".equals(kind) || "timer".equals(kind)) return WidgetStore.TARGET_TRAINING;
        if ("workout".equals(kind)) return WidgetStore.TARGET_TRAINING_RUN;
        if ("nutrition".equals(kind)) return WidgetStore.TARGET_NUTRITION;
        if ("nutrition_panel".equals(kind)) return WidgetStore.TARGET_NUTRITION;
        if ("water".equals(kind)) return WidgetStore.TARGET_NUTRITION;
        if ("compliance".equals(kind)) return WidgetStore.TARGET_SUPPORT;
        if ("calendar".equals(kind)) return WidgetStore.TARGET_CALENDAR;
        if ("notes".equals(kind)) return WidgetStore.TARGET_NOTES;
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
