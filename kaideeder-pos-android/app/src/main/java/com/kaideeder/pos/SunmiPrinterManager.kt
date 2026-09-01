package com.kaideeder.pos

import android.content.Context
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService

class SunmiPrinterManager(
    context: Context,
    private val formatter: ReceiptFormatter,
    private val logoLoader: ReceiptLogoLoader,
    private val cashDrawerManager: CashDrawerManager
) {
    private val applicationContext = context.applicationContext
    private val printLock = Any()

    @Volatile
    private var service: SunmiPrinterService? = null

    private val callback = object : InnerPrinterCallback() {
        override fun onConnected(printerService: SunmiPrinterService) {
            service = printerService
        }

        override fun onDisconnected() {
            service = null
        }
    }

    fun bind(): Boolean = InnerPrinterManager.getInstance().bindService(applicationContext, callback)

    fun unbind() {
        service = null
        InnerPrinterManager.getInstance().unBindService(applicationContext, callback)
    }

    fun status(): PrinterStatus {
        val printer = service ?: return PrinterStatus.error("DISCONNECTED", "SUNMI printer service is disconnected")
        return runCatching { PrinterStatus.fromSunmiState(printer.updatePrinterState()) }
            .getOrElse { error ->
                PrinterStatus.error("STATUS_ERROR", error.message ?: "Cannot read printer status")
            }
    }

    fun printTest(): PrinterStatus = synchronized(printLock) {
        val printer = readyPrinter() ?: return@synchronized status()
        runCatching {
            printer.enterPrinterBuffer(true)
            printer.printerInit(null)
            printer.setAlignment(1, null)
            printer.printTextWithFont("KAIDEEDER POS\n", null, 38f, null)
            printer.printText("SUNMI D2s Plus printer test\n", null)
            printer.printText("ทดสอบภาษาไทย / ທົດສອບພາສາລາວ / English\n", null)
            printer.printText("01 23 45 67 89\n", null)
            printer.lineWrap(4, null)
            printer.cutPaper(null)
            printer.exitPrinterBufferWithCallback(true, null)
            PrinterStatus.accepted("TEST_PRINT_ACCEPTED", "Test print command accepted")
        }.getOrElse { error ->
            runCatching { printer.exitPrinterBuffer(false) }
            PrinterStatus.error("TEST_PRINT_ERROR", error.message ?: "Test print failed")
        }
    }

    fun printReceipt(receipt: ReceiptPayload): PrinterStatus = synchronized(printLock) {
        val printer = readyPrinter() ?: return@synchronized status()
        var receiptBitmap: android.graphics.Bitmap? = null
        var logoBitmap: android.graphics.Bitmap? = null

        try {
            printer.enterPrinterBuffer(true)
            printer.printerInit(null)
            printer.setAlignment(1, null)

            logoBitmap = runCatching { logoLoader.load(receipt.store.logoUrl) }.getOrNull()
            logoBitmap?.let {
                printer.printBitmap(it, null)
                printer.lineWrap(1, null)
            }

            receiptBitmap = formatter.render(receipt)
            printer.printBitmap(receiptBitmap, null)

            receipt.qrText?.let { qrText ->
                printer.setAlignment(1, null)
                printer.printQRCode(qrText, 7, 1, null)
                printer.lineWrap(1, null)
            }

            val drawerResult = cashDrawerManager.openForReceipt(printer, receipt)
            printer.lineWrap(4, null)
            if (receipt.options.cutPaper) printer.cutPaper(null)
            printer.exitPrinterBufferWithCallback(true, null)

            if (receipt.options.openCashDrawer && !drawerResult.ok) {
                PrinterStatus.accepted(
                    "PRINT_ACCEPTED_${drawerResult.code}",
                    "Receipt accepted; ${drawerResult.message}"
                )
            } else {
                PrinterStatus.accepted("PRINT_ACCEPTED", "Receipt print command accepted")
            }
        } catch (error: Exception) {
            runCatching { printer.exitPrinterBuffer(false) }
            PrinterStatus.error("PRINT_ERROR", error.message ?: "Receipt print failed")
        } finally {
            receiptBitmap?.recycle()
            logoBitmap?.recycle()
        }
    }

    fun openCashDrawer(): PrinterStatus {
        val printer = readyPrinter() ?: return status()
        return cashDrawerManager.openManual(printer)
    }

    private fun readyPrinter(): SunmiPrinterService? {
        val printer = service ?: return null
        return if (status().ok) printer else null
    }
}
