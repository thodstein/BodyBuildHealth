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

/**
 * Виджет «Сегодня»: план дня + переход в проведение.
 */
public class TodayWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, TodayWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        v.setOnClickPendingIntent(R.id.w_today_root, openApp(context, WidgetStore.TARGET_TRAINING_RUN, 41));
        v.setOnClickPendingIntent(R.id.w_today_act, openApp(context, WidgetStore.TARGET_TRAINING_RUN, 42));
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
