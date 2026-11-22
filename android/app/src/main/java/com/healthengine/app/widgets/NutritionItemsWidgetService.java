package com.healthengine.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import com.healthengine.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Список позиций дня на виджете «Питание».
 *
 * Строки скроллятся (обычный RemoteViews такое не умеет), «✕» удаляет запись
 * broadcast-ом с адресом `date + meal + index` — тем же, что лежит в снапшоте.
 * Список читает тот же `WidgetStore.KEY_NUTRITION`, поэтому данные и удаление
 * не расходятся: виджет и сервис видят одну и ту же копию дня.
 */
public class NutritionItemsWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        int widgetId = intent == null
                ? AppWidgetManager.INVALID_APPWIDGET_ID
                : intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        return new ItemsFactory(getApplicationContext(), widgetId);
    }

    private static final class ItemsFactory implements RemoteViewsFactory {

        private final Context ctx;
        private final int widgetId;
        private JSONArray items = new JSONArray();
        private String date = "";

        ItemsFactory(Context ctx, int widgetId) {
            this.ctx = ctx;
            this.widgetId = widgetId;
        }

        @Override
        public void onCreate() {
            /* пусто — данные подтянет onDataSetChanged */
        }

        @Override
        public void onDataSetChanged() {
            try {
                JSONObject d = WidgetStore.getJson(ctx, WidgetStore.KEY_NUTRITION);
                date = NutritionWidgetProvider.dayIso(
                        WidgetStore.getNutritionDayOffset(ctx, widgetId));
                JSONObject days = d.optJSONObject("days");
                JSONObject day = days == null || date.isEmpty() ? null : days.optJSONObject(date);
                JSONArray list = day == null ? null : day.optJSONArray("items");
                items = list == null ? new JSONArray() : list;
            } catch (Exception e) {
                items = new JSONArray();
            }
        }

        @Override
        public void onDestroy() {
            items = new JSONArray();
        }

        @Override
        public int getCount() {
            return items.length();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            JSONObject it = items.optJSONObject(position);
            if (it == null) return null;
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_nutrition_item);

            String name = it.optString("name", "");
            int kcal = Math.max(0, it.optInt("kcal", 0));
            int qty = Math.max(0, it.optInt("qty", 0));
            String meal = it.optString("meal", "");
            int index = it.optInt("index", -1);

            v.setTextViewText(R.id.w_nut_item_name, NutritionWidgetProvider.clipText(name, 18));
            // Порция в строке — как в дневнике («150 г · 248 ккал»). Раньше вес
            // был только в TalkBack: в списке не было видно, сколько добавлено.
            String amount = qty > 0
                    ? (kcal > 0 ? qty + " г · " + kcal + " ккал" : qty + " г")
                    : (kcal > 0 ? kcal + " ккал" : "");
            v.setTextViewText(R.id.w_nut_item_kcal, amount);

            // TalkBack: строка читается цельной фразой, а не «название, цифра, ✕».
            StringBuilder row = new StringBuilder(name);
            if (qty > 0) row.append(", ").append(qty).append(" г");
            if (kcal > 0) row.append(", ").append(kcal).append(" ккал");
            if (!meal.isEmpty()) row.append(", ").append(meal);
            v.setContentDescription(R.id.w_nut_item_root, row.toString() + ". Изменить порцию");

            // Тап по строке — правка порции: тот же нативный редактор, только
            // запись уже есть в дневнике (адрес уходит в extras). «✕» остаётся
            // отдельной кнопкой: случайное касание строки ничего не удаляет.
            Intent edit = new Intent(ctx, WidgetQuickAddActivity.class);
            edit.setAction("com.healthengine.app.action.WIDGET_FOOD_EDIT");
            edit.putExtra(WidgetQuickAddActivity.EXTRA_KIND, WidgetQuickAddActivity.KIND_FOOD);
            edit.putExtra(WidgetQuickAddActivity.EXTRA_EDIT, true);
            edit.putExtra(WidgetQuickAddActivity.EXTRA_DATE, date);
            edit.putExtra(WidgetQuickAddActivity.EXTRA_MEAL, meal);
            edit.putExtra(WidgetQuickAddActivity.EXTRA_ITEM_INDEX, index);
            edit.putExtra(WidgetQuickAddActivity.EXTRA_QTY, qty > 0 ? qty : 100);
            edit.putExtra(WidgetQuickAddActivity.EXTRA_NAME, name);
            edit.putExtra(WidgetQuickAddActivity.EXTRA_KCAL, kcal);
            edit.putExtra(WidgetQuickAddActivity.EXTRA_P, Math.max(0, it.optInt("p", 0)));
            edit.putExtra(WidgetQuickAddActivity.EXTRA_F, Math.max(0, it.optInt("f", 0)));
            edit.putExtra(WidgetQuickAddActivity.EXTRA_C, Math.max(0, it.optInt("c", 0)));
            edit.putExtra(WidgetQuickAddActivity.EXTRA_FOOD_ID, it.optString("foodId", ""));
            edit.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            edit.setData(Uri.parse("he://nut-edit/" + widgetId + "/" + position));
            v.setOnClickPendingIntent(R.id.w_nut_item_root,
                    PendingIntent.getActivity(ctx, widgetId * 100 + position, edit,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

            Intent del = new Intent(ctx, NutritionWidgetProvider.class);
            del.setAction(NutritionWidgetProvider.ACTION_ITEM_DEL);
            del.putExtra(NutritionWidgetProvider.EXTRA_WIDGET_ID, widgetId);
            del.putExtra(NutritionWidgetProvider.EXTRA_DATE, date);
            del.putExtra(NutritionWidgetProvider.EXTRA_MEAL, meal);
            del.putExtra(NutritionWidgetProvider.EXTRA_INDEX, index);
            // data делает Intent уникальным: PendingIntent сравниваются без
            // extras, и без data «✕» всех строк срабатывал бы как у первой.
            // Приём кодируем: имя своего приёма может содержать пробел или «/»,
            // и тогда две строки получили бы одинаковый data.
            del.setData(Uri.parse("he://nut-item/" + widgetId + "/" + Uri.encode(meal) + "/" + index));
            PendingIntent pi = PendingIntent.getBroadcast(ctx,
                    widgetId * 100 + position, del,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_nut_item_del, pi);
            v.setContentDescription(R.id.w_nut_item_del, "Удалить: " + name);
            return v;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
