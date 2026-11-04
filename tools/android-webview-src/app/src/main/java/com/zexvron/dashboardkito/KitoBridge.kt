package com.zexvron.dashboardkito

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.RingtoneManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.UUID

class KitoBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    private val prefs = activity.getSharedPreferences("kito_prefs", Context.MODE_PRIVATE)

    companion object {
        const val CHANNEL_ID = "kito_notif_channel"
        const val CHANNEL_NAME = "Notifikasi KITO"
        const val CHANNEL_DESC = "Pembaruan data operasional dan waktu antrian Region II"
        const val PREF_DEVICE_ID = "device_id"
        const val PREF_TOPICS = "subscribed_topics"
        const val PREF_LAST_NOTIF_ID = "last_notif_id"
        const val REQUEST_CODE_POST_NOTIF = 1001
    }

    init {
        createNotificationChannel()
    }

    /**
     * Mengambil ID perangkat persisten atau membuat UUID baru saat pertama kali
     */
    @JavascriptInterface
    fun getDeviceId(): String {
        var did = prefs.getString(PREF_DEVICE_ID, null)
        if (did.isNullOrEmpty()) {
            did = "wv-" + UUID.randomUUID().toString()
            prefs.edit().putString(PREF_DEVICE_ID, did).apply()
        }
        return did
    }

    /**
     * Memeriksa apakah izin notifikasi aktif di pengaturan sistem Android
     */
    @JavascriptInterface
    fun isNotificationEnabled(): Boolean {
        return NotificationManagerCompat.from(activity).areNotificationsEnabled()
    }

    /**
     * Meminta izin notifikasi (khusus Android 13 / Tiramisu ke atas)
     */
    @JavascriptInterface
    fun requestPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    activity,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    REQUEST_CODE_POST_NOTIF
                )
            }
        }
    }

    /**
     * Menyimpan daftar topik yang dipilih pengguna di SharedPreferences
     */
    @JavascriptInterface
    fun saveTopics(topicsJson: String) {
        prefs.edit().putString(PREF_TOPICS, topicsJson).apply()
    }

    /**
     * Mengambil daftar topik tersimpan
     */
    @JavascriptInterface
    fun getSavedTopics(): String {
        return prefs.getString(PREF_TOPICS, "[\"semua\"]") ?: "[\"semua\"]"
    }

    /**
     * Menampilkan notifikasi native di status bar Android
     */
    @JavascriptInterface
    fun showNotification(title: String, body: String, url: String) {
        if (!isNotificationEnabled()) return

        val intent = Intent(activity, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_url", url)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val notifId = (System.currentTimeMillis() % 100000).toInt()
        val pendingIntent = PendingIntent.getActivity(activity, notifId, intent, flags)

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notifBuilder = NotificationCompat.Builder(activity, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(soundUri)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        try {
            NotificationManagerCompat.from(activity).notify(notifId, notifBuilder.build())
        } catch (e: SecurityException) {
            // Android 13 permission denied
        }
    }

    /**
     * Mendapatkan versi aplikasi APK saat ini
     */
    @JavascriptInterface
    fun getAppVersion(): String {
        return try {
            val pInfo = activity.packageManager.getPackageInfo(activity.packageName, 0)
            pInfo.versionName ?: "1.1"
        } catch (e: Exception) {
            "1.1"
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESC
                enableVibration(true)
                enableLights(true)
            }
            val manager = activity.getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
