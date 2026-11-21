package com.healthengine.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Locale;

/**
 * HeSpeechPlugin — системные распознавание речи и синтез для заметок.
 *
 * Зачем: в Android WebView нет webkitSpeechRecognition, а speechSynthesis
 * часто пуст. Без этого «голос в текст» и «озвучить» в APK были бы кнопками
 * с сообщением «недоступно». Здесь — штатные SpeechRecognizer и TextToSpeech.
 *
 * Честность: capabilities() отвечает тем, что реально есть на устройстве
 * (движок TTS инициализируется с таймаутом 700 мс). Если движка нет —
 * recognition/synthesis = false, а JS-сторона говорит об этом словами.
 *
 * ВНИМАНИЕ: внутри javadoc нельзя писать звездочка-слэш (закрывает комментарий).
 *
 * Разрешение микрофона спрашиваем сами через ActivityCompat, а не через
 * Capacitor-алиасы: если механизм алиасов почему-то не срабатывает, PluginCall
 * остаётся без ответа навсегда, и в UI вечно висит «Запрашиваю доступ». Здесь
 * на каждый путь есть ответ — окно, отказ или таймаут с причиной.
 */
@CapacitorPlugin(name = "HeSpeech")
public class HeSpeechPlugin extends Plugin {

    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private boolean ttsInitStarted = false;
    private PluginCall pendingCaps;
    private int capsToken = 0;
    private final Handler main = new Handler(Looper.getMainLooper());

    /* ── Состояние диктовки ────────────────────────────────────────────── */
    // Android-распознаватель одноразовый: после паузы или распознанной фразы
    // он завершается. Пока человек не нажал «Стоп», перезапускаем его сами —
    // иначе «Слушаю» тихо превращалось бы в «ничего не происходит».
    private volatile boolean continuous = false;
    private Intent lastIntent;
    private Listener listener;
    private boolean heardSomething = false;
    private int silentRounds = 0;
    private volatile boolean stopping = false;
    /** Три пустых круга подряд — движок молчит; честно выходим, не крутимся вечно. */
    private static final int MAX_SILENT_ROUNDS = 3;

    /* ── Разрешение микрофона ──────────────────────────────────────────── */
    private static final int MIC_REQUEST_CODE = 0x4D49; // 'MI' — только наш код
    private static final String PERMISSION_PREFS = "he_speech";
    private static final String ASKED_KEY = "mic_asked";
    /**
     * Сколько ждём ответа на системное окно. Таймаут нужен потому, что на части
     * прошивок окно не появляется вообще (политика устройства, «не спрашивать
     * снова»), и без предела ожидание повисло бы навсегда.
     */
    private static final long MIC_RESULT_TIMEOUT_MS = 12_000;
    /** Экземпляр для MainActivity: результат разрешения приходит в активити. */
    private static volatile HeSpeechPlugin current;
    private PluginCall pendingMicCall;
    private Runnable micWatchdog;

    /* ── Возможности платформы ─────────────────────────────────────────── */

    @PluginMethod
    public void capabilities(PluginCall call) {
        ensureTts();
        if (ttsReady) {
            resolveCaps(call);
            return;
        }
        // Движок TTS поднимается асинхронно: даём ему 700 мс, потом отвечаем
        // правдой (false), а не обещанием.
        pendingCaps = call;
        final int token = ++capsToken;
        main.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (token != capsToken) return; // ответ уже дали из onInit
                PluginCall waiting = pendingCaps;
                pendingCaps = null;
                if (waiting != null) resolveCaps(waiting);
            }
        }, 700);
    }

    private void resolveCaps(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("recognition", isRecognitionAvailable());
        ret.put("synthesis", ttsReady);
        call.resolve(ret);
    }

    private boolean isRecognitionAvailable() {
        try {
            return SpeechRecognizer.isRecognitionAvailable(getContext());
        } catch (Exception e) {
            return false;
        }
    }

    /* ── Речь в текст ──────────────────────────────────────────────────── */

    @Override
    public void load() {
        current = this;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PERMISSION_PREFS, Context.MODE_PRIVATE);
    }

    private boolean micGranted() {
        try {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
        } catch (Exception e) {
            return false;
        }
    }

    /** Android готов снова показать окно (отказ был, но не «навсегда»). */
    private boolean canPromptMic() {
        try {
            Activity activity = getActivity();
            return activity != null
                && ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.RECORD_AUDIO);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * granted — можно слушать; prompt — окно ещё покажут; blocked — Android его
     * больше не показывает, спасают только настройки приложения.
     */
    private String micStateName() {
        if (micGranted()) return "granted";
        if (canPromptMic()) return "prompt";
        return prefs().getBoolean(ASKED_KEY, false) ? "blocked" : "prompt";
    }

    /** Открыть «Настройки → Приложения → это приложение»: единственный путь при blocked. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            ret.put("opened", true);
        } catch (Exception e) {
            ret.put("opened", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void startRecognition(PluginCall call) {
        if (micGranted()) {
            startListening(call.getString("lang", "ru-RU"), call);
            return;
        }
        // Окно уже не покажут — не заставляем ждать 12 секунд впустую.
        if ("blocked".equals(micStateName())) {
            rejectStart(call, "permission-blocked");
            return;
        }
        askMicPermission(call);
    }

    /**
     * Системный запрос RECORD_AUDIO. Ответ приходит в MainActivity, а та
     * передаёт его в deliverPermissionResult — то есть мост получает ответ
     * всегда: разрешено, отказано или таймаут.
     */
    private void askMicPermission(final PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            rejectStart(call, "no-activity");
            return;
        }
        // Предыдущее ожидание не оставляем без ответа: пусть честно закроется.
        PluginCall previous = pendingMicCall;
        releaseMicWait();
        if (previous != null) rejectStart(previous, "superseded");
        pendingMicCall = call;
        micWatchdog = new Runnable() {
            @Override
            public void run() {
                PluginCall waiting = pendingMicCall;
                releaseMicWait();
                if (waiting != null) rejectStart(waiting, "permission-timeout");
            }
        };
        main.postDelayed(micWatchdog, MIC_RESULT_TIMEOUT_MS);
        main.post(new Runnable() {
            @Override
            public void run() {
                try {
                    prefs().edit().putBoolean(ASKED_KEY, true).apply();
                    ActivityCompat.requestPermissions(
                        activity,
                        new String[] { Manifest.permission.RECORD_AUDIO },
                        MIC_REQUEST_CODE
                    );
                } catch (Exception e) {
                    PluginCall waiting = pendingMicCall;
                    releaseMicWait();
                    if (waiting != null) rejectStart(waiting, "permission-request-failed");
                }
            }
        });
    }

    private void releaseMicWait() {
        if (micWatchdog != null) {
            main.removeCallbacks(micWatchdog);
            micWatchdog = null;
        }
        pendingMicCall = null;
    }

    /** Результат системного окна (из MainActivity). */
    void handleMicResult(boolean granted) {
        PluginCall waiting = pendingMicCall;
        releaseMicWait();
        if (waiting == null) return;
        if (granted) {
            startListening(waiting.getString("lang", "ru-RU"), waiting);
            return;
        }
        rejectStart(waiting, canPromptMic() ? "no-permission" : "permission-blocked");
    }

    /** Точка входа из MainActivity.onRequestPermissionsResult. */
    static void deliverPermissionResult(int requestCode, int[] grantResults) {
        HeSpeechPlugin plugin = current;
        if (plugin == null || requestCode != MIC_REQUEST_CODE) return;
        boolean granted = grantResults != null
            && grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        plugin.handleMicResult(granted);
    }

    private void rejectStart(PluginCall call, final String reason) {
        JSObject ret = new JSObject();
        ret.put("started", false);
        ret.put("reason", reason);
        call.resolve(ret);
    }

    private void startListening(final String lang, final PluginCall call) {
        main.post(new Runnable() {
            @Override
            public void run() {
                try {
                    if (!isRecognitionAvailable()) {
                        rejectStart(call, "not-available");
                        return;
                    }
                    // Разрешение могли отозвать между стартом и запуском движка:
                    // без проверки SpeechRecognizer упал бы SecurityException.
                    if (!micGranted()) {
                        rejectStart(call, "no-permission");
                        return;
                    }
                    stopListeningInternal();
                    recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                    listener = new Listener();
                    recognizer.setRecognitionListener(listener);

                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
                    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

                    lastIntent = intent;
                    continuous = true;
                    stopping = false;
                    heardSomething = false;
                    silentRounds = 0;
                    recognizer.startListening(intent);

                    JSObject ret = new JSObject();
                    ret.put("started", true);
                    call.resolve(ret);
                } catch (SecurityException e) {
                    continuous = false;
                    lastIntent = null;
                    rejectStart(call, "no-permission");
                } catch (Exception e) {
                    continuous = false;
                    lastIntent = null;
                    rejectStart(call, "start-failed");
                }
            }
        });
    }

    @PluginMethod
    public void stopRecognition(final PluginCall call) {
        main.post(new Runnable() {
            @Override
            public void run() {
                // Ждём системное окно, а человек уже нажал «Стоп»: отпускаем
                // ожидание, иначе «Запрашиваю доступ…» висело бы до таймаута.
                PluginCall waiting = pendingMicCall;
                releaseMicWait();
                if (waiting != null) rejectStart(waiting, "cancelled");
                stopListeningInternal();
                call.resolve();
            }
        });
    }

    /**
     * Завершить слушание и выбросить распознаватель.
     *
     * `cancel()` присылает `onError(ERROR_CLIENT)` — это наша же остановка, а не
     * сбой. Поэтому слушатель помечается мёртвым: ни ошибка отмены, ни поздние
     * события старого экземпляра наружу не уходят (иначе «Стоп» показывал бы
     * красную ошибку, а новая сессия получала бы чужие события).
     */
    private void stopListeningInternal() {
        continuous = false;
        lastIntent = null;
        silentRounds = 0;
        heardSomething = false;
        if (listener != null) {
            listener.dead = true;
            listener = null;
        }
        if (recognizer == null) return;
        try {
            recognizer.stopListening();
            recognizer.cancel();
            recognizer.destroy();
        } catch (Exception ignored) {
        } finally {
            recognizer = null;
        }
    }

    /**
     * Перезапуск слушания после паузы или распознанной фразы: системный
     * распознаватель одноразовый, а диктовка в UI — «пока не нажали Стоп».
     * false — перезапустить нечем (сессия уже закрыта).
     */
    private boolean restartListening(long delayMs) {
        if (recognizer == null || lastIntent == null) return false;
        heardSomething = false;
        main.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!continuous || recognizer == null || lastIntent == null) return;
                try {
                    recognizer.startListening(lastIntent);
                } catch (Exception e) {
                    JSObject data = new JSObject();
                    data.put("code", "start-failed");
                    notifyListeners("recognitionError", data);
                    stopListeningInternal();
                    notifyListeners("recognitionEnd", new JSObject());
                }
            }
        }, delayMs);
        return true;
    }

    private void emitResult(Bundle bundle, boolean isFinal) {
        if (bundle == null) return;
        ArrayList<String> list = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (list == null || list.isEmpty()) return;
        String text = list.get(0);
        if (text == null || text.trim().isEmpty()) return;
        JSObject data = new JSObject();
        data.put("text", text.trim());
        data.put("final", isFinal);
        notifyListeners("recognitionText", data);
    }

    private class Listener implements RecognitionListener {
        /** Экземпляр отменён/уничтожен: его события больше не наши. */
        volatile boolean dead = false;

        @Override
        public void onReadyForSpeech(Bundle params) {
        }

        @Override
        public void onBeginningOfSpeech() {
            heardSomething = true;
        }

        @Override
        public void onRmsChanged(float rmsdB) {
        }

        @Override
        public void onBufferReceived(byte[] buffer) {
        }

        @Override
        public void onEndOfSpeech() {
        }

        @Override
        public void onError(int error) {
            if (dead) return;
            // Пауза или тишина — не конец диктовки: перезапускаем, пока человек не
            // нажал «Стоп». Три пустых круга подряд — движок просто молчит.
            if (continuous
                    && (error == SpeechRecognizer.ERROR_NO_MATCH
                        || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) {
                if (heardSomething) {
                    silentRounds = 0;
                } else {
                    silentRounds += 1;
                }
                if (silentRounds < MAX_SILENT_ROUNDS && restartListening(250)) return;
            }
            String code;
            if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                code = "no-permission";
            } else if (error == 12 || error == 13) {
                // ERROR_LANGUAGE_NOT_SUPPORTED / ERROR_LANGUAGE_UNAVAILABLE (API 33+
                // константы, но числа стабильны — не тянем зависимость от SDK).
                code = "not-available";
            } else {
                code = "error-" + error;
            }
            JSObject data = new JSObject();
            data.put("code", code);
            notifyListeners("recognitionError", data);
            stopListeningInternal();
            notifyListeners("recognitionEnd", new JSObject());
        }

        @Override
        public void onResults(Bundle results) {
            if (dead) return;
            emitResult(results, true);
            // Одна фраза — не конец диктовки: продолжаем, пока сессия открыта.
            if (continuous && restartListening(200)) return;
            stopListeningInternal();
            notifyListeners("recognitionEnd", new JSObject());
        }

        @Override
        public void onPartialResults(Bundle partialResults) {
            if (dead) return;
            heardSomething = true;
            emitResult(partialResults, false);
        }

        @Override
        public void onEvent(int eventType, Bundle params) {
        }
    }

    /* ── Текст в речь ──────────────────────────────────────────────────── */

    private void ensureTts() {
        if (tts != null || ttsInitStarted) return;
        ttsInitStarted = true;
        try {
            tts = new TextToSpeech(getContext(), new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status == TextToSpeech.SUCCESS && tts != null) {
                        applyLanguage();
                        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                            @Override
                            public void onStart(String utteranceId) {
                            }

                            @Override
                            public void onDone(String utteranceId) {
                                notifyListeners("speakEnd", new JSObject());
                            }

                            // Одноаргументный onError — абстрактный в
                            // UtteranceProgressListener (двухаргументный лишь
                            // делегирует ему). В API он помечен deprecated, но
                            // абстрактный метод придётся реализовать — подавляем
                            // предупреждение, а не игнорируем поведение.
                            @Override
                            @SuppressWarnings("deprecation")
                            public void onError(String utteranceId) {
                                notifyListeners("speakEnd", new JSObject());
                            }
                        });
                        ttsReady = true;
                    } else {
                        ttsReady = false;
                    }
                    PluginCall waiting = pendingCaps;
                    pendingCaps = null;
                    if (waiting != null) resolveCaps(waiting);
                }
            });
        } catch (Exception e) {
            tts = null;
            ttsReady = false;
        }
    }

    private void applyLanguage() {
        try {
            // forLanguageTag вместо new Locale("ru", "RU"): у конструктора с двумя
            // аргументами в новых JDK стоит @Deprecated, а javac из Android Studio
            // собирает с -Xlint-предупреждениями.
            int res = tts.setLanguage(Locale.forLanguageTag("ru-RU"));
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(Locale.getDefault());
            }
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        Float rateOrNull = call.getFloat("rate", 1.0f);
        float rate = rateOrNull == null ? 1.0f : rateOrNull.floatValue();
        if (rate < 0.5f) rate = 0.5f;
        if (rate > 2.0f) rate = 2.0f;
        JSObject ret = new JSObject();
        if (text == null || text.trim().isEmpty()) {
            ret.put("started", false);
            ret.put("error", "empty");
            call.resolve(ret);
            return;
        }
        ensureTts();
        if (!ttsReady || tts == null) {
            ret.put("started", false);
            ret.put("error", "no-tts");
            call.resolve(ret);
            return;
        }
        try {
            tts.setSpeechRate(rate);
            Bundle params = new Bundle();
            int result = tts.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, params, "he-note-voice");
            ret.put("started", result == TextToSpeech.SUCCESS);
            if (result != TextToSpeech.SUCCESS) ret.put("error", "speak-failed");
        } catch (Exception e) {
            ret.put("started", false);
            ret.put("error", "speak-failed");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        try {
            if (tts != null) tts.stop();
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    /* ── Жизненный цикл ────────────────────────────────────────────────── */

    @Override
    protected void handleOnDestroy() {
        if (current == this) current = null;
        releaseMicWait();
        pendingCaps = null;
        try {
            stopListeningInternal();
        } catch (Exception ignored) {
        }
        try {
            if (tts != null) {
                tts.stop();
                tts.shutdown();
            }
        } catch (Exception ignored) {
        }
        tts = null;
        ttsReady = false;
        ttsInitStarted = false;
        super.handleOnDestroy();
    }
}
