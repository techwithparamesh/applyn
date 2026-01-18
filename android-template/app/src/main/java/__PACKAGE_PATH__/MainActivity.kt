package __PACKAGE_NAME__

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val webView = WebView(this)
    setContentView(webView)

    val settings: WebSettings = webView.settings
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.loadsImagesAutomatically = true
    settings.cacheMode = WebSettings.LOAD_DEFAULT

    webView.webViewClient = WebViewClient()
    webView.webChromeClient = WebChromeClient()

    webView.loadUrl("__START_URL__")
  }

  override fun onBackPressed() {
    val webView = (window.decorView.rootView as? WebView)
    if (webView != null && webView.canGoBack()) {
      webView.goBack()
    } else {
      super.onBackPressed()
    }
  }
}
