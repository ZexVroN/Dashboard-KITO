package com.zexvron.dashboardkito

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    companion object {
        const val DASHBOARD_URL = "https://inbranch.region2.co.id/"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Blokir screenshot & rekam layar sejak awal (aman secara bawaan). Halaman melepasnya lewat
        // KitoAndroid.setSecure(false) setelah pengguna login (assets/js/tamu-aman.js).
        aturLayarAman(true)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.myWebView)
        val bridge = KitoBridge(this, webView)

        setupWebView(bridge)
        scheduleBackgroundPushWorker()
        setupBackNavigation()

        // Periksa apakah aplikasi dibuka dari klik notifikasi
        val targetUrl = intent?.getStringExtra("target_url")
        if (!targetUrl.isNullOrEmpty()) {
            loadDashboardUrl(targetUrl)
        } else {
            loadDashboardUrl(DASHBOARD_URL)
        }
    }

    /** FLAG_SECURE: layar tidak bisa di-screenshot / direkam dan tampil hitam di daftar aplikasi terbaru. */
    fun aturLayarAman(aktif: Boolean) {
        if (aktif) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        val targetUrl = intent?.getStringExtra("target_url")
        if (!targetUrl.isNullOrEmpty()) {
            loadDashboardUrl(targetUrl)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(bridge: KitoBridge) {
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT

            // Tambahkan penanda khusus KITO-Android/<versionCode> agar website mengenali aplikasi
            val defaultUa = userAgentString
            userAgentString = "$defaultUa KITO-Android/1"
        }

        // Daftarkan jembatan JavaScript Interface
        webView.addJavascriptInterface(bridge, "KitoAndroid")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                // Halaman KITO sendiri tetap di WebView
                if (url.contains("region2.co.id") || url.startsWith("file://") || url.startsWith("data:")
                    || url.startsWith("blob:") || url.startsWith("about:")) return false
                // Selain itu (wa.me, whatsapp://, tel:, mailto:, intent://, situs lain) dibuka di aplikasi yang sesuai.
                // Tanpa ini WebView mencoba memuat whatsapp:// sendiri -> "net::ERR_UNKNOWN_URL_SCHEME".
                bukaEksternal(url)
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // Dukungan file picker bila diperlukan
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback
                val intent = fileChooserParams?.createIntent()
                return try {
                    if (intent != null) startActivityForResult(intent, 2001)
                    true
                } catch (e: Exception) {
                    fileUploadCallback = null
                    false
                }
            }
        }
    }

    private fun loadDashboardUrl(url: String) {
        val resolvedUrl = if (url.startsWith("http://") || url.startsWith("https://")) {
            url
        } else {
            DASHBOARD_URL.trimEnd('/') + "/" + url.trimStart('/')
        }
        webView.loadUrl(resolvedUrl)
    }

    /**
     * Menjadwalkan pengecekan notifikasi di latar belakang via Android WorkManager
     */
    private fun scheduleBackgroundPushWorker() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val periodicWork = PeriodicWorkRequestBuilder<KitoNotificationWorker>(
            15, TimeUnit.MINUTES,
            5, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .addTag(KitoNotificationWorker.WORK_TAG)
            .build()

        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            KitoNotificationWorker.WORK_TAG,
            ExistingPeriodicWorkPolicy.KEEP,
            periodicWork
        )
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    /** Buka URL di luar WebView: Telepon, WhatsApp, email, intent://, atau browser. Dipakai juga oleh KitoBridge.openExternal. */
    fun bukaEksternal(url: String) {
        try {
            val intent = if (url.startsWith("intent:")) {
                Intent.parseUri(url, Intent.URI_INTENT_SCHEME).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE); component = null; selector = null
                }
            } else {
                val uri = Uri.parse(url)
                if (uri.scheme == "tel") Intent(Intent.ACTION_DIAL, uri) else Intent(Intent.ACTION_VIEW, uri)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: Exception) {
            // aplikasi tujuan tidak terpasang: coba alamat cadangan (intent:// browser_fallback_url / wa.me lewat browser)
            val cadangan = when {
                url.startsWith("intent:") -> try {
                    Intent.parseUri(url, Intent.URI_INTENT_SCHEME).getStringExtra("browser_fallback_url")
                } catch (x: Exception) { null }
                url.startsWith("whatsapp:") -> Uri.parse(url).getQueryParameter("phone")?.let { "https://wa.me/$it" }
                else -> null
            }
            if (cadangan != null) {
                try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(cadangan)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (x: Exception) { }
            } else {
                android.widget.Toast.makeText(this, "Aplikasi untuk membuka tautan ini tidak ditemukan", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }
}
