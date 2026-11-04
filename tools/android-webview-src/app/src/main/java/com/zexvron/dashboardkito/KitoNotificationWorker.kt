package com.zexvron.dashboardkito

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class KitoNotificationWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val BASE_API = "https://inbranch.region2.co.id/push-php"
        const val WORK_TAG = "kito_background_push_poll"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences("kito_prefs", Context.MODE_PRIVATE)
        val deviceId = prefs.getString(KitoBridge.PREF_DEVICE_ID, null) ?: return@withContext Result.success()
        val lastNotifId = prefs.getInt(KitoBridge.PREF_LAST_NOTIF_ID, 0)

        try {
            val encodedId = URLEncoder.encode(deviceId, "UTF-8")
            val endpoint = "$BASE_API/api/webview/poll?device_id=$encodedId&since_id=$lastNotifId"
            val url = URL(endpoint)
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10000
                readTimeout = 10000
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "KITO-Android-Worker/2")
            }

            if (conn.responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val response = reader.use { it.readText() }
                val json = JSONObject(response)

                if (json.optBoolean("ok", false)) {
                    val notifs = json.optJSONArray("notifications")
                    var maxId = lastNotifId

                    if (notifs != null && notifs.length() > 0) {
                        for (i in 0 until notifs.length()) {
                            val item = notifs.getJSONObject(i)
                            val id = item.optInt("id", 0)
                            val title = item.optString("title", "KITO Update")
                            val body = item.optString("body", "")
                            val targetUrl = item.optString("url", "./index.html")

                            if (id > maxId) maxId = id
                            tampilkanNotifikasi(id, title, body, targetUrl)
                        }
                    }

                    val latestId = json.optInt("latestId", maxId)
                    if (latestId > lastNotifId) {
                        prefs.edit().putInt(KitoBridge.PREF_LAST_NOTIF_ID, latestId).apply()
                    }
                }
            }
            conn.disconnect()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun tampilkanNotifikasi(id: Int, title: String, body: String, url: String) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

        createChannelIfNeeded()

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_url", url)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(context, id, intent, flags)
        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(context, KitoBridge.CHANNEL_ID)
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
            NotificationManagerCompat.from(context).notify(id, builder.build())
        } catch (e: SecurityException) {
            // Android 13 POST_NOTIFICATIONS permission not granted
        }
    }

    private fun createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                KitoBridge.CHANNEL_ID,
                KitoBridge.CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = KitoBridge.CHANNEL_DESC
                enableVibration(true)
                enableLights(true)
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
