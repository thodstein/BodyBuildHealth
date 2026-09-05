package com.healthengine.app;

import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import android.widget.Toast;

import com.healthengine.app.widgets.NutritionWidgetProvider;
import com.healthengine.app.widgets.WidgetStore;

import org.json.JSONObject;

/**
 * WaterTileService — Quick Settings Tile «💧 +250» (Android 7+, minSdk 24).
 *
 * Тап БЕЗ открытия приложения: кладёт 250 мл в ту же очередь WidgetStore,
 * что виджет/JS (разбирается при входе на Главную), обновляет виджет
 * питания и показывает тост. Тайл работает кнопкой: состояние всегда
 * INACTIVE, сабтайтл (API 29+) показывает размер очереди.
 */
public class WaterTileService extends TileService {

    private static final int ML = 250;

    @Override
    public void onTileAdded() {
        refresh();
    }

    @Override
    public void onStartListening() {
        refresh();
    }

    @Override
    public void onClick() {
        try {
            JSONObject item = new JSONObject();
            item.put("type", "water");
            item.put("ml", ML);
            item.put("ts", System.currentTimeMillis());
            WidgetStore.enqueue(this, item);
        } catch (Exception ignored) {}
        try {
            NutritionWidgetProvider.updateAll(this);
        } catch (Exception ignored) {}
        refresh();
        try {
            Toast.makeText(this, "💧 +250 мл — разберём на Главной", Toast.LENGTH_SHORT).show();
        } catch (Exception ignored) {}
    }

    /** Кнопка (не тоггл) + честный сабтайтл очереди. */
    private void refresh() {
        try {
            Tile tile = getQsTile();
            if (tile == null) return;
            tile.setState(Tile.STATE_INACTIVE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    int q = WidgetStore.queueSize(this);
                    tile.setSubtitle(q > 0 ? "в очереди: " + q : "тап — записать воду");
                } catch (Exception ignored) {}
            }
            tile.updateTile();
        } catch (Exception ignored) {}
    }
}
