package com.healthengine.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.healthengine.app.widgets.WidgetBridgePlugin;
import com.healthengine.app.widgets.WidgetStore;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        ensureNotificationChannels();
        captureWidgetTarget(getIntent());
    }

    /**
     * TOP: именованные каналы уведомлений (тренировки / вода / таймер).
     * LocalNotifications без каналов падает в общий шум; здесь у каждого
     * свой приоритет и описание. Только создание — отправка как раньше.
     */
    private void ensureNotificationChannels() {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            createChannel(nm, "he_training", "Тренировки",
                    "Напоминания о тренировках и планах", NotificationManager.IMPORTANCE_DEFAULT);
            createChannel(nm, "he_water", "Вода и питание",
                    "Напоминания о воде и приёмах пищи", NotificationManager.IMPORTANCE_DEFAULT);
            createChannel(nm, "he_timer", "Таймер отдыха",
                    "Сигналы таймера отдыха между подходами", NotificationManager.IMPORTANCE_HIGH);
        } catch (Exception ignored) {}
    }

    private void createChannel(NotificationManager nm, String id, String name, String desc, int importance) {
        try {
            if (nm.getNotificationChannel(id) != null) return;
            NotificationChannel ch = new NotificationChannel(id, name, importance);
            ch.setDescription(desc);
            nm.createNotificationChannel(ch);
        } catch (Exception ignored) {}
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureWidgetTarget(intent);
    }

    /** Тап по виджету -> one-shot target, JS забирает через WidgetBridge.getLaunchTarget(). */
    private void captureWidgetTarget(Intent intent) {
        try {
            if (intent == null) return;
            if (!WidgetStore.ACTION_OPEN.equals(intent.getAction())) return;
            String target = intent.getStringExtra(WidgetStore.EXTRA_TARGET);
            if (target != null && !target.isEmpty()) {
                WidgetStore.setLaunchTarget(this, target);
            }
        } catch (Exception ignored) {}
    }
}
