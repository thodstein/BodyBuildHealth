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
 * Homescreen-виджет «Заметки»: закреплённые и свежие заметки + прогресс
 * чек-листов, как в TickTick. Тап открывает вкладку «Заметки».
 */
public class NotesWidgetProvider extends AppWidgetProvider {

    /** Action только для PendingIntent-а «＋ Заметка» (в фильтрах не нужен). */
    static final String ACTION_QUICK_NOTE = "com.healthengine.app.action.WIDGET_NOTE_ADD";

    private static final int C_TEXT = 0xFFFFFFFF;
    private static final int C_MUTED = 0xFF8FA3C4;
    private static final int C_ACCENT = 0xFFC9F73A;
    private static final int C_AMBER = 0xFFF59E0B;

    private static final int ROWS = 3;

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, NotesWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_notes);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NOTES);

        int total = Math.max(0, d.optInt("total", 0));
        int pinned = Math.max(0, d.optInt("pinned", 0));
        v.setTextViewText(R.id.w_notes_count, pinned > 0 ? (pinned + " 📌 · " + total) : String.valueOf(total));
        v.setTextColor(R.id.w_notes_count, pinned > 0 ? C_AMBER : C_MUTED);

        int[] rowIds = {R.id.w_notes_row1, R.id.w_notes_row2, R.id.w_notes_row3};
        int[] titleIds = {R.id.w_notes_title1, R.id.w_notes_title2, R.id.w_notes_title3};
        int[] progIds = {R.id.w_notes_prog1, R.id.w_notes_prog2, R.id.w_notes_prog3};

        JSONArray notes = d.optJSONArray("notes");
        int shown = notes == null ? 0 : Math.min(notes.length(), ROWS);
        for (int i = 0; i < ROWS; i++) {
            if (i >= shown) {
                if (i == 0 && total <= 0) {
                    v.setViewVisibility(rowIds[i], View.VISIBLE);
                    v.setTextViewText(titleIds[i], "Заметок пока нет — нажмите ＋ Заметка");
                    v.setTextColor(titleIds[i], C_MUTED);
                    v.setTextViewText(progIds[i], "");
                    continue;
                }
                v.setViewVisibility(rowIds[i], View.GONE);
                continue;
            }
            JSONObject n = notes.optJSONObject(i);
            if (n == null) {
                v.setViewVisibility(rowIds[i], View.GONE);
                continue;
            }
            v.setViewVisibility(rowIds[i], View.VISIBLE);
            v.setTextViewText(titleIds[i], n.optString("title", "Заметка"));
            int done = Math.max(0, n.optInt("done", 0));
            int items = Math.max(0, n.optInt("total", 0));
            if (items > 0) {
                v.setTextViewText(progIds[i], done + "/" + items);
                v.setTextColor(progIds[i], done >= items ? C_ACCENT : C_MUTED);
            } else {
                v.setTextViewText(progIds[i], "•");
                v.setTextColor(progIds[i], C_MUTED);
            }
        }

        v.setOnClickPendingIntent(R.id.w_notes_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_NOTES, 81));
        // «＋ Заметка» больше не уводит в приложение: открывает компактный
        // нативный редактор и сразу пишет заметку в очередь.
        v.setOnClickPendingIntent(R.id.w_notes_open,
                quickAddNote(context));

        String a11y = total > 0
                ? ("Заметки: " + total + (pinned > 0 ? (", закреплено " + pinned) : ""))
                : "Заметки: пока пусто";
        v.setContentDescription(R.id.w_notes_root, a11y);
        return v;
    }

    private static PendingIntent quickAddNote(Context context) {
        Intent i = new Intent(context, WidgetQuickAddActivity.class);
        // Отдельный action, чтобы PendingIntent не совпал с «＋ Задача» календаря.
        i.setAction(ACTION_QUICK_NOTE);
        i.putExtra(WidgetQuickAddActivity.EXTRA_KIND, WidgetQuickAddActivity.KIND_NOTE);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 8201, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Быстрая заметка из нативного редактора: сразу видна в снапшоте. */
    static void optimisticNoteAdd(Context context, String id, String title, int checklistTotal) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NOTES);
            JSONArray notes = d.optJSONArray("notes");
            if (notes == null) notes = new JSONArray();
            JSONObject note = new JSONObject();
            note.put("id", id);
            note.put("title", title == null || title.isEmpty() ? "Без названия" : title);
            note.put("done", 0);
            note.put("total", Math.max(0, checklistTotal));
            // Новые заметки в приложении идут первыми; закреплённые остаются сверху.
            JSONArray next = new JSONArray();
            next.put(note);
            for (int i = 0; i < notes.length() && next.length() < 5; i++) {
                JSONObject row = notes.optJSONObject(i);
                if (row != null) next.put(row);
            }
            d.put("notes", next);
            d.put("total", d.optInt("total", 0) + 1);
            WidgetStore.putJson(context, WidgetStore.KEY_NOTES, d);
        } catch (Exception ignored) {}
    }
}
