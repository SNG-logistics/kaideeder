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

    /** ผลของ bindService ครั้งล่าสุด — null คือยังไม่เคยเรียก */
    @Volatile
    private var lastBindAccepted: Boolean? = null

    private val callback = object : InnerPrinterCallback() {
        override fun onConnected(printerService: SunmiPrinterService) {
            service = printerService
        }

        override fun onDisconnected() {
            service = null
        }
    }

    fun bind(): Boolean {
        val accepted = runCatching {
            InnerPrinterManager.getInstance().bindService(applicationContext, callback)
        }.getOrDefault(false)
        lastBindAccepted = accepted
        return accepted
    }

    /**
     * ผูกบริการใหม่ถ้าหลุดไป เรียกซ้ำได้ปลอดภัย
     * เดิม onDisconnected() ล้าง service ทิ้งแล้วไม่มีใครผูกกลับเลย ต้องปิดแล้วเปิดแอปใหม่
     * เท่านั้นถึงจะพิมพ์ได้อีก
     */
    fun ensureBound() {
        if (service == null) bind()
    }

    fun unbind() {
        service = null
        lastBindAccepted = null
        runCatching { InnerPrinterManager.getInstance().unBindService(applicationContext, callback) }
    }

    /**
     * แอปบริการเครื่องพิมพ์ของ SUNMI ติดตั้งอยู่และมองเห็นได้หรือไม่
     * ตั้งแต่ Android 11 ถ้าไม่ประกาศ <queries> ใน AndroidManifest จะมองไม่เห็น
     * แม้แอปนั้นจะติดตั้งอยู่จริง
     */
    private fun isPrinterServiceVisible(): Boolean = runCatching {
        applicationContext.packageManager.getPackageInfo(PRINTER_SERVICE_PACKAGE, 0)
        true
    }.getOrDefault(false)

    fun status(): PrinterStatus {
        val printer = service
        if (printer == null) {
            // บริการอาจหลุดชั่วคราวตอนแอปอยู่เบื้องหลัง ลองผูกกลับทันทีก่อนตอบ
            ensureBound()
            return when {
                !isPrinterServiceVisible() -> PrinterStatus.error(
                    "SERVICE_NOT_FOUND",
                    "ไม่พบบริการเครื่องพิมพ์ในตัวของ SUNMI บนเครื่องนี้"
                )
                lastBindAccepted == false -> PrinterStatus.error(
                    "BIND_REFUSED",
                    "ระบบปฏิเสธการเชื่อมต่อบริการเครื่องพิมพ์"
                )
                else -> PrinterStatus.error(
                    "DISCONNECTED",
                    "กำลังเชื่อมต่อบริการเครื่องพิมพ์ กรุณารอสักครู่แล้วลองใหม่"
                )
            }
        }
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
        ensureBound()
        val printer = service ?: return null
        return if (status().ok) printer else null
    }

    companion object {
        /** แอปบริการเครื่องพิมพ์ในตัวของ SUNMI — ต้องตรงกับ <queries> ใน AndroidManifest.xml */
        const val PRINTER_SERVICE_PACKAGE = "woyou.aidlservice.jiuiv5"
    }
}
