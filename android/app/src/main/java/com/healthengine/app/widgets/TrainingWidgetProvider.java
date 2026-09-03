package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import com.healthengine.app.MainActivity;
import com.healthengine.app.R;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Homescreen-виджет «Тренировка»: последняя/текущая сессия + кнопка открыть. */
public class TrainingWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, TrainingWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_training);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_TRAINING);
        String title = d.optString("title", "");
        String subtitle = d.optString("subtitle", "");
        String meta = d.optString("meta", "");
        if (title.isEmpty()) {
            v.setTextViewText(R.id.w_training_title, "Тренировка");
            v.setTextViewText(R.id.w_training_sub, "Откройте план недели");
            v.setTextViewText(R.id.w_training_meta, "Health Engine");
        } else {
            v.setTextViewText(R.id.w_training_title, title);
            v.setTextViewText(R.id.w_training_sub, subtitle.isEmpty() ? " " : subtitle);
            String stamp = "";
            long at = d.optLong("updatedAt", 0L);
            if (at > 0) {
                stamp = new SimpleDateFormat("dd.MM HH:mm", Locale.getDefault())
                        .format(new Date(at));
            }
            String metaLine = meta.isEmpty() ? stamp : (stamp.isEmpty() ? meta : meta + " · " + stamp);
            v.setTextViewText(R.id.w_training_meta, metaLine.isEmpty() ? " " : metaLine);
        }
        v.setOnClickPendingIntent(R.id.w_training_root, openApp(context, WidgetStore.TARGET_TRAINING, 11));
        v.setOnClickPendingIntent(R.id.w_training_open, openApp(context, WidgetStore.TARGET_TRAINING, 12));
        return v;
    }

    static PendingIntent openApp(Context context, String target, int code) {
        Intent i = new Intent(context, MainActivity.class);
        i.setAction(WidgetStore.ACTION_OPEN);
        i.putExtra(WidgetStore.EXTRA_TARGET, target);
        i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
