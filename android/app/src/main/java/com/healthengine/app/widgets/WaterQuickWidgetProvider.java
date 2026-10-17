package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.widget.RemoteViews;

import com.healthengine.app.MainActivity;
import com.healthengine.app.R;

import org.json.JSONObject;

/**
 * Виджет «Вода»: кнопка +250 мл → очередь виджета.
 */
public class WaterQuickWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WATER = "com.healthengine.app.action.WIDGET_WATER_QUICK";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        try {
            if (intent != null && ACTION_WATER.equals(intent.getAction())) {
                int ml = 250;
                JSONObject item = new JSONObject();
                item.put("type", "water");
                item.put("ml", ml);
                item.put("ts", System.currentTimeMillis());
                WidgetStore.enqueue(context, item);
                updateAll(context);
                return;
            }
        } catch (Exception ignored) {}
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, WaterQuickWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_waterquick);
        Intent waterIntent = new Intent(context, WaterQuickWidgetProvider.class);
        waterIntent.setAction(ACTION_WATER);
        PendingIntent waterPi = PendingIntent.getBroadcast(context, 31, waterIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_waterquick_root, openApp(context, WidgetStore.TARGET_TRAINING, 32));
        v.setOnClickPendingIntent(R.id.w_waterquick_act, waterPi);
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
