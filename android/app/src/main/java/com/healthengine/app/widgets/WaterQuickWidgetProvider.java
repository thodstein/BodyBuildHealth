package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import com.healthengine.app.MainActivity;
import com.healthengine.app.R;

import org.json.JSONObject;

/**
 * Виджет «Вода»: прогресс дня (мл / цель) и кнопка +250 мл.
 *
 * Вода живёт в снапшоте питания (WidgetStore.KEY_NUTRITION): виджет читает
 * waterMl/waterTargetMl, поэтому не требует отдельного синка. Кнопка пишет
 * в общую очередь и оптимистично пополняет снапшот — значение видно сразу.
 */
public class WaterQuickWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WATER = "com.healthengine.app.action.WIDGET_WATER_QUICK";

    private static final int C_MUTED = 0xFF8FA3C4;
    private static final int C_TEXT = 0xFFFFFFFF;
    private static final int C_WATER = 0xFF38BDF8;

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
                NutritionWidgetProvider.optimisticWater(context, ml);
                updateAll(context);
                NutritionWidgetProvider.updateAll(context);
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
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_NUTRITION);
        int water = Math.max(0, d.optInt("waterMl", 0));
        int target = Math.max(0, d.optInt("waterTargetMl", 0));
        int pct = target > 0 ? Math.min(100, Math.round(water * 100f / target)) : 0;
        boolean done = target > 0 && water >= target;

        v.setTextViewText(R.id.w_waterquick_value, NutritionWidgetProvider.formatNum(water));
        v.setTextColor(R.id.w_waterquick_value, done ? C_WATER : C_TEXT);
        v.setTextViewText(
                R.id.w_waterquick_sub,
                target > 0 ? ("из " + NutritionWidgetProvider.formatNum(target) + " мл") : "мл");
        v.setTextViewText(R.id.w_waterquick_pct, target > 0 ? (done ? "✓ цель" : (pct + "%")) : " ");
        v.setTextColor(R.id.w_waterquick_pct, done ? C_WATER : C_MUTED);
        v.setProgressBar(R.id.w_waterquick_bar, 100, pct, false);
        v.setViewVisibility(R.id.w_waterquick_bar, View.VISIBLE);

        Intent waterIntent = new Intent(context, WaterQuickWidgetProvider.class);
        waterIntent.setAction(ACTION_WATER);
        PendingIntent waterPi = PendingIntent.getBroadcast(context, 31, waterIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_waterquick_root, openApp(context, WidgetStore.TARGET_NUTRITION, 32));
        v.setOnClickPendingIntent(R.id.w_waterquick_act, waterPi);

        v.setContentDescription(
                R.id.w_waterquick_root,
                target > 0
                        ? ("Вода: " + water + " из " + target + " мл")
                        : ("Вода: " + water + " мл"));
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
