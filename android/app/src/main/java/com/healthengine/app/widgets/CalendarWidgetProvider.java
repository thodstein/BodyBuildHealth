package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import com.healthengine.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Homescreen-виджет «Календарь»: агенда дня в духе TickTick.
 *
 * Показывает дату, задачи на сегодня и даёт отметить «сделано» прямо с рабочего
 * стола. Отметка уходит в очередь (WidgetStore.KEY_QUEUE, type=task), JS
 * применяет её к he_coach_planner при следующем входе на Главную, а снапшот
 * оптимистично перекрашивается сразу — без ожидания WebView.
 */
public class CalendarWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_TASK = "com.healthengine.app.action.WIDGET_TASK";
    public static final String EXTRA_TASK_ID = "task_id";
    public static final String EXTRA_DONE = "task_done";

    private static final int C_TEXT = 0xFFFFFFFF;
    private static final int C_MUTED = 0xFF8FA3C4;
    private static final int C_ACCENT = 0xFFC9F73A;
    private static final int C_DANGER = 0xFFFF6B6B;
    private static final int C_WARN = 0xFFF59E0B;

    private static final int ROWS = 3;

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        try {
            if (intent != null && ACTION_TASK.equals(intent.getAction())) {
                String id = intent.getStringExtra(EXTRA_TASK_ID);
                boolean done = intent.getBooleanExtra(EXTRA_DONE, true);
                if (id == null || id.isEmpty()) return;
                JSONObject item = new JSONObject();
                item.put("type", "task");
                item.put("id", id);
                item.put("done", done);
                item.put("ts", System.currentTimeMillis());
                WidgetStore.enqueue(context, item);
                optimisticTaskDone(context, id, done);
                updateAll(context);
                return;
            }
        } catch (Exception ignored) {}
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, CalendarWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    /** Перекрасить задачу в снапшоте сразу, не дожидаясь синка из WebView. */
    static void optimisticTaskDone(Context context, String taskId, boolean done) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_CALENDAR);
            JSONArray tasks = d.optJSONArray("tasks");
            if (tasks == null) return;
            int doneCount = 0;
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject t = tasks.optJSONObject(i);
                if (t == null) continue;
                if (taskId.equals(t.optString("id", ""))) t.put("done", done);
                if (t.optBoolean("done", false)) doneCount++;
            }
            d.put("done", doneCount);
            WidgetStore.putJson(context, WidgetStore.KEY_CALENDAR, d);
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_CALENDAR);

        String dateLabel = d.optString("dateLabel", "");
        int total = Math.max(0, d.optInt("total", 0));
        int done = Math.max(0, d.optInt("done", 0));
        int overdue = Math.max(0, d.optInt("overdue", 0));

        v.setTextViewText(R.id.w_cal_date, dateLabel);
        v.setTextViewText(R.id.w_cal_count, total > 0 ? (done + "/" + total) : "0");
        v.setTextColor(R.id.w_cal_count, done > 0 && done >= total ? C_ACCENT : C_MUTED);

        if (overdue > 0) {
            v.setTextViewText(R.id.w_cal_overdue, "⚠ " + overdue);
            v.setViewVisibility(R.id.w_cal_overdue, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.w_cal_overdue, View.GONE);
        }

        int[] rowIds = {R.id.w_cal_row1, R.id.w_cal_row2, R.id.w_cal_row3};
        int[] checkIds = {R.id.w_cal_check1, R.id.w_cal_check2, R.id.w_cal_check3};
        int[] titleIds = {R.id.w_cal_title1, R.id.w_cal_title2, R.id.w_cal_title3};

        JSONArray tasks = d.optJSONArray("tasks");
        int shown = tasks == null ? 0 : Math.min(tasks.length(), ROWS);
        for (int i = 0; i < ROWS; i++) {
            if (i >= shown) {
                v.setViewVisibility(rowIds[i], View.GONE);
                continue;
            }
            JSONObject t = tasks.optJSONObject(i);
            if (t == null) {
                v.setViewVisibility(rowIds[i], View.GONE);
                continue;
            }
            v.setViewVisibility(rowIds[i], View.VISIBLE);
            String title = t.optString("title", "");
            String time = t.optString("time", "");
            boolean isDone = t.optBoolean("done", false);
            String priority = t.optString("priority", "none");

            v.setTextViewText(titleIds[i], time.isEmpty() ? title : (time + "  " + title));
            v.setTextColor(titleIds[i], isDone ? C_MUTED : C_TEXT);
            v.setTextViewText(checkIds[i], isDone ? "✓" : "○");
            v.setTextColor(checkIds[i], isDone ? C_ACCENT : priorityColor(priority));

            String taskId = t.optString("id", "");
            if (!taskId.isEmpty()) {
                v.setOnClickPendingIntent(rowIds[i], toggleAction(context, taskId, !isDone, i));
            }
        }

        v.setOnClickPendingIntent(R.id.w_cal_open,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_CALENDAR, 61));
        v.setOnClickPendingIntent(R.id.w_cal_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_CALENDAR, 62));

        String a11y = total > 0
                ? ("Календарь на " + dateLabel + ": задач " + total + ", сделано " + done
                        + (overdue > 0 ? (", просрочено " + overdue) : ""))
                : ("Календарь на " + dateLabel + ": задач нет");
        v.setContentDescription(R.id.w_cal_root, a11y);
        return v;
    }

    private static int priorityColor(String priority) {
        if ("high".equals(priority)) return C_DANGER;
        if ("medium".equals(priority)) return C_WARN;
        if ("low".equals(priority)) return 0xFF38BDF8;
        return C_MUTED;
    }

    static PendingIntent toggleAction(Context context, String taskId, boolean done, int row) {
        Intent i = new Intent(context, CalendarWidgetProvider.class);
        i.setAction(ACTION_TASK);
        i.putExtra(EXTRA_TASK_ID, taskId);
        i.putExtra(EXTRA_DONE, done);
        int code = 70 + row * 2 + (done ? 1 : 0) + (taskId.hashCode() & 0xFF) * 16;
        return PendingIntent.getBroadcast(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
