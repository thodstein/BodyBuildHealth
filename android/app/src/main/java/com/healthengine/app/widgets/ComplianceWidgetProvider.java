package com.healthengine.app.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;

import com.healthengine.app.R;

import org.json.JSONObject;

/** Homescreen-виджет «Комплаенс»: % выполнения + деталь. Тап открывает приложение. */
public class ComplianceWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, ComplianceWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_compliance);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_COMPLIANCE);
        int pct = Math.max(0, Math.min(100, d.optInt("pct", 0)));
        String label = d.optString("label", "");
        String detail = d.optString("detail", "");
        boolean has = d.has("pct");
        v.setTextViewText(R.id.w_comp_pct, has ? pct + "%" : "—");
        v.setTextViewText(R.id.w_comp_label, label.isEmpty() ? "Комплаенс" : label);
        v.setTextViewText(R.id.w_comp_detail, detail.isEmpty() ? "Откройте приложение" : detail);
        try {
            v.setProgressBar(R.id.w_comp_bar, 100, pct, false);
        } catch (Exception ignored) {}
        v.setOnClickPendingIntent(R.id.w_comp_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_SUPPORT, 31));
        return v;
    }
}
