package com.healthengine.app.biometry;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

/**
 * BiometryPlugin — биометрия APK через системный BiometricPrompt.
 *
 * Почему НЕ WebAuthn (так было в native-bridge до этой правки): платформенный
 * аутентификатор WebAuthn в Android WebView недоступен. Origin Capacitor
 * (https://localhost) не связан с пакетом приложения через Digital Asset
 * Links, поэтому `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`
 * возвращает false, а `navigator.credentials.create()` падает NotAllowedError.
 * Снаружи это выглядит как «биометрия не работает»: карточка в настройках
 * пишет «недоступна», отпечаток при входе не предлагается.
 *
 * Здесь — штатный androidx.biometric: `BiometricManager.canAuthenticate()`
 * отвечает, есть ли записанный отпечаток/лицо, а `BiometricPrompt` показывает
 * системный диалог. Ключи не хранятся: подтверждение каждый раз системное.
 *
 * Все методы safe: любая ошибка = reject с кодом, исключений наружу нет.
 */
@CapacitorPlugin(name = "Biometry")
public class BiometryPlugin extends Plugin {

    /**
     * BIOMETRIC_WEAK включает и strong: на API 24-27 доступен только
     * отпечаток, на 28+ — ещё и лицо/радужка (Class 2 и выше).
     */
    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    /** Диалог уже показан: второй вызов отклоняем, иначе два промпта друг на друге. */
    private boolean prompting = false;
    /** Когда показан промпт: если колбэк потерялся, через 2 минуты разрешаем снова. */
    private long promptStartedAt = 0L;

    private static String statusName(int status) {
        switch (status) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return "ok";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "none-enrolled";
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "no-hardware";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "hw-unavailable";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "security-update-required";
            case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED:
                return "unsupported";
            default:
                return "unknown";
        }
    }

    private static String safeString(String value, String fallback) {
        return (value == null || value.trim().isEmpty()) ? fallback : value.trim();
    }

    /** Есть ли на устройстве записанная биометрия (отпечаток/лицо). */
    @PluginMethod
    public void checkAvailability(PluginCall call) {
        int status = statusOf();
        JSObject ret = new JSObject();
        ret.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("status", statusName(status));
        call.resolve(ret);
    }

    /**
     * Показать системный диалог биометрии.
     * resolve: { ok: true } | { ok: false, error: "canceled|lockout|..." }
     * reject: BUSY | NO_ACTIVITY | none-enrolled | no-hardware | ...
     */
    @PluginMethod
    public void authenticate(final PluginCall call) {
        long now = System.currentTimeMillis();
        // Потерянный колбэк (активность уничтожена, диалог убит системой) не
        // должен блокировать биометрию до перезапуска приложения.
        if (prompting && now - promptStartedAt < 120000L) {
            call.reject("BUSY");
            return;
        }
        final FragmentActivity activity = activityOrNull();
        if (activity == null) {
            call.reject("NO_ACTIVITY");
            return;
        }
        int status = statusOf();
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject(statusName(status));
            return;
        }
        final String title = safeString(call.getString("title"), "Health Engine");
        final String reason = safeString(call.getString("reason"), "Подтвердите личность");
        final String cancel = safeString(call.getString("cancelText"), "Отмена");
        final Executor executor = ContextCompat.getMainExecutor(activity);

        prompting = true;
        promptStartedAt = now;
        try {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                                new BiometricPrompt.AuthenticationCallback() {
                                    private boolean settled = false;

                                    private void finish(JSObject ret) {
                                        if (settled) return;
                                        settled = true;
                                        prompting = false;
                                        call.resolve(ret);
                                    }

                                    private void fail(String error) {
                                        JSObject ret = new JSObject();
                                        ret.put("ok", false);
                                        ret.put("error", error);
                                        finish(ret);
                                    }

                                    @Override
                                    public void onAuthenticationSucceeded(
                                            @NonNull BiometricPrompt.AuthenticationResult result) {
                                        JSObject ret = new JSObject();
                                        ret.put("ok", true);
                                        finish(ret);
                                    }

                                    @Override
                                    public void onAuthenticationError(
                                            int code, @NonNull CharSequence errString) {
                                        switch (code) {
                                            case BiometricPrompt.ERROR_USER_CANCELED:
                                            case BiometricPrompt.ERROR_NEGATIVE_BUTTON:
                                            case BiometricPrompt.ERROR_CANCELED:
                                                fail("canceled");
                                                break;
                                            case BiometricPrompt.ERROR_LOCKOUT:
                                                fail("lockout");
                                                break;
                                            case BiometricPrompt.ERROR_LOCKOUT_PERMANENT:
                                                fail("lockout-permanent");
                                                break;
                                            case BiometricPrompt.ERROR_NO_BIOMETRICS:
                                                fail("none-enrolled");
                                                break;
                                            default:
                                                fail("failed");
                                                break;
                                        }
                                    }
                                });
                        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                                .setTitle(title)
                                .setSubtitle(reason)
                                .setAllowedAuthenticators(AUTHENTICATORS)
                                .setNegativeButtonText(cancel)
                                .setConfirmationRequired(false)
                                .build();
                        prompt.authenticate(info);
                    } catch (Throwable ignored) {
                        prompting = false;
                        call.reject("PROMPT_FAILED");
                    }
                }
            });
        } catch (Throwable ignored) {
            prompting = false;
            call.reject("PROMPT_FAILED");
        }
    }

    private int statusOf() {
        try {
            return BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        } catch (Throwable ignored) {
            return BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED;
        }
    }

    private FragmentActivity activityOrNull() {
        try {
            return getActivity();
        } catch (Throwable ignored) {
            return null;
        }
    }
}
