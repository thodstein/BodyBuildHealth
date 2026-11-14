package com.healthengine.app.widgets;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
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
    public static final String KIND_TASK = "task";
    public static final String KIND_NOTE = "note";

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

    private EditText titleEt;
    private EditText timeEt;
    private EditText checklistEt;
    private TextView dateLabel;
    private TextView dateToday;
    private TextView dateTomorrow;
    private TextView prioNone;
    private TextView prioMedium;
    private TextView prioHigh;
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
        kind = KIND_NOTE.equals(k) ? KIND_NOTE : KIND_TASK;
        String d = intent == null ? null : intent.getStringExtra(EXTRA_DATE);
        selectedDate = isIso(d) ? d : todayIso();

        titleEt = findViewById(R.id.qa_title);
        timeEt = findViewById(R.id.qa_time);
        checklistEt = findViewById(R.id.qa_checklist);
        dateLabel = findViewById(R.id.qa_date_label);
        dateToday = findViewById(R.id.qa_date_today);
        dateTomorrow = findViewById(R.id.qa_date_tomorrow);
        prioNone = findViewById(R.id.qa_prio_none);
        prioMedium = findViewById(R.id.qa_prio_medium);
        prioHigh = findViewById(R.id.qa_prio_high);
        msg = findViewById(R.id.qa_msg);

        TextView titleLabel = findViewById(R.id.qa_title_label);
        View dateRow = findViewById(R.id.qa_date_row);
        View timeView = findViewById(R.id.qa_time);
        View priorityRow = findViewById(R.id.qa_priority_row);
        View checklistLabel = findViewById(R.id.qa_checklist_label);

        if (KIND_NOTE.equals(kind)) {
            titleLabel.setText("Новая заметка");
            titleEt.setHint("Заголовок заметки");
            checklistLabel.setVisibility(View.VISIBLE);
            checklistEt.setVisibility(View.VISIBLE);
            dateRow.setVisibility(View.GONE);
            timeView.setVisibility(View.GONE);
            priorityRow.setVisibility(View.GONE);
            dateLabel.setText("Заметка появится в «Заметках» и на виджете");
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
        findViewById(R.id.qa_cancel).setOnClickListener(v -> finish());
        findViewById(R.id.qa_save).setOnClickListener(v -> save());

        updateDateUi();
        updatePriorityUi();
        titleEt.requestFocus();
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
        // У заметки даты нет — подпись «Дата: …» не должна перебивать подсказку.
        if (!KIND_NOTE.equals(kind)) {
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

    private void save() {
        String title = titleEt.getText() == null ? "" : titleEt.getText().toString().trim();
        if (TextUtils.isEmpty(title)) {
            showError(KIND_NOTE.equals(kind) ? "Введите заголовок заметки" : "Введите задачу");
            return;
        }
        // Лимиты совпадают с движком (140 у задачи, 120 у заметки).
        int maxTitle = KIND_NOTE.equals(kind) ? 120 : 140;
        if (title.length() > maxTitle) title = title.substring(0, maxTitle);
        long now = System.currentTimeMillis();
        String id = "w_" + (KIND_NOTE.equals(kind) ? "n_" : "t_") + now + "_" + (int) (Math.random() * 1000);

        try {
            boolean ok;
            if (KIND_NOTE.equals(kind)) {
                ok = saveNote(id, title, now);
            } else {
                ok = saveTask(id, title, now);
            }
            if (ok) finish();
        } catch (Exception e) {
            showError("Не удалось сохранить — попробуйте ещё раз");
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
