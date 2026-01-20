# Proguard rules for WebView app

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep OneSignal
-keep class com.onesignal.** { *; }
-dontwarn com.onesignal.**

# Keep app classes
-keep class __PACKAGE_NAME__.** { *; }
