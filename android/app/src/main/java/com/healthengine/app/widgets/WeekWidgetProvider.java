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
 * Виджет «Неделя»: переход в дневник/план.
 */
public class WeekWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, WeekWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, CalendarWidgetProvider.buildFor(
                        context, id, CalendarWidgetProvider.MODE_WEEK));
            }
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        return CalendarWidgetProvider.buildFor(
                context, AppWidgetManager.INVALID_APPWIDGET_ID, CalendarWidgetProvider.MODE_WEEK);
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
