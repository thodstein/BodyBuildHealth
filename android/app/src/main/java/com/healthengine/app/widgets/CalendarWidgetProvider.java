package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import com.healthengine.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Homescreen-виджет «Календарь» в духе TickTick.
 *
 * Умеет три режима — день / неделя / месяц — и листается прямо на рабочем
 * столе. Режим и опорная дата хранятся per-widget в WidgetStore, поэтому
 * WidgetBridge не обязан перерисовывать чужие экземпляры. Задачи лежат в
 * снапшоте (JS кладёт items вокруг сегодняшнего дня), отметка «сделано» и
 * быстрая задача уходят в общую очередь `type=task` / `type=task_add`:
 * JS применит её к he_coach_planner при следующем входе в приложение.
 *
 * RemoteViews не поддерживает EditText, поэтому «＋ Задача» открывает
 * компактный нативный редактор WidgetQuickAddActivity — без открытия
 * основного WebView-интерфейса.
 */
public class CalendarWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_TASK = "com.healthengine.app.action.WIDGET_TASK";
    public static final String EXTRA_TASK_ID = "task_id";
    public static final String EXTRA_DONE = "task_done";

    public static final String ACTION_MODE = "com.healthengine.app.action.WIDGET_CAL_MODE";
    public static final String ACTION_NAV = "com.healthengine.app.action.WIDGET_CAL_NAV";
    public static final String ACTION_TODAY = "com.healthengine.app.action.WIDGET_CAL_TODAY";
    public static final String ACTION_PICK_DAY = "com.healthengine.app.action.WIDGET_CAL_DAY";
    public static final String ACTION_ADD = "com.healthengine.app.action.WIDGET_CAL_ADD";

    public static final String EXTRA_WIDGET_ID = "widget_id";
    public static final String EXTRA_MODE = "mode";
    public static final String EXTRA_DIR = "dir";
    public static final String EXTRA_DATE = "date";

    public static final String MODE_DAY = "day";
    public static final String MODE_WEEK = "week";
    public static final String MODE_MONTH = "month";

    private static final int C_TEXT = 0xFFFFFFFF;
    private static final int C_MUTED = 0xFF8FA3C4;
    private static final int C_ACCENT = 0xFFC9F73A;
    private static final int C_DANGER = 0xFFFF6B6B;
    private static final int C_WARN = 0xFFF59E0B;
    private static final int C_ON_ACCENT = 0xFF07111F;

    private static final int AGENDA_ROWS = 7;
    private static final int DAY_ROWS = 4;
    private static final int MONTH_AGENDA_ROWS = 2;

    private static final String[] WD_SHORT = {"", "Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"};
    private static final String[] WD_TINY = {"", "вс", "пн", "вт", "ср", "чт", "пт", "сб"};
    private static final String[] MONTHS_SHORT = {
            "янв.", "февр.", "мар.", "апр.", "мая", "июн.",
            "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."
    };
    private static final String[] MONTHS_GEN = {
            "января", "февраля", "марта", "апреля", "мая", "июня",
            "июля", "августа", "сентября", "октября", "ноября", "декабря"
    };

    private static final Pattern ISO_RE = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");

    private static final int[] ROW_IDS = {
            R.id.w_cal_row1, R.id.w_cal_row2, R.id.w_cal_row3, R.id.w_cal_row4,
            R.id.w_cal_row5, R.id.w_cal_row6, R.id.w_cal_row7
    };
    private static final int[] CHECK_IDS = {
            R.id.w_cal_check1, R.id.w_cal_check2, R.id.w_cal_check3, R.id.w_cal_check4,
            R.id.w_cal_check5, R.id.w_cal_check6, R.id.w_cal_check7
    };
    private static final int[] TITLE_IDS = {
            R.id.w_cal_title1, R.id.w_cal_title2, R.id.w_cal_title3, R.id.w_cal_title4,
            R.id.w_cal_title5, R.id.w_cal_title6, R.id.w_cal_title7
    };
    private static final int[] GRID_ROW_IDS = {
            R.id.w_cal_g1, R.id.w_cal_g2, R.id.w_cal_g3,
            R.id.w_cal_g4, R.id.w_cal_g5, R.id.w_cal_g6
    };
    private static final int[][] GRID_CELL_IDS = {
            {R.id.w_cal_g1c1, R.id.w_cal_g1c2, R.id.w_cal_g1c3, R.id.w_cal_g1c4, R.id.w_cal_g1c5, R.id.w_cal_g1c6, R.id.w_cal_g1c7},
            {R.id.w_cal_g2c1, R.id.w_cal_g2c2, R.id.w_cal_g2c3, R.id.w_cal_g2c4, R.id.w_cal_g2c5, R.id.w_cal_g2c6, R.id.w_cal_g2c7},
            {R.id.w_cal_g3c1, R.id.w_cal_g3c2, R.id.w_cal_g3c3, R.id.w_cal_g3c4, R.id.w_cal_g3c5, R.id.w_cal_g3c6, R.id.w_cal_g3c7},
            {R.id.w_cal_g4c1, R.id.w_cal_g4c2, R.id.w_cal_g4c3, R.id.w_cal_g4c4, R.id.w_cal_g4c5, R.id.w_cal_g4c6, R.id.w_cal_g4c7},
            {R.id.w_cal_g5c1, R.id.w_cal_g5c2, R.id.w_cal_g5c3, R.id.w_cal_g5c4, R.id.w_cal_g5c5, R.id.w_cal_g5c6, R.id.w_cal_g5c7},
            {R.id.w_cal_g6c1, R.id.w_cal_g6c2, R.id.w_cal_g6c3, R.id.w_cal_g6c4, R.id.w_cal_g6c5, R.id.w_cal_g6c6, R.id.w_cal_g6c7},
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        try {
            for (int id : ids) updateWidget(context, id, null);
        } catch (Exception ignored) {}
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle newOptions) {
        try {
            updateWidget(context, id, null);
        } catch (Exception ignored) {}
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        super.onDeleted(context, ids);
        try {
            for (int id : ids) WidgetStore.clearCalendarState(context, id);
        } catch (Exception ignored) {}
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;
        int widgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        try {
            if (ACTION_TASK.equals(action)) {
                String taskId = intent.getStringExtra(EXTRA_TASK_ID);
                boolean done = intent.getBooleanExtra(EXTRA_DONE, true);
                if (taskId == null || taskId.isEmpty()) return;
                JSONObject item = new JSONObject();
                item.put("type", "task");
                item.put("id", taskId);
                item.put("done", done);
                item.put("ts", System.currentTimeMillis());
                WidgetStore.enqueue(context, item);
                optimisticTaskDone(context, taskId, done);
                if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) updateWidget(context, widgetId, null);
                else updateAll(context);
                return;
            }
            if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;

            if (ACTION_MODE.equals(action)) {
                String mode = intent.getStringExtra(EXTRA_MODE);
                WidgetStore.setCalendarMode(context, widgetId, mode);
                updateWidget(context, widgetId, null);
                return;
            }
            if (ACTION_NAV.equals(action)) {
                String mode = WidgetStore.getCalendarMode(context, widgetId);
                String anchor = defaultAnchor(context, widgetId);
                int dir = intent.getIntExtra(EXTRA_DIR, 1);
                WidgetStore.setCalendarAnchor(context, widgetId, shiftAnchor(anchor, mode, dir));
                updateWidget(context, widgetId, null);
                return;
            }
            if (ACTION_TODAY.equals(action)) {
                WidgetStore.setCalendarAnchor(context, widgetId, iso(today()));
                updateWidget(context, widgetId, null);
                return;
            }
            if (ACTION_PICK_DAY.equals(action)) {
                String date = intent.getStringExtra(EXTRA_DATE);
                if (isIso(date)) {
                    WidgetStore.setCalendarAnchor(context, widgetId, date);
                    WidgetStore.setCalendarMode(context, widgetId, MODE_DAY);
                    updateWidget(context, widgetId, null);
                }
                return;
            }
            // ACTION_ADD обрабатывается PendingIntent-ом активности, здесь не нужен.
        } catch (Exception ignored) {}
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, CalendarWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, buildFor(context, id, null));
            }
        } catch (Exception ignored) {}
        // «HE Сегодня»/«HE Неделя» — те же данные календаря в фиксированном режиме.
        try { TodayWidgetProvider.updateAll(context); } catch (Exception ignored) {}
        try { WeekWidgetProvider.updateAll(context); } catch (Exception ignored) {}
    }

    public static void updateWidget(Context context, int widgetId, String forcedMode) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            mgr.updateAppWidget(widgetId, buildFor(context, widgetId, forcedMode));
        } catch (Exception ignored) {}
    }

    /** Совместимость со старым кодом: сборка без привязки к экземпляру. */
    static RemoteViews build(Context context) {
        return buildFor(context, AppWidgetManager.INVALID_APPWIDGET_ID, null);
    }

    /**
     * Сборка RemoteViews.
     *
     * @param forcedMode null — обычный виджет с переключателем; "day"/"week" —
     *                   фиксированный вид для Today/Week-виджетов из манифеста.
     */
    public static RemoteViews buildFor(Context context, int widgetId, String forcedMode) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_calendar);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_CALENDAR);
        List<Task> tasks = readTasks(d);

        String today = iso(today());
        String anchor = forcedMode == null ? defaultAnchor(context, widgetId) : today;
        String mode = forcedMode == null ? WidgetStore.getCalendarMode(context, widgetId) : forcedMode;
        if (!MODE_WEEK.equals(mode) && !MODE_MONTH.equals(mode)) mode = MODE_DAY;

        // ---- Шапка: период и счётчик ----
        String period;
        List<Task> periodTasks;
        if (MODE_WEEK.equals(mode)) {
            String start = weekStart(anchor);
            String end = addDays(start, 6);
            period = dayLabel(start) + " – " + dayLabel(end);
            periodTasks = tasksInRange(tasks, start, end);
        } else if (MODE_MONTH.equals(mode)) {
            Calendar c = parseIso(anchor);
            period = c == null ? "" : (MONTHS_SHORT[c.get(Calendar.MONTH)] + " " + c.get(Calendar.YEAR));
            periodTasks = tasksInRange(tasks, monthStart(anchor), monthEnd(anchor));
        } else {
            period = dayLabel(anchor);
            periodTasks = tasksOn(tasks, anchor);
        }
        int total = periodTasks.size();
        int done = 0;
        for (Task t : periodTasks) if (t.done) done++;
        v.setTextViewText(R.id.w_cal_count, total > 0 ? (done + "/" + total) : "0");
        v.setTextColor(R.id.w_cal_count, total > 0 && done >= total ? C_ACCENT : C_MUTED);
        v.setTextViewText(R.id.w_cal_nav_label, period);
        v.setTextViewText(R.id.w_cal_nav_today, "Сегодня");

        // ---- Режимы и навигация ----
        boolean showChrome = forcedMode == null;
        v.setViewVisibility(R.id.w_cal_modes, showChrome ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_cal_nav_row, showChrome ? View.VISIBLE : View.GONE);
        if (showChrome) {
            styleModeChip(v, R.id.w_cal_chip_day, MODE_DAY.equals(mode), "День");
            styleModeChip(v, R.id.w_cal_chip_week, MODE_WEEK.equals(mode), "Неделя");
            styleModeChip(v, R.id.w_cal_chip_month, MODE_MONTH.equals(mode), "Месяц");
            v.setOnClickPendingIntent(R.id.w_cal_chip_day,
                    modeAction(context, widgetId, MODE_DAY, R.id.w_cal_chip_day));
            v.setOnClickPendingIntent(R.id.w_cal_chip_week,
                    modeAction(context, widgetId, MODE_WEEK, R.id.w_cal_chip_week));
            v.setOnClickPendingIntent(R.id.w_cal_chip_month,
                    modeAction(context, widgetId, MODE_MONTH, R.id.w_cal_chip_month));
            v.setOnClickPendingIntent(R.id.w_cal_nav_prev, navAction(context, widgetId, -1));
            v.setOnClickPendingIntent(R.id.w_cal_nav_next, navAction(context, widgetId, 1));
            v.setOnClickPendingIntent(R.id.w_cal_nav_today, todayAction(context, widgetId));
        }

        // ---- Сетка месяца ----
        boolean month = MODE_MONTH.equals(mode);
        v.setViewVisibility(R.id.w_cal_weekday_row, month ? View.VISIBLE : View.GONE);
        if (month) {
            renderMonthGrid(v, context, widgetId, anchor, today, tasks);
        } else {
            for (int rowId : GRID_ROW_IDS) v.setViewVisibility(rowId, View.GONE);
        }

        // ---- Агенда ----
        int agendaRows = MODE_WEEK.equals(mode) ? AGENDA_ROWS
                : (month ? MONTH_AGENDA_ROWS : DAY_ROWS);
        for (int i = 0; i < AGENDA_ROWS; i++) {
            v.setViewVisibility(ROW_IDS[i], i < agendaRows ? View.VISIBLE : View.GONE);
        }
        String emptyText = "";
        if (MODE_WEEK.equals(mode)) {
            renderWeekRows(v, context, widgetId, anchor, today, tasks);
        } else {
            renderDayRows(v, context, widgetId, anchor, today, tasks, month ? MONTH_AGENDA_ROWS : DAY_ROWS);
            if (tasksOn(tasks, anchor).isEmpty()) {
                emptyText = month
                        ? (total > 0 ? "В этом месяце есть задачи — выберите день с точкой" : "В этом месяце задач нет")
                        : "На этот день задач нет";
            }
        }
        v.setViewVisibility(R.id.w_cal_empty, emptyText.isEmpty() ? View.GONE : View.VISIBLE);
        if (!emptyText.isEmpty()) v.setTextViewText(R.id.w_cal_empty, emptyText);

        // ---- Просрочено ----
        int overdue = d.optInt("overdue", 0);
        int computedOverdue = 0;
        for (Task t : tasks) if (!t.done && t.date.compareTo(today) < 0) computedOverdue++;
        if (computedOverdue > overdue) overdue = computedOverdue;
        if (overdue > 0) {
            v.setTextViewText(R.id.w_cal_overdue, "⚠ " + overdue);
            v.setViewVisibility(R.id.w_cal_overdue, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.w_cal_overdue, View.GONE);
        }

        // ---- Действия ----
        v.setOnClickPendingIntent(R.id.w_cal_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_CALENDAR, 61));
        v.setOnClickPendingIntent(R.id.w_cal_brand,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_CALENDAR, 62));
        v.setOnClickPendingIntent(R.id.w_cal_add, addAction(context, widgetId, anchor));

        String a11y = total > 0
                ? ("Календарь, " + period + ": задач " + total + ", сделано " + done
                        + (overdue > 0 ? (", просрочено " + overdue) : ""))
                : ("Календарь, " + period + ": задач нет");
        v.setContentDescription(R.id.w_cal_root, a11y);
        return v;
    }

    private static void styleModeChip(RemoteViews v, int id, boolean on, String label) {
        v.setTextViewText(id, label);
        v.setInt(id, "setBackgroundResource", on ? R.drawable.widget_chip_on : R.drawable.widget_chip);
        v.setTextColor(id, on ? C_ON_ACCENT : 0xFFE2ECFF);
    }

    private static void renderWeekRows(RemoteViews v, Context context, int widgetId,
                                       String anchor, String today, List<Task> tasks) {
        String start = weekStart(anchor);
        for (int i = 0; i < AGENDA_ROWS; i++) {
            String date = addDays(start, i);
            Calendar c = parseIso(date);
            if (c == null) {
                v.setViewVisibility(ROW_IDS[i], View.GONE);
                continue;
            }
            v.setViewVisibility(ROW_IDS[i], View.VISIBLE);
            v.setTextViewText(CHECK_IDS[i], WD_SHORT[c.get(Calendar.DAY_OF_WEEK)]);
            v.setTextColor(CHECK_IDS[i], date.equals(today) ? C_ACCENT : C_MUTED);

            List<Task> day = tasksOn(tasks, date);
            String label;
            if (day.isEmpty()) {
                label = c.get(Calendar.DAY_OF_MONTH) + " · нет задач";
                v.setTextColor(TITLE_IDS[i], C_MUTED);
            } else {
                int done = 0;
                for (Task t : day) if (t.done) done++;
                Task first = firstUndone(day);
                label = c.get(Calendar.DAY_OF_MONTH) + " · " + done + "/" + day.size() + " · "
                        + (first.time.isEmpty() ? first.title : first.time + " " + first.title);
                v.setTextColor(TITLE_IDS[i], date.equals(today) ? C_ACCENT : C_TEXT);
            }
            v.setTextViewText(TITLE_IDS[i], label);
            v.setOnClickPendingIntent(ROW_IDS[i], pickDayAction(context, widgetId, date, i));
        }
    }

    private static void renderDayRows(RemoteViews v, Context context, int widgetId,
                                      String anchor, String today, List<Task> tasks, int maxRows) {
        List<Task> day = tasksOn(tasks, anchor);
        int shown = Math.min(day.size(), maxRows);
        for (int i = 0; i < maxRows; i++) {
            if (i >= shown) {
                v.setViewVisibility(ROW_IDS[i], View.GONE);
                continue;
            }
            Task t = day.get(i);
            v.setViewVisibility(ROW_IDS[i], View.VISIBLE);
            v.setTextViewText(CHECK_IDS[i], t.done ? "✓" : "○");
            v.setTextColor(CHECK_IDS[i], t.done ? C_ACCENT : priorityColor(t.priority));
            v.setTextViewText(TITLE_IDS[i], t.time.isEmpty() ? t.title : (t.time + "  " + t.title));
            v.setTextColor(TITLE_IDS[i], t.done ? C_MUTED : C_TEXT);
            v.setOnClickPendingIntent(ROW_IDS[i], toggleAction(context, widgetId, t.id, !t.done, i));
        }
        // Строки сверх maxRows прячем (в месячном режиме их 2).
        for (int i = maxRows; i < AGENDA_ROWS; i++) {
            v.setViewVisibility(ROW_IDS[i], View.GONE);
        }
    }

    private static void renderMonthGrid(RemoteViews v, Context context, int widgetId,
                                        String anchor, String today, List<Task> tasks) {
        Calendar first = parseIso(monthStart(anchor));
        if (first == null) return;
        int offset = (first.get(Calendar.DAY_OF_WEEK) + 5) % 7; // Пн = 0
        int days = first.getActualMaximum(Calendar.DAY_OF_MONTH);

        for (int r = 0; r < 6; r++) {
            boolean used = false;
            for (int c = 0; c < 7; c++) {
                int cellId = GRID_CELL_IDS[r][c];
                int dayNum = r * 7 + c - offset + 1;
                if (dayNum < 1 || dayNum > days) {
                    v.setTextViewText(cellId, "");
                    v.setInt(cellId, "setBackgroundResource", 0);
                    continue;
                }
                used = true;
                Calendar cell = (Calendar) first.clone();
                cell.set(Calendar.DAY_OF_MONTH, dayNum);
                String date = iso(cell);
                int count = tasksOn(tasks, date).size();
                v.setTextViewText(cellId, String.valueOf(dayNum) + (count > 0 ? "•" : ""));
                boolean on = date.equals(anchor) || date.equals(today);
                v.setInt(cellId, "setBackgroundResource", on ? R.drawable.widget_chip_on : 0);
                v.setTextColor(cellId, on ? C_ON_ACCENT : (count > 0 ? C_TEXT : C_MUTED));
                v.setOnClickPendingIntent(cellId, pickDayAction(context, widgetId, date, r * 7 + c));
            }
            v.setViewVisibility(GRID_ROW_IDS[r], used ? View.VISIBLE : View.GONE);
        }
    }

    private static Task firstUndone(List<Task> day) {
        for (Task t : day) if (!t.done) return t;
        return day.get(0);
    }

    /** Перекрасить задачу в снапшоте сразу, не дожидаясь синка из WebView. */
    static void optimisticTaskDone(Context context, String taskId, boolean done) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_CALENDAR);
            JSONArray tasks = d.optJSONArray("tasks");
            if (tasks != null) {
                for (int i = 0; i < tasks.length(); i++) {
                    JSONObject t = tasks.optJSONObject(i);
                    if (t != null && taskId.equals(t.optString("id", ""))) t.put("done", done);
                }
                int doneCount = 0;
                for (int i = 0; i < tasks.length(); i++) {
                    JSONObject t = tasks.optJSONObject(i);
                    if (t != null && t.optBoolean("done", false)) doneCount++;
                }
                d.put("done", doneCount);
            }
            JSONArray items = d.optJSONArray("items");
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject t = items.optJSONObject(i);
                    if (t != null && taskId.equals(t.optString("id", ""))) t.put("done", done);
                }
            }
            WidgetStore.putJson(context, WidgetStore.KEY_CALENDAR, d);
        } catch (Exception ignored) {}
    }

    /** Быстрая задача из нативного редактора: сразу видна в снапшоте. */
    static void optimisticTaskAdd(Context context, String id, String title, String date,
                                  String time, String priority) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_CALENDAR);
            JSONArray items = d.optJSONArray("items");
            if (items == null) {
                items = new JSONArray();
                // Старый снапшот без items: переносим видимые задачи дня с их датой.
                JSONArray legacy = d.optJSONArray("tasks");
                String baseDate = d.optString("date", "");
                if (legacy != null && isIso(baseDate)) {
                    for (int i = 0; i < legacy.length(); i++) {
                        JSONObject src = legacy.optJSONObject(i);
                        if (src == null) continue;
                        JSONObject copy = new JSONObject(src.toString());
                        copy.put("date", baseDate);
                        items.put(copy);
                    }
                }
            }
            JSONObject task = new JSONObject();
            task.put("id", id);
            task.put("date", date);
            task.put("title", title);
            task.put("time", time == null ? "" : time);
            task.put("done", false);
            task.put("priority", priority == null ? "none" : priority);
            items.put(task);
            d.put("items", items);
            String today = iso(today());
            if (today.equals(date)) {
                int total = d.optInt("total", 0) + 1;
                d.put("total", total);
                JSONArray legacy = d.optJSONArray("tasks");
                if (legacy == null) legacy = new JSONArray();
                if (legacy.length() < 5) legacy.put(task);
                d.put("tasks", legacy);
            }
            WidgetStore.putJson(context, WidgetStore.KEY_CALENDAR, d);
        } catch (Exception ignored) {}
    }

    // ------------------------------------------------------------------
    // Данные
    // ------------------------------------------------------------------

    static final class Task {
        final String id;
        final String date;
        final String title;
        final String time;
        final String priority;
        final boolean done;

        Task(String id, String date, String title, String time, String priority, boolean done) {
            this.id = id;
            this.date = date;
            this.title = title;
            this.time = time == null ? "" : time;
            this.priority = priority == null ? "none" : priority;
            this.done = done;
        }
    }

    private static List<Task> readTasks(JSONObject d) {
        List<Task> out = new ArrayList<>();
        JSONArray items = d.optJSONArray("items");
        if (items != null) {
            for (int i = 0; i < items.length() && out.size() < 1000; i++) {
                JSONObject t = items.optJSONObject(i);
                if (t == null) continue;
                String date = t.optString("date", "");
                if (!isIso(date)) continue;
                out.add(new Task(
                        t.optString("id", ""),
                        date,
                        t.optString("title", ""),
                        t.optString("time", ""),
                        t.optString("priority", "none"),
                        t.optBoolean("done", false)));
            }
        }
        if (out.isEmpty()) {
            // Совместимость со старым снапшотом: только задачи на сегодня.
            String baseDate = d.optString("date", "");
            JSONArray legacy = d.optJSONArray("tasks");
            if (legacy != null && isIso(baseDate)) {
                for (int i = 0; i < legacy.length(); i++) {
                    JSONObject t = legacy.optJSONObject(i);
                    if (t == null) continue;
                    out.add(new Task(
                            t.optString("id", ""),
                            baseDate,
                            t.optString("title", ""),
                            t.optString("time", ""),
                            t.optString("priority", "none"),
                            t.optBoolean("done", false)));
                }
            }
        }
        return out;
    }

    private static List<Task> tasksOn(List<Task> tasks, String date) {
        List<Task> out = new ArrayList<>();
        for (Task t : tasks) if (date.equals(t.date)) out.add(t);
        Collections.sort(out, TASK_ORDER);
        return out;
    }

    private static List<Task> tasksInRange(List<Task> tasks, String from, String to) {
        List<Task> out = new ArrayList<>();
        for (Task t : tasks) if (t.date.compareTo(from) >= 0 && t.date.compareTo(to) <= 0) out.add(t);
        Collections.sort(out, TASK_ORDER);
        return out;
    }

    private static final Comparator<Task> TASK_ORDER = new Comparator<Task>() {
        @Override
        public int compare(Task a, Task b) {
            String at = a.time.isEmpty() ? "99:99" : a.time;
            String bt = b.time.isEmpty() ? "99:99" : b.time;
            int c = at.compareTo(bt);
            if (c != 0) return c;
            int p = priorityRank(a.priority) - priorityRank(b.priority);
            if (p != 0) return p;
            return a.title.compareToIgnoreCase(b.title);
        }
    };

    private static int priorityRank(String priority) {
        if ("high".equals(priority)) return 0;
        if ("medium".equals(priority)) return 1;
        if ("low".equals(priority)) return 2;
        return 3;
    }

    private static int priorityColor(String priority) {
        if ("high".equals(priority)) return C_DANGER;
        if ("medium".equals(priority)) return C_WARN;
        if ("low".equals(priority)) return 0xFF38BDF8;
        return C_MUTED;
    }

    // ------------------------------------------------------------------
    // Даты (java.util.Calendar: minSdk 24 без java.time/desugaring)
    // ------------------------------------------------------------------

    static Calendar today() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c;
    }

    static Calendar parseIso(String iso) {
        if (iso == null) return null;
        Matcher m = ISO_RE.matcher(iso);
        if (!m.matches()) return null;
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)) - 1,
                Integer.parseInt(m.group(3)), 0, 0, 0);
        return c;
    }

    static boolean isIso(String iso) {
        return iso != null && ISO_RE.matcher(iso).matches() && parseIso(iso) != null;
    }

    static String iso(Calendar c) {
        return String.format(java.util.Locale.US, "%04d-%02d-%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static String addDays(String isoDate, int days) {
        Calendar c = parseIso(isoDate);
        if (c == null) return isoDate;
        c.add(Calendar.DAY_OF_MONTH, days);
        return iso(c);
    }

    static String weekStart(String isoDate) {
        Calendar c = parseIso(isoDate);
        if (c == null) return isoDate;
        int delta = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7; // Пн = 0
        c.add(Calendar.DAY_OF_MONTH, -delta);
        return iso(c);
    }

    static String monthStart(String isoDate) {
        Calendar c = parseIso(isoDate);
        if (c == null) return isoDate;
        c.set(Calendar.DAY_OF_MONTH, 1);
        return iso(c);
    }

    static String monthEnd(String isoDate) {
        Calendar c = parseIso(isoDate);
        if (c == null) return isoDate;
        c.set(Calendar.DAY_OF_MONTH, c.getActualMaximum(Calendar.DAY_OF_MONTH));
        return iso(c);
    }

    static String shiftAnchor(String anchor, String mode, int dir) {
        Calendar c = parseIso(anchor);
        if (c == null) c = today();
        if (MODE_MONTH.equals(mode)) {
            c.add(Calendar.MONTH, dir);
            return iso(c);
        }
        if (MODE_WEEK.equals(mode)) {
            c.add(Calendar.DAY_OF_MONTH, 7 * dir);
            return iso(c);
        }
        c.add(Calendar.DAY_OF_MONTH, dir);
        return iso(c);
    }

    private static String defaultAnchor(Context context, int widgetId) {
        String anchor = WidgetStore.getCalendarAnchor(context, widgetId);
        if (!isIso(anchor)) anchor = iso(today());
        return anchor;
    }

    private static String dayLabel(String isoDate) {
        Calendar c = parseIso(isoDate);
        if (c == null) return isoDate;
        return WD_TINY[c.get(Calendar.DAY_OF_WEEK)] + ", "
                + c.get(Calendar.DAY_OF_MONTH) + " " + MONTHS_GEN[c.get(Calendar.MONTH)];
    }

    // ------------------------------------------------------------------
    // PendingIntent-ы
    // ------------------------------------------------------------------

    private static int requestCode(int widgetId, int slot, int extra) {
        int base = Math.abs(widgetId) % 100000;
        return base * 400 + slot * 42 + (Math.abs(extra) % 42);
    }

    private static PendingIntent broadcast(Context context, int widgetId, String action,
                                           int slot, int extra) {
        Intent i = new Intent(context, CalendarWidgetProvider.class);
        i.setAction(action);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        return PendingIntent.getBroadcast(context, requestCode(widgetId, slot, extra), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent modeAction(Context context, int widgetId, String mode, int slot) {
        Intent i = new Intent(context, CalendarWidgetProvider.class);
        i.setAction(ACTION_MODE);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_MODE, mode);
        return PendingIntent.getBroadcast(context, requestCode(widgetId, 5 + modeIndex(mode), 0), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static int modeIndex(String mode) {
        if (MODE_WEEK.equals(mode)) return 1;
        if (MODE_MONTH.equals(mode)) return 2;
        return 0;
    }

    private static PendingIntent navAction(Context context, int widgetId, int dir) {
        Intent i = new Intent(context, CalendarWidgetProvider.class);
        i.setAction(ACTION_NAV);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_DIR, dir);
        return PendingIntent.getBroadcast(context, requestCode(widgetId, dir < 0 ? 2 : 3, 0), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent todayAction(Context context, int widgetId) {
        return broadcast(context, widgetId, ACTION_TODAY, 4, 0);
    }

    private static PendingIntent pickDayAction(Context context, int widgetId, String date, int cell) {
        Intent i = new Intent(context, CalendarWidgetProvider.class);
        i.setAction(ACTION_PICK_DAY);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_DATE, date);
        return PendingIntent.getBroadcast(context, requestCode(widgetId, 8, cell), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent toggleAction(Context context, int widgetId, String taskId,
                                      boolean done, int row) {
        Intent i = new Intent(context, CalendarWidgetProvider.class);
        i.setAction(ACTION_TASK);
        i.putExtra(EXTRA_WIDGET_ID, widgetId);
        i.putExtra(EXTRA_TASK_ID, taskId);
        i.putExtra(EXTRA_DONE, done);
        return PendingIntent.getBroadcast(context, requestCode(widgetId, 0, row), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent addAction(Context context, int widgetId, String date) {
        Intent i = new Intent(context, WidgetQuickAddActivity.class);
        // Свой action: PendingIntent-ы опознаются по requestCode+action, иначе
        // «＋ Задача» и «＋ Заметка» могли бы схлопнуться в один объект.
        i.setAction(ACTION_ADD);
        i.putExtra(WidgetQuickAddActivity.EXTRA_KIND, WidgetQuickAddActivity.KIND_TASK);
        i.putExtra(WidgetQuickAddActivity.EXTRA_DATE, date);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode(widgetId, 1, 0), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
