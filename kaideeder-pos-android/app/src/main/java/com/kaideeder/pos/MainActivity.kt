package com.kaideeder.pos

import android.os.Bundle
import android.view.View
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var printer: SunmiPrinterManager
    private lateinit var webViewManager: PosWebViewManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableImmersiveMode()

        val settings = PosSettings()
        val drawerManager = CashDrawerManager(settings)
        printer = SunmiPrinterManager(
            context = applicationContext,
            formatter = ReceiptFormatter(),
            logoLoader = ReceiptLogoLoader(settings),
            cashDrawerManager = drawerManager
        )
        webViewManager = PosWebViewManager(this, settings)

        val bridge = PosJavascriptBridge(
            printer = printer,
            registry = ReceiptPrintRegistry(applicationContext),
            isTrustedPageLoaded = webViewManager::isTrustedPageLoaded,
            reloadPage = webViewManager::reload
        )
        webViewManager.installBridge(bridge)
        setContentView(webViewManager.view())

        printer.bind()
        webViewManager.load()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webViewManager.canGoBack()) webViewManager.goBack() else finish()
            }
        })
    }

    override fun onResume() {
        super.onResume()
        enableImmersiveMode()
    }

    override fun onDestroy() {
        if (::webViewManager.isInitialized) webViewManager.destroy()
        if (::printer.isInitialized) printer.unbind()
        super.onDestroy()
    }

    private fun enableImmersiveMode() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }
}
