package com.kaideeder.pos

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

class PosWebViewManager(
    private val activity: Activity,
    private val settings: PosSettings
) {
    private val root = FrameLayout(activity)
    private val offlineView = createOfflineView()

    @Volatile
    private var trustedPageLoaded = false

    val webView: WebView = createWebView()

    init {
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        root.addView(offlineView, FrameLayout.LayoutParams(-1, -1))
        offlineView.visibility = View.GONE
    }

    fun view(): View = root

    fun installBridge(bridge: PosJavascriptBridge) {
        webView.addJavascriptInterface(bridge, BRIDGE_NAME)
    }

    fun load() {
        trustedPageLoaded = false
        webView.loadUrl(settings.posBaseUrl)
    }

    fun reload() {
        webView.post {
            offlineView.visibility = View.GONE
            trustedPageLoaded = false
            if (webView.url.isNullOrBlank()) load() else webView.reload()
        }
    }

    fun isTrustedPageLoaded(): Boolean = trustedPageLoaded

    fun canGoBack(): Boolean = webView.canGoBack()

    fun goBack() = webView.goBack()

    fun destroy() {
        trustedPageLoaded = false
        webView.removeJavascriptInterface(BRIDGE_NAME)
        webView.stopLoading()
        webView.destroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView = WebView(activity).apply {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        setBackgroundColor(Color.WHITE)
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = "${settings.userAgentString} KAIDEEDER-POS/${BuildConfig.VERSION_NAME}"
        webChromeClient = WebChromeClient()
        webViewClient = TrustedWebViewClient()

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
    }

    private fun createOfflineView(): View {
        val container = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
            setBackgroundColor(Color.rgb(17, 24, 39))
        }
        val title = TextView(activity).apply {
            text = activity.getString(R.string.offline_title)
            textSize = 25f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        val detail = TextView(activity).apply {
            text = activity.getString(R.string.offline_detail)
            textSize = 17f
            setTextColor(Color.LTGRAY)
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 32)
        }
        val retry = Button(activity).apply {
            text = activity.getString(R.string.retry_connection)
            textSize = 17f
            setOnClickListener { reload() }
        }
        container.addView(title)
        container.addView(detail)
        container.addView(retry)
        return container
    }

    private fun showOffline() {
        trustedPageLoaded = false
        offlineView.visibility = View.VISIBLE
    }

    private inner class TrustedWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            !settings.isTrustedPosUri(request.url)

        @Deprecated("Deprecated in Java")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean =
            !settings.isTrustedPosUri(Uri.parse(url))

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            trustedPageLoaded = false
            if (url == null || !settings.isTrustedPosUri(Uri.parse(url))) {
                view.stopLoading()
                showOffline()
                return
            }
            super.onPageStarted(view, url, favicon)
        }

        override fun onPageFinished(view: WebView, url: String?) {
            trustedPageLoaded = url != null && settings.isTrustedPosUri(Uri.parse(url))
            if (trustedPageLoaded) offlineView.visibility = View.GONE
            super.onPageFinished(view, url)
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) showOffline()
            super.onReceivedError(view, request, error)
        }
    }

    companion object {
        const val BRIDGE_NAME = "AndroidPOS"
    }
}
