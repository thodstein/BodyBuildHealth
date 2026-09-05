package com.healthengine.app.updater;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * AppUpdaterPlugin — самообновление APK без сторов.
 *
 * Схема: DownloadManager качает .apk из GitHub Release в приватный
 * external-files (другим приложениям не виден) → FileProvider отдаёт URI
 * системному установщику (ACTION_VIEW). Подпись обязана совпадать с
 * установленной — иначе система отклонит установку, плагин вернёт
 * INSTALL_FAILED, а UI покажет инструкцию (см. AppUpdateBanner).
 *
 * Все методы total-safe: любая ошибка = reject с кодом, исключений наружу нет.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String SUBDIR = "updates";
    private static final String FILE_NAME = "app-update.apk";
    private static final String MIME_APK = "application/vnd.android.package-archive";

    private File updateFile() {
        File dir = new File(getContext().getExternalFilesDir(SUBDIR), ".");
        if (!dir.exists()) {
            // noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return new File(dir, FILE_NAME);
    }

    private DownloadManager downloadManager() {
        try {
            return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        } catch (Exception ignored) {
            return null;
        }
    }

    /** Поставить APK в очередь DownloadManager. Возвращает downloadId. */
    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://") || !url.contains(".apk")) {
            call.reject("BAD_URL");
            return;
        }
        try {
            DownloadManager dm = downloadManager();
            if (dm == null) {
                call.reject("NO_DM");
                return;
            }
            File dest = updateFile();
            if (dest.exists()) {
                // noinspection ResultOfMethodCallIgnored
                dest.delete();
            }
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle("Health Engine — обновление");
            req.setDescription("Загрузка новой версии…");
            req.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE);
            req.setMimeType(MIME_APK);
            req.setAllowedOverMetered(true);
            req.setAllowedOverRoaming(false);
            req.setDestinationInExternalFilesDir(getContext(), SUBDIR, FILE_NAME);
            long id = dm.enqueue(req);
            JSObject ret = new JSObject();
            ret.put("downloadId", id);
            call.resolve(ret);
        } catch (Exception ignored) {
            call.reject("ENQUEUE_FAILED");
        }
    }

    /** Статус закачки: pending | downloading | done | failed (+ progress 0..1). */
    @PluginMethod
    public void downloadStatus(PluginCall call) {
        long id;
        try {
            id = call.getData().optLong("downloadId", -1L);
        } catch (Exception ignored) {
            id = -1L;
        }
        JSObject ret = new JSObject();
        ret.put("status", "failed");
        ret.put("progress", 0);
        if (id < 0) {
            call.resolve(ret);
            return;
        }
        Cursor cursor = null;
        try {
            DownloadManager dm = downloadManager();
            if (dm == null) {
                call.resolve(ret);
                return;
            }
            cursor = dm.query(new DownloadManager.Query().setFilterById(id));
            if (cursor != null && cursor.moveToFirst()) {
                int status = cursor.getInt(cursor.getColumnIndexOrThrow(
                        DownloadManager.COLUMN_STATUS));
                long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(
                        DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = cursor.getLong(cursor.getColumnIndexOrThrow(
                        DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                double progress = total > 0 ? Math.min(1.0, (double) downloaded / total) : 0;
                ret.put("progress", progress);
                switch (status) {
                    case DownloadManager.STATUS_SUCCESSFUL:
                        ret.put("status", "done");
                        ret.put("progress", 1);
                        break;
                    case DownloadManager.STATUS_FAILED:
                        ret.put("status", "failed");
                        break;
                    case DownloadManager.STATUS_RUNNING:
                        ret.put("status", "downloading");
                        break;
                    default:
                        ret.put("status", "pending");
                        break;
                }
            }
            call.resolve(ret);
        } catch (Exception ignored) {
            call.resolve(ret);
        } finally {
            if (cursor != null) {
                try {
                    cursor.close();
                } catch (Exception ignored) {
                    // no-op
                }
            }
        }
    }

    /** Открыть скачанный APK системным установщиком. */
    @PluginMethod
    public void installApk(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !getContext().getPackageManager().canRequestPackageInstalls()) {
                call.reject("UNKNOWN_SOURCES_BLOCKED");
                return;
            }
            File apk = updateFile();
            if (!apk.exists()) {
                call.reject("NO_FILE");
                return;
            }
            Context ctx = getContext();
            Uri uri = FileProvider.getUriForFile(
                    ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, MIME_APK);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception ignored) {
            call.reject("INSTALL_FAILED");
        }
    }

    /** Экран «Установка неизвестных приложений» для нашего пакета. */
    @PluginMethod
    public void openUnknownSourcesSettings(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception ignored) {
            call.reject("SETTINGS_FAILED");
        }
    }
}
