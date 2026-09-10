package com.kaideeder.pos

import android.os.Build
import android.webkit.JavascriptInterface
import org.json.JSONObject

class PosJavascriptBridge(
    private val printer: SunmiPrinterManager,
    private val registry: ReceiptPrintRegistry,
    private val isTrustedPageLoaded: () -> Boolean,
    private val reloadPage: () -> Unit
) {
    @JavascriptInterface
    fun printReceipt(payloadJson: String): String = execute {
        val receipt = ReceiptPayload.fromJson(payloadJson, ReceiptType.ORIGINAL)
        if (registry.hasOriginal(receipt.orderId)) {
            return@execute PrinterStatus.error(
                "DUPLICATE_BLOCKED",
                "Original receipt was already submitted for this order"
            )
        }

        val result = printer.printReceipt(receipt)
        if (result.ok) registry.rememberOriginal(receipt.orderId)
        result
    }

    @JavascriptInterface
    fun reprintReceipt(payloadJson: String): String = execute {
        val receipt = ReceiptPayload.fromJson(payloadJson, ReceiptType.REPRINT)
        printer.printReceipt(
            receipt.copy(options = receipt.options.copy(openCashDrawer = false))
        )
    }

    @JavascriptInterface
    fun testPrint(): String = execute { printer.printTest() }

    @JavascriptInterface
    fun getPrinterStatus(): String = execute { printer.status() }

    @JavascriptInterface
    fun openCashDrawer(): String = execute { printer.openCashDrawer() }

    @JavascriptInterface
    fun getDeviceInfo(): String = executeData(
        code = "DEVICE_INFO",
        message = "Device information available",
        data = JSONObject()
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("androidSdk", Build.VERSION.SDK_INT)
    )

    @JavascriptInterface
    fun getAppVersion(): String = executeData(
        code = "APP_VERSION",
        message = BuildConfig.VERSION_NAME,
        data = JSONObject()
            .put("versionName", BuildConfig.VERSION_NAME)
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("debug", BuildConfig.DEBUG)
    )

    @JavascriptInterface
    fun reload(): String = execute {
        reloadPage()
        PrinterStatus.accepted("RELOAD_QUEUED", "POS reload queued")
    }

    private fun execute(block: () -> PrinterStatus): String {
        if (!isTrustedPageLoaded()) {
            return PrinterStatus.error("UNTRUSTED_PAGE", "Native command is blocked for this page").toJson()
        }
        return try {
            block().toJson()
        } catch (error: IllegalArgumentException) {
            PrinterStatus.error("INVALID_REQUEST", error.message ?: "Invalid request").toJson()
        } catch (error: Exception) {
            PrinterStatus.error("NATIVE_ERROR", error.message ?: "Native command failed").toJson()
        }
    }

    private fun executeData(code: String, message: String, data: JSONObject): String {
        if (!isTrustedPageLoaded()) {
            return PrinterStatus.error("UNTRUSTED_PAGE", "Native command is blocked for this page").toJson()
        }
        return JSONObject()
            .put("ok", true)
            .put("code", code)
            .put("message", message)
            .put("data", data)
            .toString()
    }
}
