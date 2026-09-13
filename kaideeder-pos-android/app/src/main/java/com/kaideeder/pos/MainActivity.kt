package com.kaideeder.pos

import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var printer: SunmiPrinterManager
    private lateinit var networkPrinter: NetworkPrinter
    private lateinit var webViewManager: PosWebViewManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableImmersiveMode()

        val settings = PosSettings()
        val drawerManager = CashDrawerManager(settings)
        val formatter = ReceiptFormatter()
        printer = SunmiPrinterManager(
            context = applicationContext,
            formatter = formatter,
            logoLoader = ReceiptLogoLoader(settings),
            cashDrawerManager = drawerManager
        )
        webViewManager = PosWebViewManager(this, settings)
        // สลิปครัว/บาร์ผ่านแลน — ผลลัพธ์ส่งกลับเข้าหน้าเว็บเป็น event เพราะทำงานแบบไม่บล็อก
        networkPrinter = NetworkPrinter(formatter) { requestId, status ->
            webViewManager.dispatchPageEvent(
                PosWebViewManager.PRINT_RESULT_EVENT,
                status.toJsonObject().put("requestId", requestId)
            )
        }

        val bridge = PosJavascriptBridge(
            printer = printer,
            networkPrinter = networkPrinter,
            registry = ReceiptPrintRegistry(applicationContext),
            isTrustedPageLoaded = webViewManager::isTrustedPageLoaded,
            reloadPage = webViewManager::reload
        )
        webViewManager.installBridge(bridge)
        setContentView(webViewManager.view())

        if (!printer.bind()) {
            // ไม่ throw — ให้แอปเปิดใช้งานต่อได้ แล้วค่อยผูกใหม่ตอน onResume / ตอนเช็คสถานะ
            Log.w(TAG, "SUNMI printer bindService was refused at startup")
        }
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
        // ระบบอาจตัดการเชื่อมต่อบริการเครื่องพิมพ์ตอนแอปอยู่เบื้องหลัง — ผูกกลับทุกครั้งที่กลับมา
        if (::printer.isInitialized) printer.ensureBound()
    }

    override fun onDestroy() {
        // หยุดคิวพิมพ์ก่อนทำลาย WebView — ผลงานพิมพ์ที่มาช้าจะได้ไม่ยิงใส่ WebView ที่ตายแล้ว
        if (::networkPrinter.isInitialized) networkPrinter.shutdown()
        if (::webViewManager.isInitialized) webViewManager.destroy()
        if (::printer.isInitialized) printer.unbind()
        super.onDestroy()
    }

    private companion object {
        const val TAG = "KaideederPOS"
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
