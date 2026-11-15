package com.healthengine.app.widgets;

import android.content.Context;
import android.widget.RemoteViews;

import com.healthengine.app.R;

/**
 * Общий стиль виджетов: сейчас — прозрачность фона.
 *
 * RemoteViews не умеет менять альфу drawable, поэтому прозрачность хранится
 * в WidgetStore (100/85/70/50) и подставляется готовым drawable при сборке:
 * варианты фона лежат в res/drawable/widget_bg_aXX.xml.
 */
final class WidgetStyle {

    private WidgetStyle() {}

    /** Drawable фона под текущую настройку прозрачности. */
    static int bgRes(Context ctx) {
        int opacity = WidgetStore.getWidgetOpacity(ctx);
        if (opacity <= 50) return R.drawable.widget_bg_a50;
        if (opacity <= 70) return R.drawable.widget_bg_a70;
        if (opacity <= 85) return R.drawable.widget_bg_a85;
        return R.drawable.widget_bg;
    }

    /** Подменить фон корня виджета (вызывать в конце сборки RemoteViews). */
    static RemoteViews apply(Context ctx, RemoteViews v, int rootId) {
        try {
            v.setInt(rootId, "setBackgroundResource", bgRes(ctx));
        } catch (Exception ignored) {
            /* фон — оформление, не повод ронять виджет */
        }
        return v;
    }
}
