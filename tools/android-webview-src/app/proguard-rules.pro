# Jembatan JavaScript window.KitoAndroid (KitoBridge.kt) dipanggil dari halaman lewat refleksi:
# jangan dibuang / diganti namanya oleh R8 saat build release (isMinifyEnabled = true).
-keepclassmembers class com.zexvron.dashboardkito.KitoBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
