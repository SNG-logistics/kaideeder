package com.garden43.sunmiposbridge

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var printer: SunmiPrinterManager
    private val allowedHosts = BuildConfig.ALLOWED_HOSTS.split(',')
        .map { it.trim().lowercase() }
        .filter { it.isNotEmpty() }
        .toSet()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        require(isAllowedPosUrl(Uri.parse(BuildConfig.POS_URL))) { "POS_URL must use an allowed host and HTTPS" }

        printer = SunmiPrinterManager(applicationContext)
        printer.bind()

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.safeBrowsingEnabled = true
            webChromeClient = WebChromeClient()
            webViewClient = PosWebViewClient()
            addJavascriptInterface(PrinterJsBridge(this, printer, BuildConfig.ALLOWED_HOSTS), "SunmiPrinter")
            loadUrl(BuildConfig.POS_URL)
        }
        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("SunmiPrinter")
            webView.destroy()
        }
        if (::printer.isInitialized) printer.unbind()
        super.onDestroy()
    }

    private fun isAllowedPosUrl(uri: Uri): Boolean {
        val host = uri.host?.lowercase() ?: return false
        val secureScheme = uri.scheme == "https" || (BuildConfig.ALLOW_CLEARTEXT && uri.scheme == "http")
        return secureScheme && host in allowedHosts
    }

    private inner class PosWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            return !isAllowedPosUrl(request.url)
        }

        @Deprecated("Deprecated in Java")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
            return !isAllowedPosUrl(Uri.parse(url))
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            if (url != null && !isAllowedPosUrl(Uri.parse(url))) view.stopLoading()
            super.onPageStarted(view, url, favicon)
        }
    }
}
