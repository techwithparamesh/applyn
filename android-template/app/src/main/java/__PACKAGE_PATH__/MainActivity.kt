package __PACKAGE_NAME__

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.onesignal.OneSignal
import com.onesignal.debug.LogLevel
import java.io.ByteArrayInputStream

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    // Install splash screen before super.onCreate()
    installSplashScreen()
    super.onCreate(savedInstanceState)

    // Initialize OneSignal for push notifications
    initOneSignal()

    webView = WebView(this)
    setContentView(webView)

    configureWebView()
    
    webView.loadUrl("__START_URL__")

    // Handle back button properly
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (webView.canGoBack()) {
          webView.goBack()
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
        }
      }
    })
  }

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
    
    // Offline caching support
    settings.cacheMode = if (isNetworkAvailable()) {
      WebSettings.LOAD_DEFAULT
    } else {
      WebSettings.LOAD_CACHE_ELSE_NETWORK
    }
    settings.domStorageEnabled = true
    settings.databaseEnabled = true
    settings.setGeolocationEnabled(true)
    
    // Enable app cache for offline support
    @Suppress("DEPRECATION")
    settings.setAppCacheEnabled(true)
    @Suppress("DEPRECATION")
    settings.setAppCachePath(cacheDir.absolutePath)

    webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        // Keep navigation within the app
        val url = request?.url?.toString() ?: return false
        if (url.startsWith("__START_URL__".substringBefore("://") + "://")) {
          return false // Load in WebView
        }
        return false
      }

      override fun onReceivedError(
        view: WebView?,
        errorCode: Int,
        description: String?,
        failingUrl: String?
      ) {
        super.onReceivedError(view, errorCode, description, failingUrl)
        // Show offline page if network error
        if (!isNetworkAvailable()) {
          showOfflinePage()
        }
      }
    }
    
    webView.webChromeClient = WebChromeClient()
  }

  private fun isNetworkAvailable(): Boolean {
    val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = connectivityManager.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  private fun showOfflinePage() {
    val offlineHtml = """
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, __PRIMARY_COLOR__ 0%, #1e40af 100%);
            color: white;
            text-align: center;
            padding: 20px;
          }
          h1 { font-size: 24px; margin-bottom: 16px; }
          p { font-size: 16px; opacity: 0.9; margin-bottom: 24px; }
          button {
            background: white;
            color: __PRIMARY_COLOR__;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again.</p>
        <button onclick="location.reload()">Retry</button>
      </body>
      </html>
    """.trimIndent()
    webView.loadDataWithBaseURL(null, offlineHtml, "text/html", "UTF-8", null)
  }

  private fun initOneSignal() {
    val appId = BuildConfig.ONESIGNAL_APP_ID
    if (appId.isNotBlank() && appId != "null" && appId != "") {
      OneSignal.Debug.logLevel = LogLevel.WARN
      OneSignal.initWithContext(this, appId)
    }
  }
}

