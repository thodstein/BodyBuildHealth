package com.healthengine.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.healthengine.app.widgets.WidgetBridgePlugin;
import com.healthengine.app.widgets.WidgetStore;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        captureWidgetTarget(getIntent());
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
