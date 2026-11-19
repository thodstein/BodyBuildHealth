package com.healthengine.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

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
 */
@CapacitorPlugin(
    name = "HeSpeech",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
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

    @PluginMethod
    public void startRecognition(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphoneCallback");
            return;
        }
        startListening(call.getString("lang", "ru-RU"), call);
    }

    @PermissionCallback
    private void microphoneCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startListening(call.getString("lang", "ru-RU"), call);
            return;
        }
        rejectStart(call, "no-permission");
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
