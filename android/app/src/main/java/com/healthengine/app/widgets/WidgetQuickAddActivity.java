package com.healthengine.app.widgets;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.healthengine.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * WidgetQuickAddActivity — компактный нативный редактор задачи/заметки,
 * который открывается кнопкой «＋» прямо с рабочего стола.
 *
 * Кроме задач и заметок умеет еду (виджет «Питание») и подход (виджет
 * «Проведение тренировки»): вес, повторы, RIR/RPE, техника, пауза, заметка.
 *
 * Почему отдельная Activity, а не поле в виджете: RemoteViews не поддерживает
 * EditText и ввод с клавиатуры. Эта Activity не запускает WebView и не
 * открывает основной интерфейс — только диалог поверх лаунчера. Сохранение
 * пишет элемент в общую очередь WidgetStore и сразу обновляет снапшот
 * (оптимистично), поэтому виджет меняется без входа в приложение. JS применит
 * очередь к he_coach_planner / he_coach_notes при следующем синке.
 */
public class WidgetQuickAddActivity extends Activity {

    public static final String EXTRA_KIND = "quick_kind";
    public static final String EXTRA_DATE = "quick_date";
    /** Подсказка приёма пищи для еды: Завтрак / Обед / Ужин / Перекус. */
    public static final String EXTRA_MEAL = "quick_meal";
    public static final String KIND_TASK = "task";
    public static final String KIND_NOTE = "note";
    public static final String KIND_FOOD = "food";
    /** Свой объём воды из виджета «Питание» (кнопка «Свой»): мл в поле порции. */
    public static final String KIND_WATER = "water";
    /** Подход из виджета «Проведение тренировки»: вес, повторы, RIR/RPE, техника. */
    public static final String KIND_SET = "set";
    public static final String ACTION_SET = "com.healthengine.app.action.WIDGET_SET";
    public static final String EXTRA_EXERCISE = "quick_exercise";
    public static final String EXTRA_WEIGHT = "quick_weight";
    public static final String EXTRA_REPS = "quick_reps";
    public static final String EXTRA_RIR = "quick_rir";
    public static final String EXTRA_SET_NUM = "quick_set_num";
    public static final String EXTRA_REST_SEC = "quick_rest_sec";

    private static final String[] MEALS = {"Завтрак", "Обед", "Ужин", "Перекус"};

    private static final Pattern TIME_RE = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final String[] MONTHS_GEN = {
            "января", "февраля", "марта", "апреля", "мая", "июня",
            "июля", "августа", "сентября", "октября", "ноября", "декабря"
    };
    private static final String[] WD_GEN = {
            "", "воскресенье", "понедельник", "вторник", "среда",
            "четверг", "пятница", "суббота"
    };

    private String kind = KIND_TASK;
    private String selectedDate = "";
    private String priority = "none";
    private String meal = "Перекус";
    private String exerciseName = "";
    private int setNumber = 0;
    private int restSec = 0;
    /** Оценка техники 3/4/5 (0 — не указана) и пауза на груди. */
    private int technique = 0;
    private boolean pause = false;

    private EditText titleEt;
    private EditText timeEt;
    private EditText checklistEt;
    private EditText kcalEt;
    private EditText proteinEt;
    private EditText fatEt;
    private EditText carbsEt;
    private EditText qtyEt;
    private EditText weightEt;
    private EditText repsEt;
    private EditText rirEt;
    private EditText rpeEt;
    private EditText setNoteEt;
    private EditText searchEt;
    private LinearLayout searchResults;
    private TextView qtyLabel;
    /**
     * КБЖУ выбранного из базы продукта **на 100 г**: по нему пересчитываем
     * значения, когда пользователь правит порцию. null — продукт не выбирали,
     * и трогать введённые руками цифры нельзя.
     */
    private JSONObject catalogPer100;
    /** true, пока поля заполняет код: вотчеры не должны считать это ручной правкой. */
    private boolean filling = false;
    private TextView dateLabel;
    private TextView dateToday;
    private TextView dateTomorrow;
    private TextView prioNone;
    private TextView prioMedium;
    private TextView prioHigh;
    private TextView mealBf;
    private TextView mealLunch;
    private TextView mealDinner;
    private TextView mealSnack;
    private TextView tech3;
    private TextView tech4;
    private TextView tech5;
    private TextView pauseChip;
    private TextView msg;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_widget_quick_add);

        try {
            Window w = getWindow();
            int width = (int) (getResources().getDisplayMetrics().widthPixels * 0.92f);
            w.setLayout(width, WindowManager.LayoutParams.WRAP_CONTENT);
            w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE
                    | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        } catch (Exception ignored) {}

        Intent intent = getIntent();
        String k = intent == null ? null : intent.getStringExtra(EXTRA_KIND);
        if (KIND_NOTE.equals(k)) kind = KIND_NOTE;
        else if (KIND_FOOD.equals(k)) kind = KIND_FOOD;
        else if (KIND_WATER.equals(k)) kind = KIND_WATER;
        else if (KIND_SET.equals(k)) kind = KIND_SET;
        else kind = KIND_TASK;
        String d = intent == null ? null : intent.getStringExtra(EXTRA_DATE);
        selectedDate = isIso(d) ? d : todayIso();
        String m = intent == null ? null : intent.getStringExtra(EXTRA_MEAL);
        meal = normalizeMeal(m);
        if (intent != null) {
            String ex = intent.getStringExtra(EXTRA_EXERCISE);
            exerciseName = ex == null ? "" : ex.trim();
            setNumber = Math.max(0, intent.getIntExtra(EXTRA_SET_NUM, 0));
            restSec = Math.max(0, intent.getIntExtra(EXTRA_REST_SEC, 0));
        }

        titleEt = findViewById(R.id.qa_title);
        timeEt = findViewById(R.id.qa_time);
        checklistEt = findViewById(R.id.qa_checklist);
        kcalEt = findViewById(R.id.qa_kcal);
        proteinEt = findViewById(R.id.qa_p);
        fatEt = findViewById(R.id.qa_f);
        carbsEt = findViewById(R.id.qa_c);
        qtyEt = findViewById(R.id.qa_qty);
        qtyLabel = findViewById(R.id.qa_qty_label);
        searchEt = findViewById(R.id.qa_search);
        searchResults = findViewById(R.id.qa_search_results);
        dateLabel = findViewById(R.id.qa_date_label);
        dateToday = findViewById(R.id.qa_date_today);
        dateTomorrow = findViewById(R.id.qa_date_tomorrow);
        prioNone = findViewById(R.id.qa_prio_none);
        prioMedium = findViewById(R.id.qa_prio_medium);
        prioHigh = findViewById(R.id.qa_prio_high);
        mealBf = findViewById(R.id.qa_meal_bf);
        mealLunch = findViewById(R.id.qa_meal_lunch);
        mealDinner = findViewById(R.id.qa_meal_dinner);
        mealSnack = findViewById(R.id.qa_meal_snack);
        msg = findViewById(R.id.qa_msg);
        weightEt = findViewById(R.id.qa_weight);
        repsEt = findViewById(R.id.qa_reps);
        rirEt = findViewById(R.id.qa_rir);
        rpeEt = findViewById(R.id.qa_rpe);
        setNoteEt = findViewById(R.id.qa_set_note);
        tech3 = findViewById(R.id.qa_tech3);
        tech4 = findViewById(R.id.qa_tech4);
        tech5 = findViewById(R.id.qa_tech5);
        pauseChip = findViewById(R.id.qa_pause);

        TextView titleLabel = findViewById(R.id.qa_title_label);
        View dateRow = findViewById(R.id.qa_date_row);
        View timeView = findViewById(R.id.qa_time);
        View priorityRow = findViewById(R.id.qa_priority_row);
        View checklistLabel = findViewById(R.id.qa_checklist_label);
        View foodRow = findViewById(R.id.qa_food_row);
        View qtyRow = findViewById(R.id.qa_qty_row);
        View mealLabel = findViewById(R.id.qa_meal_label);
        View mealRow = findViewById(R.id.qa_meal_row);
        View setRow = findViewById(R.id.qa_set_row);
        View setLabel = findViewById(R.id.qa_set_label);
        View techRow = findViewById(R.id.qa_tech_row);
        View searchRow = findViewById(R.id.qa_search_row);

        if (KIND_NOTE.equals(kind)) {
            titleLabel.setText("Новая заметка");
            titleEt.setHint("Заголовок заметки");
            checklistLabel.setVisibility(View.VISIBLE);
            checklistEt.setVisibility(View.VISIBLE);
            dateRow.setVisibility(View.GONE);
            timeView.setVisibility(View.GONE);
            priorityRow.setVisibility(View.GONE);
            dateLabel.setText("Заметка появится в «Заметках» и на виджете");
        } else if (KIND_FOOD.equals(kind)) {
            titleLabel.setText("Новая еда");
            titleEt.setHint("Что съели? (например, куриная грудка)");
            dateRow.setVisibility(View.GONE);
            timeView.setVisibility(View.GONE);
            priorityRow.setVisibility(View.GONE);
            foodRow.setVisibility(View.VISIBLE);
            qtyRow.setVisibility(View.VISIBLE);
            qtyLabel.setText("Порция, г");
            mealLabel.setVisibility(View.VISIBLE);
            mealRow.setVisibility(View.VISIBLE);
            wireFoodSearch(searchRow);
            dateLabel.setText("Порция сразу уйдёт в дневник за сегодня");
        } else if (KIND_WATER.equals(kind)) {
            // Свой объём воды: одно поле «мл» вместо названия и КБЖУ.
            titleLabel.setVisibility(View.GONE);
            titleEt.setVisibility(View.GONE);
            dateRow.setVisibility(View.GONE);
            timeView.setVisibility(View.GONE);
            priorityRow.setVisibility(View.GONE);
            checklistLabel.setVisibility(View.GONE);
            checklistEt.setVisibility(View.GONE);
            qtyRow.setVisibility(View.VISIBLE);
            qtyLabel.setText("Объём, мл");
            qtyEt.setHint("250");
            qtyEt.setText("250");
            qtyEt.selectAll();
            dateLabel.setText("Вода сразу уйдёт в дневник за сегодня");
        } else if (KIND_SET.equals(kind)) {
            titleLabel.setText(exerciseName.isEmpty() ? "Новый подход" : exerciseName);
            titleEt.setHint("Упражнение");
            if (!exerciseName.isEmpty()) titleEt.setText(exerciseName);
            dateRow.setVisibility(View.GONE);
            timeView.setVisibility(View.GONE);
            priorityRow.setVisibility(View.GONE);
            checklistLabel.setVisibility(View.GONE);
            checklistEt.setVisibility(View.GONE);
            setRow.setVisibility(View.VISIBLE);
            setLabel.setVisibility(View.VISIBLE);
            techRow.setVisibility(View.VISIBLE);
            setNoteEt.setVisibility(View.VISIBLE);
            if (intent != null) {
                weightEt.setText(safeExtra(intent, EXTRA_WEIGHT));
                repsEt.setText(safeExtra(intent, EXTRA_REPS));
                String rirText = safeExtra(intent, EXTRA_RIR);
                rirEt.setText(rirText);
                // RPE по умолчанию = 10 − RIR: в проведении тренировки он выводится так же.
                int rir0 = (int) Math.max(0, Math.min(20, parseDecimal(rirEt)));
                if (!rirText.isEmpty()) rpeEt.setText(String.valueOf(Math.max(0, 10 - rir0)));
            }
            String head = "Подход";
            if (setNumber > 0) head = head + " #" + setNumber;
            if (restSec > 0) head = head + " · отдых " + restSec + " с";
            dateLabel.setText(head + ": вес, повторы, RIR/RPE, техника");
        } else {
            titleLabel.setText("Новая задача");
            titleEt.setHint("Что сделать?");
            dateRow.setVisibility(View.VISIBLE);
            timeView.setVisibility(View.VISIBLE);
            priorityRow.setVisibility(View.VISIBLE);
        }

        dateToday.setOnClickListener(v -> selectDate(todayIso()));
        dateTomorrow.setOnClickListener(v -> selectDate(addDays(todayIso(), 1)));
        prioNone.setOnClickListener(v -> selectPriority("none"));
        prioMedium.setOnClickListener(v -> selectPriority("medium"));
        prioHigh.setOnClickListener(v -> selectPriority("high"));
        mealBf.setOnClickListener(v -> selectMeal("Завтрак"));
        mealLunch.setOnClickListener(v -> selectMeal("Обед"));
        mealDinner.setOnClickListener(v -> selectMeal("Ужин"));
        mealSnack.setOnClickListener(v -> selectMeal("Перекус"));
        tech3.setOnClickListener(v -> selectTechnique(technique == 3 ? 0 : 3));
        tech4.setOnClickListener(v -> selectTechnique(technique == 4 ? 0 : 4));
        tech5.setOnClickListener(v -> selectTechnique(technique == 5 ? 0 : 5));
        pauseChip.setOnClickListener(v -> {
            pause = !pause;
            updateTechniqueUi();
        });
        findViewById(R.id.qa_cancel).setOnClickListener(v -> finish());
        findViewById(R.id.qa_save).setOnClickListener(v -> save());

        updateDateUi();
        updatePriorityUi();
        updateMealUi();
        updateTechniqueUi();
        if (KIND_SET.equals(kind)) weightEt.requestFocus();
        else if (KIND_WATER.equals(kind)) qtyEt.requestFocus();
        else titleEt.requestFocus();
    }

    private static String safeExtra(Intent intent, String key) {
        String v = intent.getStringExtra(key);
        return v == null ? "" : v.trim();
    }

    private void selectTechnique(int value) {
        technique = value;
        updateTechniqueUi();
    }

    private void updateTechniqueUi() {
        styleChip(tech3, technique == 3);
        styleChip(tech4, technique == 4);
        styleChip(tech5, technique == 5);
        styleChip(pauseChip, pause);
    }

    private void selectMeal(String value) {
        meal = normalizeMeal(value);
        updateMealUi();
    }

    private void updateMealUi() {
        styleChip(mealBf, "Завтрак".equals(meal));
        styleChip(mealLunch, "Обед".equals(meal));
        styleChip(mealDinner, "Ужин".equals(meal));
        styleChip(mealSnack, "Перекус".equals(meal));
    }

    /** Английские ключи (breakfast/lunch/dinner/snack) из старых вызовов тоже понимаем. */
    static String normalizeMeal(String value) {
        if (value == null) return "Перекус";
        String v = value.trim();
        if ("breakfast".equalsIgnoreCase(v)) return "Завтрак";
        if ("lunch".equalsIgnoreCase(v)) return "Обед";
        if ("dinner".equalsIgnoreCase(v)) return "Ужин";
        for (String m : MEALS) {
            if (m.equalsIgnoreCase(v)) return m;
        }
        return "Перекус";
    }

    private void selectDate(String iso) {
        selectedDate = iso;
        updateDateUi();
    }

    private void updateDateUi() {
        String today = todayIso();
        String tomorrow = addDays(today, 1);
        styleChip(dateToday, selectedDate.equals(today));
        styleChip(dateTomorrow, selectedDate.equals(tomorrow));
        // У заметки и еды даты нет — подпись «Дата: …» их подсказку не перебивает.
        if (KIND_TASK.equals(kind)) {
            dateLabel.setText("Дата: " + formatDayLabel(selectedDate));
        }
    }

    private void selectPriority(String p) {
        priority = p;
        updatePriorityUi();
    }

    private void updatePriorityUi() {
        styleChip(prioNone, "none".equals(priority));
        styleChip(prioMedium, "medium".equals(priority));
        styleChip(prioHigh, "high".equals(priority));
    }

    private void styleChip(TextView v, boolean on) {
        if (v == null) return;
        v.setBackgroundResource(on ? R.drawable.widget_chip_on : R.drawable.widget_chip);
        v.setTextColor(on ? 0xFF07111F : 0xFFE2ECFF);
    }

    /**
     * Поиск по базе продуктов в редакторе еды. Каталог пишет JS один раз на
     * версию FOOD_DB (`WidgetStore.KEY_FOODS`), поэтому поиск работает офлайн и
     * не тянет WebView. Значения каталога — на 100 г, как в дневнике.
     */
    private void wireFoodSearch(View searchRow) {
        JSONArray catalog = loadFoodCatalog();
        if (catalog.length() == 0 || searchRow == null || searchResults == null) {
            if (searchRow != null) searchRow.setVisibility(View.GONE);
            return;
        }
        searchRow.setVisibility(View.VISIBLE);
        searchEt.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                renderSearchResults(s == null ? "" : s.toString(), catalog);
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });
        // Порция: значения из базы даны на 100 г, поэтому при смене веса
        // пересчитываем КБЖУ — иначе «200 г» остались бы с калориями за 100 г.
        qtyEt.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (!filling) scaleCatalogValues();
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });
        // Ручная правка калорий отменяет пересчёт: дальше цифры — свои,
        // и подставлять вместо них продукт из базы нельзя.
        kcalEt.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (!filling) catalogPer100 = null;
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });
    }

    private JSONArray loadFoodCatalog() {
        try {
            JSONObject raw = WidgetStore.getJson(this, WidgetStore.KEY_FOODS);
            JSONArray items = raw == null ? null : raw.optJSONArray("items");
            return items == null ? new JSONArray() : items;
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** Первые 4 совпадения по подстроке; тап заполняет название и КБЖУ порции. */
    private void renderSearchResults(String query, JSONArray catalog) {
        searchResults.removeAllViews();
        String q = query.trim().toLowerCase(Locale.ROOT);
        if (q.length() < 2) return;
        int shown = 0;
        for (int i = 0; i < catalog.length() && shown < 4; i++) {
            JSONObject f = catalog.optJSONObject(i);
            if (f == null) continue;
            String name = f.optString("n", "").trim();
            if (name.isEmpty() || !name.toLowerCase(Locale.ROOT).contains(q)) continue;
            shown++;
            TextView row = new TextView(this);
            int kcal = Math.max(0, f.optInt("k", 0));
            row.setText(name + "  ·  " + kcal + " ккал/100 г");
            row.setTextSize(12);
            row.setTextColor(0xFFE2ECFF);
            row.setBackgroundResource(R.drawable.widget_input_bg);
            row.setPadding(dp(10), dp(9), dp(10), dp(9));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.bottomMargin = dp(4);
            row.setLayoutParams(lp);
            row.setOnClickListener(v -> applyCatalogFood(f));
            searchResults.addView(row);
        }
    }

    /** Подставляем значения продукта на 100 г в поля порции. */
    private void applyCatalogFood(JSONObject f) {
        String name = f.optString("n", "").trim();
        // Пока заполняем поля кодом, вотчеры молчат: это не ручная правка.
        filling = true;
        catalogPer100 = null;
        try {
            if (!name.isEmpty()) titleEt.setText(name);
            kcalEt.setText(String.valueOf(Math.max(0, f.optInt("k", 0))));
            proteinEt.setText(String.valueOf(Math.max(0, f.optInt("p", 0))));
            fatEt.setText(String.valueOf(Math.max(0, f.optInt("f", 0))));
            carbsEt.setText(String.valueOf(Math.max(0, f.optInt("c", 0))));
            qtyEt.setText("100");
        } finally {
            filling = false;
        }
        // Дальше смена порции пересчитывает КБЖУ от этих значений на 100 г.
        catalogPer100 = f;
        searchResults.removeAllViews();
        if (searchEt != null) searchEt.setText("");
        Toast.makeText(this, "Значения на 100 г — укажите свою порцию", Toast.LENGTH_SHORT).show();
    }

    /** КБЖУ выбранного продукта под текущую порцию: kcal = per100 × г / 100. */
    private void scaleCatalogValues() {
        if (catalogPer100 == null) return;
        int grams = parseQty(qtyEt, 5000);
        if (grams <= 0) grams = 100;
        filling = true;
        try {
            kcalEt.setText(String.valueOf(scalePer100("k", grams, 5000)));
            proteinEt.setText(String.valueOf(scalePer100("p", grams, 500)));
            fatEt.setText(String.valueOf(scalePer100("f", grams, 500)));
            carbsEt.setText(String.valueOf(scalePer100("c", grams, 500)));
        } finally {
            filling = false;
        }
    }

    private int scalePer100(String key, int grams, int max) {
        int base = catalogPer100 == null ? 0 : Math.max(0, catalogPer100.optInt(key, 0));
        return Math.max(0, Math.min(max, Math.round(base * grams / 100f)));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void save() {
        long now = System.currentTimeMillis();
        if (KIND_WATER.equals(kind)) {
            try {
                if (saveWater(now)) finish();
            } catch (Exception e) {
                showError("Не удалось сохранить — попробуйте ещё раз");
            }
            return;
        }
        String title = titleEt.getText() == null ? "" : titleEt.getText().toString().trim();
        if (TextUtils.isEmpty(title)) {
            showError(KIND_NOTE.equals(kind) ? "Введите заголовок заметки"
                    : (KIND_FOOD.equals(kind) ? "Введите, что съели"
                    : (KIND_SET.equals(kind) ? "Введите упражнение" : "Введите задачу")));
            return;
        }
        // Лимиты совпадают с движком (140 у задачи, 120 у заметки и еды).
        int maxTitle = KIND_TASK.equals(kind) ? 140 : 120;
        if (title.length() > maxTitle) title = title.substring(0, maxTitle);
        String id = "w_" + (KIND_NOTE.equals(kind) ? "n_" : "t_") + now + "_" + (int) (Math.random() * 1000);

        try {
            boolean ok;
            if (KIND_SET.equals(kind)) {
                ok = saveSet(title, now);
            } else if (KIND_FOOD.equals(kind)) {
                ok = saveFood(title, now);
            } else if (KIND_NOTE.equals(kind)) {
                ok = saveNote(id, title, now);
            } else {
                ok = saveTask(id, title, now);
            }
            if (ok) finish();
        } catch (Exception e) {
            showError("Не удалось сохранить — попробуйте ещё раз");
        }
    }

    /** Еда из виджета «Питание»: запись в очередь `type=food` + оптимистичные круги. */
    private boolean saveFood(String name, long now) throws Exception {
        int kcal = parseQty(kcalEt, 5000);
        if (kcal <= 0) {
            showError("Укажите калорийность порции");
            return false;
        }
        int p = parseQty(proteinEt, 500);
        int f = parseQty(fatEt, 500);
        int c = parseQty(carbsEt, 500);
        // Пустая порция = 100 г: дневник без веса показывает «100 г» по умолчанию.
        int qty = parseQty(qtyEt, 5000);
        if (qty <= 0) qty = 100;
        JSONObject item = new JSONObject();
        item.put("type", "food");
        item.put("name", name);
        item.put("kcal", kcal);
        item.put("p", p);
        item.put("f", f);
        item.put("c", c);
        item.put("qty", qty);
        item.put("meal", meal);
        item.put("ts", now);
        WidgetStore.enqueue(this, item);
        NutritionWidgetProvider.optimisticFood(this, name, meal, kcal, p, f, c, qty);
        NutritionWidgetProvider.updateAll(this);
        Toast.makeText(this, "Добавлено: " + name, Toast.LENGTH_SHORT).show();
        return true;
    }

    /**
     * Свой объём воды из виджета «Питание»: очередь `type=water`, JS применит
     * её через `addWater`. Верхний предел — 2000 мл, как у кнопок на виджете.
     */
    private boolean saveWater(long now) throws Exception {
        int ml = parseQty(qtyEt, 2000);
        if (ml <= 0) {
            showError("Укажите объём в мл, например 300");
            return false;
        }
        JSONObject item = new JSONObject();
        item.put("type", "water");
        item.put("ml", ml);
        item.put("ts", now);
        WidgetStore.enqueue(this, item);
        NutritionWidgetProvider.optimisticWater(this, ml);
        NutritionWidgetProvider.updateAll(this);
        Toast.makeText(this, "Вода: " + ml + " мл", Toast.LENGTH_SHORT).show();
        return true;
    }

    /**
     * Подход из виджета «Проведение тренировки»: очередь `set_add` + оптимистичный
     * прогресс. JS запишет подход в живую сессию (или создаст её из плана дня).
     */
    private boolean saveSet(String name, long now) throws Exception {
        double weight = Math.max(0, Math.min(500, parseDecimal(weightEt)));
        if (weight <= 0) {
            showError("Укажите вес снаряда (для собственного веса — вес тела)");
            return false;
        }
        int reps = parseQty(repsEt, 100);
        if (reps <= 0) {
            showError("Укажите число повторений");
            return false;
        }
        int rir = parseQty(rirEt, 20);
        double rpeRaw = parseDecimal(rpeEt);
        double rpe = rpeRaw > 0 ? Math.min(10, rpeRaw) : Math.max(0, 10 - rir);

        JSONObject item = new JSONObject();
        item.put("type", "set_add");
        item.put("exerciseName", name);
        item.put("weight", weight);
        item.put("reps", reps);
        item.put("rpe", rpe);
        item.put("rir", rir);
        if (technique > 0) item.put("technique", technique);
        if (pause) item.put("pause", true);
        String note = setNoteEt.getText() == null ? "" : setNoteEt.getText().toString().trim();
        if (!note.isEmpty()) item.put("notes", note);
        item.put("ts", now);
        WidgetStore.enqueue(this, item);
        WorkoutWidgetProvider.optimisticSet(this, name, (int) Math.round(weight), reps);
        WorkoutWidgetProvider.updateAll(this);
        String w = weight == Math.floor(weight) ? String.valueOf((int) weight) : String.valueOf(weight);
        Toast.makeText(this, "Подход: " + w + " кг × " + reps, Toast.LENGTH_SHORT).show();
        return true;
    }

    private static double parseDecimal(EditText et) {
        try {
            String raw = et == null || et.getText() == null ? "" : et.getText().toString().trim();
            if (raw.isEmpty()) return 0;
            double v = Double.parseDouble(raw.replace(',', '.'));
            return Double.isFinite(v) ? v : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private static int parseQty(EditText et, int max) {
        try {
            String raw = et == null || et.getText() == null ? "" : et.getText().toString().trim();
            if (raw.isEmpty()) return 0;
            double val = Double.parseDouble(raw.replace(',', '.'));
            if (Double.isNaN(val) || val <= 0) return 0;
            return (int) Math.min(max, Math.round(val));
        } catch (Exception e) {
            return 0;
        }
    }

    private boolean saveTask(String id, String title, long now) throws Exception {
        String time = timeEt.getText() == null ? "" : timeEt.getText().toString().trim();
        if (!time.isEmpty() && !TIME_RE.matcher(time).matches()) {
            showError("Время в формате ЧЧ:ММ, например 18:00");
            return false;
        }
        JSONObject item = new JSONObject();
        item.put("type", "task_add");
        item.put("id", id);
        item.put("title", title);
        item.put("date", selectedDate);
        item.put("time", time);
        item.put("priority", priority);
        item.put("ts", now);
        WidgetStore.enqueue(this, item);
        CalendarWidgetProvider.optimisticTaskAdd(this, id, title, selectedDate, time, priority);
        CalendarWidgetProvider.updateAll(this);
        Toast.makeText(this, "Задача добавлена", Toast.LENGTH_SHORT).show();
        return true;
    }

    private boolean saveNote(String id, String title, long now) throws Exception {
        String raw = checklistEt.getText() == null ? "" : checklistEt.getText().toString();
        JSONArray checklist = new JSONArray();
        int n = 0;
        for (String line : raw.split("\\r?\\n")) {
            String text = line.trim();
            if (text.isEmpty()) continue;
            if (text.length() > 300) text = text.substring(0, 300);
            JSONObject item = new JSONObject();
            item.put("id", "c_" + (++n));
            item.put("text", text);
            item.put("done", false);
            checklist.put(item);
            if (n >= 100) break;
        }
        JSONObject item = new JSONObject();
        item.put("type", "note_add");
        item.put("id", id);
        item.put("title", title);
        item.put("body", "");
        item.put("checklist", checklist);
        item.put("ts", now);
        WidgetStore.enqueue(this, item);
        NotesWidgetProvider.optimisticNoteAdd(this, id, title, n);
        NotesWidgetProvider.updateAll(this);
        Toast.makeText(this, "Заметка добавлена", Toast.LENGTH_SHORT).show();
        return true;
    }

    private void showError(String text) {
        msg.setText(text);
        msg.setVisibility(View.VISIBLE);
    }

    private static String todayIso() {
        return iso(Calendar.getInstance());
    }

    private static String iso(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static String addDays(String isoDate, int days) {
        Calendar c = parseIso(isoDate);
        if (c == null) return isoDate;
        c.add(Calendar.DAY_OF_MONTH, days);
        return iso(c);
    }

    private static Calendar parseIso(String isoDate) {
        try {
            if (isoDate == null || !isoDate.matches("^\\d{4}-\\d{2}-\\d{2}$")) return null;
            String[] p = isoDate.split("-");
            Calendar c = Calendar.getInstance();
            c.clear();
            c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), 0, 0, 0);
            return c;
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isIso(String isoDate) {
        return parseIso(isoDate) != null;
    }

    private static String formatDayLabel(String isoDate) {
        Calendar c = parseIso(isoDate);
        if (c == null) return isoDate;
        return WD_GEN[c.get(Calendar.DAY_OF_WEEK)] + ", "
                + c.get(Calendar.DAY_OF_MONTH) + " " + MONTHS_GEN[c.get(Calendar.MONTH)];
    }
}
