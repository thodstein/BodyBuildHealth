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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Homescreen-виджет «Проведение тренировки».
 *
 * Показывает упражнения назначенной на сегодня сессии (живой или из плана
 * `he_pl_runtime`) и даёт записать подход прямо с рабочего стола: «＋» в строке
 * открывает {@link WidgetQuickAddActivity} с весом/повторами/RIR/RPE, техникой,
 * паузой и заметкой — тем же набором параметров, что и в проведении тренировки.
 *
 * «▶ Начать» / «✓ Завершить» работают без открытия приложения: кладут
 * `workout_start` / `workout_finish` в очередь, которую JS применяет при
 * следующем запуске. Снапшот при этом правится оптимистично, чтобы прогресс
 * был виден сразу.
 */
public class WorkoutWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_START = "com.healthengine.app.action.WIDGET_WORKOUT_START";
    public static final String ACTION_FINISH = "com.healthengine.app.action.WIDGET_WORKOUT_FINISH";

    private static final int C_TEXT = 0xFFE2ECFF;
    private static final int C_MUTED = 0xFF8FA3C4;
    private static final int C_ACCENT = 0xFFC9F73A;

    private static final int[] ROW_IDS = {
            R.id.w_wo_row1, R.id.w_wo_row2, R.id.w_wo_row3, R.id.w_wo_row4, R.id.w_wo_row5,
    };
    private static final int[] IDX_IDS = {
            R.id.w_wo_idx1, R.id.w_wo_idx2, R.id.w_wo_idx3, R.id.w_wo_idx4, R.id.w_wo_idx5,
    };
    private static final int[] NAME_IDS = {
            R.id.w_wo_name1, R.id.w_wo_name2, R.id.w_wo_name3, R.id.w_wo_name4, R.id.w_wo_name5,
    };
    private static final int[] PLAN_IDS = {
            R.id.w_wo_plan1, R.id.w_wo_plan2, R.id.w_wo_plan3, R.id.w_wo_plan4, R.id.w_wo_plan5,
    };
    private static final int[] DONE_IDS = {
            R.id.w_wo_done1, R.id.w_wo_done2, R.id.w_wo_done3, R.id.w_wo_done4, R.id.w_wo_done5,
    };
    private static final int[] ADD_IDS = {
            R.id.w_wo_add1, R.id.w_wo_add2, R.id.w_wo_add3, R.id.w_wo_add4, R.id.w_wo_add5,
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        updateAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        try {
            if (intent == null) return;
            String action = intent.getAction();
            if (ACTION_START.equals(action)) {
                JSONObject item = new JSONObject();
                item.put("type", "workout_start");
                item.put("ts", System.currentTimeMillis());
                WidgetStore.enqueue(context, item);
                optimisticStart(context);
                updateAll(context);
            } else if (ACTION_FINISH.equals(action)) {
                JSONObject item = new JSONObject();
                item.put("type", "workout_finish");
                item.put("ts", System.currentTimeMillis());
                WidgetStore.enqueue(context, item);
                optimisticFinish(context);
                updateAll(context);
            }
        } catch (Exception ignored) {}
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName cn = new ComponentName(context, WorkoutWidgetProvider.class);
            int[] ids = mgr.getAppWidgetIds(cn);
            for (int id : ids) {
                mgr.updateAppWidget(id, build(context));
            }
        } catch (Exception ignored) {}
    }

    /** Сессия запущена: до синка с JS показываем «идёт». */
    static void optimisticStart(Context context) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_WORKOUT);
            d.put("live", true);
            d.put("startedAt", new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date()));
            String title = d.optString("title", "");
            if (!title.startsWith("● ")) d.put("title", "● " + title.replace("✓ ", "").trim());
            WidgetStore.putJson(context, WidgetStore.KEY_WORKOUT, d);
        } catch (Exception ignored) {}
    }

    /** Сессия завершена: до синка показываем отметку, а не «идёт». */
    static void optimisticFinish(Context context) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_WORKOUT);
            d.put("live", false);
            d.put("title", "✓ " + d.optString("title", "").replace("● ", "").replace("✓ ", "").trim());
            // Не обещаем "сохранена": сессию закрывает и записывает плеер, до синка
            // подписываем ожидание (иначе подходы окажутся на момент, когда их ещё нет).
            d.put("subtitle", "Ждём синк с плеера…");
            WidgetStore.putJson(context, WidgetStore.KEY_WORKOUT, d);
        } catch (Exception ignored) {}
    }

    /**
     * Подход записан с виджета: инкремент прогресса и объёма до синка с JS.
     * Возврат объёма — weight × reps, как в журнале тренировок.
     */
    static void optimisticSet(Context context, String exerciseName, int weight, int reps) {
        try {
            JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_WORKOUT);
            JSONArray list = d.optJSONArray("exercises");
            if (list != null) {
                for (int i = 0; i < list.length(); i++) {
                    JSONObject ex = list.optJSONObject(i);
                    if (ex == null) continue;
                    if (!exerciseName.equals(ex.optString("name", ""))) continue;
                    ex.put("done", Math.max(0, ex.optInt("done", 0)) + 1);
                    ex.put("weight", Math.max(0, weight));
                    ex.put("reps", Math.max(0, reps));
                    list.put(i, ex);
                    break;
                }
                d.put("exercises", list);
            }
            int done = Math.max(0, d.optInt("setsDone", 0)) + 1;
            int planned = Math.max(0, d.optInt("setsPlanned", 0));
            d.put("setsDone", done);
            d.put("volumeKg", Math.max(0, d.optInt("volumeKg", 0)) + Math.max(0, weight) * Math.max(0, reps));
            d.put("progress", planned > 0 ? Math.min(100, Math.round(done * 100f / planned)) : 100);
            WidgetStore.putJson(context, WidgetStore.KEY_WORKOUT, d);
        } catch (Exception ignored) {}
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_workout);
        JSONObject d = WidgetStore.getJson(context, WidgetStore.KEY_WORKOUT);

        String title = d.optString("title", "");
        String subtitle = d.optString("subtitle", "");
        boolean live = d.optBoolean("live", false);
        String startedAt = d.optString("startedAt", "");
        int setsDone = Math.max(0, d.optInt("setsDone", 0));
        int setsPlanned = Math.max(0, d.optInt("setsPlanned", 0));
        int volumeKg = Math.max(0, d.optInt("volumeKg", 0));
        int progress = Math.max(0, Math.min(100, d.optInt("progress", 0)));
        JSONArray exercises = d.optJSONArray("exercises");

        // Живая сессия: подпись считаем здесь, чтобы оптимистичные правки
        // (старт/подход) были видны без синка из WebView.
        String subLine;
        if (live) {
            subLine = setsDone + "/" + setsPlanned + " подх. · " + NutritionWidgetProvider.formatNum(volumeKg) + " кг";
        } else if (!subtitle.isEmpty()) {
            subLine = subtitle;
        } else {
            subLine = title.isEmpty() ? "Откройте план тренировок" : "План дня";
        }
        if (title.isEmpty()) {
            title = "Тренировка";
        }
        v.setTextViewText(R.id.w_wo_title, title);
        v.setTextViewText(R.id.w_wo_sub, subLine);
        v.setTextColor(R.id.w_wo_sub, live ? C_ACCENT : C_TEXT);
        v.setProgressBar(R.id.w_wo_progress, 100, progress, false);

        if (live && !startedAt.isEmpty()) {
            v.setTextViewText(R.id.w_wo_stamp, "с " + startedAt);
        } else {
            v.setTextViewText(R.id.w_wo_stamp, setsPlanned > 0 ? setsPlanned + " подх." : "");
        }

        int count = exercises == null ? 0 : exercises.length();
        v.setViewVisibility(R.id.w_wo_empty, count == 0 ? View.VISIBLE : View.GONE);
        if (count == 0) {
            v.setTextViewText(R.id.w_wo_empty,
                    title.startsWith("✓") ? "Готово к следующей тренировке" : "План не найден — откройте Тренировку");
        }

        for (int i = 0; i < ROW_IDS.length; i++) {
            if (i >= count) {
                v.setViewVisibility(ROW_IDS[i], View.GONE);
                continue;
            }
            JSONObject ex = exercises.optJSONObject(i);
            if (ex == null) {
                v.setViewVisibility(ROW_IDS[i], View.GONE);
                continue;
            }
            v.setViewVisibility(ROW_IDS[i], View.VISIBLE);
            String name = ex.optString("name", "Упражнение");
            String plan = ex.optString("plan", "");
            int done = Math.max(0, ex.optInt("done", 0));
            int planned = Math.max(0, ex.optInt("planned", 0));

            v.setTextViewText(IDX_IDS[i], String.valueOf(i + 1));
            v.setTextViewText(NAME_IDS[i], name);
            v.setTextViewText(PLAN_IDS[i], plan.isEmpty() ? " " : plan);
            v.setTextViewText(DONE_IDS[i], planned > 0 ? (done + "/" + planned) : String.valueOf(done));
            v.setTextColor(DONE_IDS[i], planned > 0 && done >= planned ? C_ACCENT : C_MUTED);

            int weight = Math.max(0, ex.optInt("weight", 0));
            int reps = Math.max(0, ex.optInt("reps", 0));
            int restSec = Math.max(0, ex.optInt("restSec", 0));
            // «＋» в строке: нативный редактор подхода с подстановкой плана.
            Intent setIntent = new Intent(context, WidgetQuickAddActivity.class);
            setIntent.setAction(WidgetQuickAddActivity.ACTION_SET);
            setIntent.putExtra(WidgetQuickAddActivity.EXTRA_KIND, WidgetQuickAddActivity.KIND_SET);
            setIntent.putExtra(WidgetQuickAddActivity.EXTRA_EXERCISE, name);
            setIntent.putExtra(WidgetQuickAddActivity.EXTRA_WEIGHT, weight > 0 ? String.valueOf(weight) : "");
            setIntent.putExtra(WidgetQuickAddActivity.EXTRA_REPS, reps > 0 ? String.valueOf(reps) : "");
            // RIR кладём только если он назначен (шкала 0…10): нет поля/оно null —
            // extra не пишем, и WidgetQuickAddActivity.safeExtra вернёт "", а не «0».
            if (ex.has("rir") && !ex.isNull("rir")) {
                int rir = Math.max(0, Math.min(10, ex.optInt("rir", 0)));
                setIntent.putExtra(WidgetQuickAddActivity.EXTRA_RIR, String.valueOf(rir));
            }
            setIntent.putExtra(WidgetQuickAddActivity.EXTRA_SET_NUM, done + 1);
            setIntent.putExtra(WidgetQuickAddActivity.EXTRA_REST_SEC, restSec);
            setIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            v.setOnClickPendingIntent(ADD_IDS[i], PendingIntent.getActivity(
                    context, 90 + i, setIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            // Тап по строке — открыть проведение в приложении.
            v.setOnClickPendingIntent(ROW_IDS[i], TrainingWidgetProvider.openApp(
                    context, WidgetStore.TARGET_TRAINING_RUN, 96 + i));
        }

        // «▶ Начать» / «✓ Завершить» — без открытия приложения.
        v.setTextViewText(R.id.w_wo_action, live ? "✓ Завершить" : "▶ Начать");
        v.setTextColor(R.id.w_wo_action, live ? C_TEXT : C_ACCENT);
        Intent action = new Intent(context, WorkoutWidgetProvider.class);
        action.setAction(live ? ACTION_FINISH : ACTION_START);
        v.setOnClickPendingIntent(R.id.w_wo_action, PendingIntent.getBroadcast(
                context, 81, action,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        v.setOnClickPendingIntent(R.id.w_wo_open,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_TRAINING_RUN, 82));
        v.setOnClickPendingIntent(R.id.w_wo_root,
                TrainingWidgetProvider.openApp(context, WidgetStore.TARGET_TRAINING, 83));

        String a11y = "Проведение тренировки: " + title + ", "
                + setsDone + " из " + setsPlanned + " подходов";
        if (count > 0 && exercises != null) {
            JSONObject first = exercises.optJSONObject(0);
            if (first != null) a11y = a11y + ", первое упражнение " + first.optString("name", "");
        }
        v.setContentDescription(R.id.w_wo_root, a11y);
        return WidgetStyle.apply(context, v, R.id.w_wo_root);
    }
}
