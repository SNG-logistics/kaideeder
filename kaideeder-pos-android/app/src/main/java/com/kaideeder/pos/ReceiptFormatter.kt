package com.kaideeder.pos

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max

class ReceiptFormatter {
    private val regular = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLACK
        textSize = 25f
        typeface = Typeface.create("sans-serif", Typeface.NORMAL)
    }
    private val small = TextPaint(regular).apply { textSize = 21f }
    private val bold = TextPaint(regular).apply {
        textSize = 27f
        typeface = Typeface.create("sans-serif", Typeface.BOLD)
    }
    private val title = TextPaint(bold).apply { textSize = 38f }
    private val total = TextPaint(bold).apply { textSize = 31f }
    private val moneyFormat = NumberFormat.getNumberInstance(Locale.US).apply {
        maximumFractionDigits = 2
        minimumFractionDigits = 0
    }

    // ─── สลิปครัว/บาร์ — ตัวหนังสือใหญ่กว่าใบเสร็จมาก เพราะอ่านจากระยะไกลในครัวที่วุ่นวาย ──
    private val ticketTitle = TextPaint(bold).apply { textSize = 32f }
    private val tableHuge = TextPaint(bold).apply { textSize = 72f }
    private val itemQuantity = TextPaint(bold).apply { textSize = 44f }
    private val itemName = TextPaint(bold).apply { textSize = 34f }
    private val itemNote = TextPaint(bold).apply { textSize = 28f }
    private val sectionHeader = TextPaint(bold).apply { textSize = 30f }

    fun render(receipt: ReceiptPayload): Bitmap = renderBlocks(buildBlocks(receipt))

    /** วาดสลิปครัว/บาร์ กว้าง 576px เท่าใบเสร็จ เพราะกระดาษ 80 มม. เหมือนกัน */
    fun renderStationTicket(ticket: StationTicketPayload): Bitmap = renderBlocks(buildStationBlocks(ticket))

    private fun renderBlocks(blocks: List<Block>): Bitmap {
        val contentHeight = blocks.sumOf { it.height } + PADDING * 2
        require(contentHeight <= MAX_BITMAP_HEIGHT) { "Print job is too long to render safely" }

        val bitmap = Bitmap.createBitmap(PRINTER_WIDTH_PX, max(contentHeight, 1), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        var y = PADDING
        blocks.forEach { block ->
            block.draw(canvas, y)
            y += block.height
        }
        return bitmap
    }

    private fun buildBlocks(receipt: ReceiptPayload): List<Block> = buildList {
        if (receipt.receiptType == ReceiptType.REPRINT) {
            add(textBlock("*** REPRINT / สำเนา / ສຳເນົາ ***", bold, Layout.Alignment.ALIGN_CENTER, 44))
        }
        add(textBlock(receipt.store.name, title, Layout.Alignment.ALIGN_CENTER, 8))
        receipt.store.nameLao?.let { add(textBlock(it, bold, Layout.Alignment.ALIGN_CENTER, 6)) }
        receipt.store.receiptHeader?.let { add(textBlock(it, small, Layout.Alignment.ALIGN_CENTER, 8)) }
        receipt.store.address?.let { add(textBlock(it, small, Layout.Alignment.ALIGN_CENTER, 4)) }
        receipt.store.phone?.let { add(textBlock("Tel: $it", small, Layout.Alignment.ALIGN_CENTER, 4)) }
        receipt.store.taxId?.let { add(textBlock("Tax ID: $it", small, Layout.Alignment.ALIGN_CENTER, 10)) }

        add(separator())
        add(row("Receipt / ເລກທີ", receipt.receiptNo, small))
        add(row("Date / ວັນທີ", receipt.saleDateTime, small))
        receipt.cashier?.let { add(row("Cashier", it, small)) }
        add(separator())

        receipt.items.forEach { item ->
            add(textBlock(item.name, bold, Layout.Alignment.ALIGN_NORMAL, 2))
            add(row("${formatQuantity(item.quantity)} x ${money(item.unitPrice)}", money(item.total), regular))
            item.note?.let { add(textBlock("• $it", small, Layout.Alignment.ALIGN_NORMAL, 5)) }
        }

        add(separator())
        add(row("Subtotal / ລວມ", money(receipt.subtotal), regular))
        if (receipt.discount > 0) add(row("Discount / ສ່ວນຫຼຸດ", "-${money(receipt.discount)}", regular))
        if (receipt.serviceCharge > 0) add(row("Service charge", money(receipt.serviceCharge), regular))
        if (receipt.vat > 0) add(row("VAT", money(receipt.vat), regular))
        add(row("TOTAL / ຍອດສຸດທ້າຍ", "${money(receipt.grandTotal)} ${receipt.currency}", total, 14))
        add(separator())
        add(row("Payment", receipt.payment.method, regular))
        if (receipt.payment.receivedAmount > 0) add(row("Received / ຮັບມາ", money(receipt.payment.receivedAmount), regular))
        if (receipt.payment.changeAmount > 0) add(row("Change / ເງິນທອນ", money(receipt.payment.changeAmount), regular))
        add(textBlock("ขอบคุณที่ใช้บริการ / ຂອບໃຈ / Thank you", bold, Layout.Alignment.ALIGN_CENTER, 18))
        add(textBlock("KAIDEEDER POS", small, Layout.Alignment.ALIGN_CENTER, 16))
    }

    private fun buildStationBlocks(ticket: StationTicketPayload): List<Block> = buildList {
        add(textBlock(ticket.title, ticketTitle, Layout.Alignment.ALIGN_CENTER, 2))
        // เลขโต๊ะต้องใหญ่ที่สุดในหน้า — คนครัวมองปราดเดียวต้องรู้ว่าของโต๊ะไหน
        add(textBlock(ticket.tableName, tableHuge, Layout.Alignment.ALIGN_CENTER, 4))
        add(textBlock("#${ticket.orderNumber}   ${ticket.issuedAt}", regular, Layout.Alignment.ALIGN_CENTER, 8))
        add(separator(thick = true))

        var currentSection: String? = null
        ticket.items.forEach { item ->
            // หัวข้อกลุ่ม (เช่น เครื่องดื่มที่มาออกที่ครัวเพราะยังไม่มีเครื่องพิมพ์บาร์) แสดงครั้งเดียวตอนเปลี่ยนกลุ่ม
            if (item.section != null && item.section != currentSection) {
                currentSection = item.section
                add(separator())
                add(textBlock("— ${item.section} —", sectionHeader, Layout.Alignment.ALIGN_CENTER, 6))
            }
            add(itemRow(formatQuantity(item.quantity), item.name))
            // หมายเหตุเยื้องเข้าและตัวหนา ไม่ให้จมไปกับชื่อเมนู
            item.note?.let { add(indentedBlock(it, itemNote, 10)) }
        }

        add(separator(thick = true))
        ticket.orderNote?.let { add(textBlock(it, itemNote, Layout.Alignment.ALIGN_NORMAL, 8)) }
        ticket.footer?.let { add(textBlock(it, small, Layout.Alignment.ALIGN_CENTER, 6)) }
    }

    /** จำนวนตัวใหญ่ในคอลัมน์ซ้าย ชื่อเมนูตัดบรรทัดในคอลัมน์ขวา ไม่ล้นกัน */
    private fun itemRow(quantity: String, name: String): Block {
        val quantityLayout = layout(quantity, itemQuantity, QUANTITY_COLUMN_WIDTH - 8, Layout.Alignment.ALIGN_NORMAL)
        val nameLayout = layout(name, itemName, CONTENT_WIDTH - QUANTITY_COLUMN_WIDTH, Layout.Alignment.ALIGN_NORMAL)
        return Block(max(quantityLayout.height, nameLayout.height) + 10) { canvas, y ->
            canvas.save()
            canvas.translate(PADDING.toFloat(), y.toFloat())
            quantityLayout.draw(canvas)
            canvas.restore()

            canvas.save()
            canvas.translate((PADDING + QUANTITY_COLUMN_WIDTH).toFloat(), y.toFloat())
            nameLayout.draw(canvas)
            canvas.restore()
        }
    }

    private fun indentedBlock(text: String, paint: TextPaint, bottomPadding: Int): Block {
        val textLayout = layout(text, paint, CONTENT_WIDTH - QUANTITY_COLUMN_WIDTH, Layout.Alignment.ALIGN_NORMAL)
        return Block(textLayout.height + bottomPadding) { canvas, y ->
            canvas.save()
            canvas.translate((PADDING + QUANTITY_COLUMN_WIDTH).toFloat(), y.toFloat())
            textLayout.draw(canvas)
            canvas.restore()
        }
    }

    private fun textBlock(
        text: String,
        paint: TextPaint,
        alignment: Layout.Alignment,
        bottomPadding: Int
    ): Block {
        val layout = layout(text, paint, CONTENT_WIDTH, alignment)
        return Block(layout.height + bottomPadding) { canvas, y ->
            canvas.save()
            canvas.translate(PADDING.toFloat(), y.toFloat())
            layout.draw(canvas)
            canvas.restore()
        }
    }

    private fun row(label: String, value: String, paint: TextPaint, bottomPadding: Int = 7): Block {
        val lineHeight = ceil(paint.fontMetrics.descent - paint.fontMetrics.ascent).toInt() + bottomPadding
        return Block(lineHeight) { canvas, y ->
            val baseline = y - paint.fontMetrics.ascent
            canvas.drawText(label.take(34), PADDING.toFloat(), baseline, paint)
            canvas.drawText(value, (PRINTER_WIDTH_PX - PADDING).toFloat(), baseline, Paint(paint).apply {
                textAlign = Paint.Align.RIGHT
            })
        }
    }

    private fun separator(thick: Boolean = false): Block = Block(if (thick) 21 else 17) { canvas, y ->
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            strokeWidth = if (thick) 4f else 1.5f
        }
        val lineY = (y + if (thick) 9 else 7).toFloat()
        canvas.drawLine(PADDING.toFloat(), lineY, (PRINTER_WIDTH_PX - PADDING).toFloat(), lineY, paint)
    }

    private fun layout(text: String, paint: TextPaint, width: Int, alignment: Layout.Alignment): StaticLayout =
        StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
            .setAlignment(alignment)
            .setIncludePad(false)
            .setLineSpacing(2f, 1f)
            .build()

    private fun money(value: Double): String = moneyFormat.format(value)

    private fun formatQuantity(value: Double): String =
        if (value % 1.0 == 0.0) value.toLong().toString() else moneyFormat.format(value)

    private data class Block(val height: Int, val drawer: (Canvas, Int) -> Unit) {
        fun draw(canvas: Canvas, y: Int) = drawer(canvas, y)
    }

    companion object {
        const val PRINTER_WIDTH_PX = 576
        private const val PADDING = 24
        private const val CONTENT_WIDTH = PRINTER_WIDTH_PX - PADDING * 2
        /** คอลัมน์จำนวนในสลิปครัว — กว้างพอสำหรับ "12" หรือ "1.5" ที่ 44px */
        private const val QUANTITY_COLUMN_WIDTH = 84
        private const val MAX_BITMAP_HEIGHT = 20_000
    }
}
