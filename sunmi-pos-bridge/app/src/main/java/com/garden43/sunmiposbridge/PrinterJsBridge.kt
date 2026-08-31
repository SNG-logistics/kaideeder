package com.garden43.sunmiposbridge

import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

class PrinterJsBridge(
    private val webView: WebView,
    private val printer: SunmiPrinterManager,
    allowedHostsCsv: String
) {
    private val allowedHosts = allowedHostsCsv.split(',')
        .map { it.trim().lowercase() }
        .filter { it.isNotEmpty() }
        .toSet()

    @JavascriptInterface
    fun getStatus(): String = response(printer.isReady(), if (printer.isReady()) "READY" else "DISCONNECTED")

    @JavascriptInterface
    fun testPrint(): String = execute {
        requireTrustedTopLevelPage()
        printer.printTest()
        "TEST_PRINT_QUEUED"
    }

    @JavascriptInterface
    fun printReceipt(receiptJson: String): String = execute {
        requireTrustedTopLevelPage()
        printer.printReceipt(Receipt.fromJson(receiptJson))
        "PRINT_QUEUED"
    }

    private fun requireTrustedTopLevelPage() {
        val host = android.net.Uri.parse(webView.url ?: "").host?.lowercase()
        require(host != null && host in allowedHosts) { "Printing is blocked for this website" }
    }

    private fun execute(block: () -> String): String = try {
        response(true, block())
    } catch (error: Exception) {
        response(false, error.message ?: error.javaClass.simpleName)
    }

    private fun response(ok: Boolean, message: String): String = JSONObject()
        .put("ok", ok)
        .put("message", message)
        .toString()
}
