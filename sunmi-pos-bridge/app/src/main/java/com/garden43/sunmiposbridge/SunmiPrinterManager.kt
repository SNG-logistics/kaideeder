package com.garden43.sunmiposbridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.RemoteException
import android.util.Base64
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService
import java.text.NumberFormat
import java.util.Locale

class SunmiPrinterManager(private val context: Context) {
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

    fun bind(): Boolean = InnerPrinterManager.getInstance().bindService(context, callback)

    fun unbind() = InnerPrinterManager.getInstance().unBindService(context, callback)

    fun isReady(): Boolean = service != null

    @Throws(RemoteException::class)
    fun printTest() {
        val printer = requirePrinter()
        printer.printerInit(null)
        printer.setAlignment(1, null)
        printer.printTextWithFont("43 GARDEN\n", null, 36f, null)
        printer.printText("SUNMI D2s Plus printer connected\n", null)
        printer.printText("ทดสอบภาษาไทย / ທົດສອບພາສາລາວ\n", null)
        printer.lineWrap(4, null)
        printer.cutPaper(null)
    }

    @Throws(RemoteException::class)
    fun printReceipt(receipt: Receipt) {
        val printer = requirePrinter()
        printer.enterPrinterBuffer(true)
        try {
            printer.printerInit(null)
            printer.setAlignment(1, null)
            receipt.logoPngBase64?.let { printLogo(printer, it) }
            printer.printTextWithFont("43 GARDEN\n", null, 38f, null)
            printer.printText("ใบเสร็จรับเงิน / ໃບຮັບເງິນ\n", null)
            printer.setAlignment(0, null)
            printer.printText("เลขที่: ${receipt.receiptNo}\n", null)
            if (receipt.dateTime.isNotBlank()) printer.printText("เวลา: ${receipt.dateTime}\n", null)
            if (receipt.cashier.isNotBlank()) printer.printText("แคชเชียร์: ${receipt.cashier}\n", null)
            printer.printText("------------------------------------------------\n", null)
            receipt.items.forEach { item ->
                printer.printText("${item.name}\n", null)
                printer.printColumnsString(
                    arrayOf(formatQty(item.quantity), money(item.unitPrice), money(item.total)),
                    intArrayOf(14, 14, 20),
                    intArrayOf(0, 2, 2),
                    null
                )
            }
            printer.printText("------------------------------------------------\n", null)
            printMoneyRow(printer, "รวม", receipt.subtotal)
            if (receipt.discount > 0) printMoneyRow(printer, "ส่วนลด", -receipt.discount)
            printer.sendRAWData(byteArrayOf(0x1B, 0x45, 0x01), null)
            printMoneyRow(printer, "ยอดสุทธิ", receipt.grandTotal)
            printer.sendRAWData(byteArrayOf(0x1B, 0x45, 0x00), null)
            printer.printText("ชำระ: ${receipt.paymentMethod}\n", null)
            receipt.qrText?.let {
                printer.setAlignment(1, null)
                printer.printQRCode(it, 6, 1, null)
                printer.lineWrap(1, null)
            }
            printer.setAlignment(1, null)
            printer.printText("ขอบคุณที่ใช้บริการ\n", null)
            printer.lineWrap(4, null)
            if (receipt.openCashDrawer) printer.openDrawer(null)
            if (receipt.cutPaper) printer.cutPaper(null)
            printer.exitPrinterBufferWithCallback(true, null)
        } catch (error: Exception) {
            printer.exitPrinterBuffer(false)
            throw error
        }
    }

    private fun requirePrinter(): SunmiPrinterService =
        requireNotNull(service) { "SUNMI printer service is not connected" }

    private fun printLogo(printer: SunmiPrinterService, rawLogo: String) {
        val base64 = rawLogo.substringAfter(',', rawLogo)
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        require(bytes.size <= 512_000) { "Logo image is too large" }
        val bitmap = requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size)) { "Logo is not a valid image" }
        val scaled = scaleToWidth(bitmap, 480)
        printer.printBitmap(scaled, null)
        if (scaled !== bitmap) bitmap.recycle()
    }

    private fun scaleToWidth(bitmap: Bitmap, maxWidth: Int): Bitmap {
        if (bitmap.width <= maxWidth) return bitmap
        val height = (bitmap.height.toLong() * maxWidth / bitmap.width).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, maxWidth, height, true)
    }

    private fun printMoneyRow(printer: SunmiPrinterService, label: String, amount: Long) {
        printer.printColumnsString(arrayOf(label, money(amount)), intArrayOf(24, 24), intArrayOf(0, 2), null)
    }

    private fun money(value: Long): String = NumberFormat.getIntegerInstance(Locale.US).format(value)

    private fun formatQty(value: Double): String =
        if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()
}
