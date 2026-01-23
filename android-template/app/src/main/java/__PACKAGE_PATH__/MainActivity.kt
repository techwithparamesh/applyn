package __PACKAGE_NAME__

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.button.MaterialButton
import com.onesignal.OneSignal
import com.onesignal.debug.LogLevel

/**
 * Applyn Smart Hybrid App - MainActivity
 * 
 * Features:
 * - WebView with JavaScript support
 * - Native Bottom Navigation
 * - Pull-to-Refresh
 * - Offline Screen
 * - JS Bridge Communication
 * - Loading Progress Bar
 * - Smart Back Button Handling
 * - External Link Handling
 */
class MainActivity : AppCompatActivity() {

    // View References
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var bottomNav: BottomNavigationView
    private lateinit var offlineScreen: View
    private lateinit var retryButton: MaterialButton

    // Configuration
    private val startUrl = "__START_URL__"
    private val primaryColor = "__PRIMARY_COLOR__"
    private val pullToRefreshEnabled = __PULL_REFRESH_ENABLED__
    private val bottomNavEnabled = __BOTTOM_NAV_ENABLED__
    private val offlineScreenEnabled = __OFFLINE_SCREEN_ENABLED__

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        // Install splash screen before super.onCreate()
        try {
            installSplashScreen()
        } catch (e: Exception) {
            // Splash screen not supported - continue without it
        }
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        try {
            // Initialize OneSignal for push notifications
            initOneSignal()

            // Bind views
            bindViews()

            // Configure components
            configureWebView()
            configureSwipeRefresh()
            configureBottomNavigation()
            configureOfflineScreen()
            configureBackButton()

            // Load initial URL
            loadUrl(startUrl)
        } catch (e: Exception) {
            e.printStackTrace()
            // Fallback: just load WebView with URL
            webView = findViewById(R.id.webView)
            webView.settings.javaScriptEnabled = true
            webView.settings.domStorageEnabled = true
            webView.loadUrl(startUrl)
        }
    }

    private fun bindViews() {
        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)
        bottomNav = findViewById(R.id.bottomNavigation)
        offlineScreen = findViewById(R.id.offlineScreen)
        retryButton = findViewById(R.id.retryButton)
    }

    // ============================================
    // WEBVIEW CONFIGURATION
    // ============================================

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings: WebSettings = webView.settings

        // Core settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.loadsImagesAutomatically = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.setGeolocationEnabled(true)
        settings.mediaPlaybackRequiresUserGesture = false

        // Offline caching
        settings.cacheMode = if (isNetworkAvailable()) {
            WebSettings.LOAD_DEFAULT
        } else {
            WebSettings.LOAD_CACHE_ELSE_NETWORK
        }

        // User Agent (append Applyn identifier)
        val defaultUA = settings.userAgentString
        settings.userAgentString = "$defaultUA Applyn/__VERSION_NAME__"

        // Add JavaScript Interface (JS Bridge)
        webView.addJavascriptInterface(ApplynJSBridge(this), "Applyn")

        // WebViewClient for navigation handling
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                return handleUrlLoading(uri)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                if (offlineScreenEnabled) {
                    offlineScreen.visibility = View.GONE
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                
                // Inject JS Bridge helper
                injectJSBridgeHelper()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                // Only handle errors for main frame
                if (request?.isForMainFrame == true) {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    
                    if (offlineScreenEnabled && !isNetworkAvailable()) {
                        showOfflineScreen()
                    }
                }
            }
        }

        // WebChromeClient for progress and JS dialogs
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                progressBar.progress = newProgress
                if (newProgress >= 100) {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setNegativeButton("Cancel") { _, _ -> result?.cancel() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }
        }
    }

    private fun handleUrlLoading(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false

        // External URL schemes - open with native apps
        val externalSchemes = listOf(
            "tel", "mailto", "sms", "whatsapp", "tg", "telegram",
            "fb", "facebook", "instagram", "twitter", "x",
            "linkedin", "snapchat", "viber", "skype",
            "geo", "maps", "market", "intent"
        )

        if (externalSchemes.contains(scheme)) {
            return openExternalIntent(uri)
        }

        // Handle http/https links
        if (scheme == "http" || scheme == "https") {
            val appHost = startUrl.replace(Regex("^https?://"), "").split("/")[0]
            val linkHost = uri.host ?: ""

            // External domains to open in native apps
            val externalDomains = listOf(
                "wa.me", "api.whatsapp.com", "whatsapp.com",
                "t.me", "telegram.me", "telegram.org",
                "facebook.com", "fb.com", "m.facebook.com",
                "instagram.com", "twitter.com", "x.com",
                "linkedin.com", "youtube.com", "youtu.be",
                "play.google.com", "apps.apple.com",
                "maps.google.com", "maps.app.goo.gl"
            )

            if (externalDomains.any { linkHost.contains(it) }) {
                return openExternalIntent(uri)
            }

            // Keep same-domain navigation within the app
            if (linkHost.contains(appHost) || appHost.contains(linkHost)) {
                return false
            }

            // Open other external links in browser
            return openExternalIntent(uri)
        }

        return false
    }

    private fun openExternalIntent(uri: Uri): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW, uri)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            true
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_found, Toast.LENGTH_SHORT).show()
            false
        } catch (e: Exception) {
            false
        }
    }

    // ============================================
    // PULL-TO-REFRESH
    // ============================================

    private fun configureSwipeRefresh() {
        swipeRefresh.isEnabled = pullToRefreshEnabled
        
        // Set refresh indicator color to primary color
        swipeRefresh.setColorSchemeColors(
            android.graphics.Color.parseColor(primaryColor)
        )

        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    // ============================================
    // BOTTOM NAVIGATION
    // ============================================

    private fun configureBottomNavigation() {
        bottomNav.visibility = if (bottomNavEnabled) View.VISIBLE else View.GONE

        if (bottomNavEnabled) {
            bottomNav.setOnItemSelectedListener { item ->
                when (item.itemId) {
                    R.id.nav_home -> {
                        webView.loadUrl(startUrl)
                        true
                    }
                    R.id.nav_back -> {
                        if (webView.canGoBack()) webView.goBack()
                        true
                    }
                    R.id.nav_forward -> {
                        if (webView.canGoForward()) webView.goForward()
                        true
                    }
                    R.id.nav_reload -> {
                        webView.reload()
                        true
                    }
                    else -> false
                }
            }
        }
    }

    // ============================================
    // OFFLINE SCREEN
    // ============================================

    private fun configureOfflineScreen() {
        retryButton.setOnClickListener {
            if (isNetworkAvailable()) {
                hideOfflineScreen()
                webView.reload()
            } else {
                Toast.makeText(this, "Still offline. Please check your connection.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showOfflineScreen() {
        offlineScreen.visibility = View.VISIBLE
        webView.visibility = View.INVISIBLE
    }

    private fun hideOfflineScreen() {
        offlineScreen.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    // ============================================
    // BACK BUTTON HANDLING
    // ============================================

    private fun configureBackButton() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    offlineScreen.visibility == View.VISIBLE -> {
                        // If offline screen is showing, exit
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                    webView.canGoBack() -> {
                        webView.goBack()
                    }
                    else -> {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }

    // ============================================
    // JS BRIDGE HELPER INJECTION
    // ============================================

    private fun injectJSBridgeHelper() {
        val jsCode = """
            (function() {
                if (window.ApplynBridge) return;
                
                window.ApplynBridge = {
                    // Show native toast
                    showToast: function(message) {
                        window.Applyn.showToast(message);
                    },
                    
                    // Share content
                    share: function(title, text, url) {
                        window.Applyn.share(title || '', text || '', url || '');
                    },
                    
                    // Navigate to URL
                    navigateTo: function(url) {
                        window.Applyn.navigateTo(url);
                    },
                    
                    // Go back
                    goBack: function() {
                        window.Applyn.goBack();
                    },
                    
                    // Reload page
                    reload: function() {
                        window.Applyn.reload();
                    },
                    
                    // Get device info
                    getDeviceInfo: function() {
                        return JSON.parse(window.Applyn.getDeviceInfo());
                    },
                    
                    // Check if feature is enabled
                    isFeatureEnabled: function(feature) {
                        return window.Applyn.isFeatureEnabled(feature);
                    },
                    
                    // Post message (generic)
                    postMessage: function(data) {
                        window.Applyn.postMessage(JSON.stringify(data));
                    }
                };
                
                // Dispatch ready event
                window.dispatchEvent(new CustomEvent('applynReady', {
                    detail: { platform: 'android', version: '__VERSION_NAME__' }
                }));
            })();
        """.trimIndent()
        
        webView.evaluateJavascript(jsCode, null)
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    private fun loadUrl(url: String) {
        if (isNetworkAvailable()) {
            webView.loadUrl(url)
        } else if (offlineScreenEnabled) {
            showOfflineScreen()
        } else {
            webView.loadUrl(url) // Let cache handle it
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun initOneSignal() {
        try {
            val appId = BuildConfig.ONESIGNAL_APP_ID
            if (appId.isNotBlank() && appId != "null" && appId != "" && appId != "__ONESIGNAL_APP_ID__") {
                OneSignal.Debug.logLevel = LogLevel.WARN
                OneSignal.initWithContext(this, appId)
            }
        } catch (e: Exception) {
            // OneSignal init failed - continue without push notifications
            e.printStackTrace()
        }
    }

    // ============================================
    // JS BRIDGE INTERFACE
    // ============================================

    /**
     * JavaScript Bridge for Native Communication
     * 
     * Usage from JavaScript:
     * - window.Applyn.showToast("Hello!")
     * - window.Applyn.share("Title", "Text", "https://...")
     * - window.Applyn.navigateTo("https://...")
     * - window.Applyn.goBack()
     * - window.Applyn.reload()
     * - window.Applyn.getDeviceInfo()
     * - window.Applyn.postMessage(JSON.stringify({...}))
     */
    inner class ApplynJSBridge(private val context: Context) {

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun share(title: String, text: String, url: String) {
            runOnUiThread {
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    val shareText = if (url.isNotBlank()) "$text\n$url" else text
                    putExtra(Intent.EXTRA_TEXT, shareText)
                }
                startActivity(Intent.createChooser(shareIntent, "Share via"))
            }
        }

        @JavascriptInterface
        fun navigateTo(url: String) {
            runOnUiThread {
                webView.loadUrl(url)
            }
        }

        @JavascriptInterface
        fun goBack() {
            runOnUiThread {
                if (webView.canGoBack()) {
                    webView.goBack()
                }
            }
        }

        @JavascriptInterface
        fun reload() {
            runOnUiThread {
                webView.reload()
            }
        }

        @JavascriptInterface
        fun getDeviceInfo(): String {
            return """
                {
                    "platform": "android",
                    "version": "${android.os.Build.VERSION.RELEASE}",
                    "sdkVersion": ${android.os.Build.VERSION.SDK_INT},
                    "manufacturer": "${android.os.Build.MANUFACTURER}",
                    "model": "${android.os.Build.MODEL}",
                    "appVersion": "${BuildConfig.VERSION_NAME}",
                    "appVersionCode": ${BuildConfig.VERSION_CODE}
                }
            """.trimIndent()
        }

        @JavascriptInterface
        fun isFeatureEnabled(feature: String): Boolean {
            return when (feature.lowercase()) {
                "pulltorefresh" -> pullToRefreshEnabled
                "bottomnav" -> bottomNavEnabled
                "offlinescreen" -> offlineScreenEnabled
                "push" -> BuildConfig.ONESIGNAL_APP_ID.isNotBlank()
                else -> false
            }
        }

        @JavascriptInterface
        fun postMessage(jsonData: String) {
            // Handle generic messages from JavaScript
            runOnUiThread {
                try {
                    // Parse and handle the message
                    // You can extend this to handle custom actions
                    android.util.Log.d("ApplynJSBridge", "Received message: $jsonData")
                } catch (e: Exception) {
                    android.util.Log.e("ApplynJSBridge", "Error handling message", e)
                }
            }
        }

        @JavascriptInterface
        fun openExternalUrl(url: String) {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (e: Exception) {
                    Toast.makeText(context, R.string.no_app_found, Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}

