package com.kaideeder.pos

import java.io.ByteArrayOutputStream

/**
 * ประกอบคำสั่ง ESC/POS สำหรับเครื่องพิมพ์เครือข่าย (พอร์ต 9100)
 *
 * ส่งสลิปเป็น "รูป" (raster bit image) ล้วน ไม่ส่งเป็นข้อความ เพราะ firmware ของเครื่องพิมพ์
 * ส่วนใหญ่ไม่มีฟอนต์ไทย/ลาว ส่งข้อความไปจะได้กล่องสี่เหลี่ยมหรือตัวอักษรยุโรปเพี้ยน ๆ
 * แยกจาก android.graphics ไว้ทั้งหมดเพื่อให้ทดสอบบน JVM ได้
 */
object EscPos {
    private const val ESC = 0x1B
    private const val GS = 0x1D

    /**
     * จำนวนแถวต่อคำสั่ง GS v 0 หนึ่งชุด — บาง firmware มีบัฟเฟอร์เล็ก
     * แบ่งรูปเป็นแถบสั้น ๆ ส่งทีละชุดปลอดภัยกว่ายัดทั้งรูปในคำสั่งเดียว
     */
    const val RASTER_STRIP_ROWS = 256

    /**
     * พิกเซลที่สว่างน้อยกว่าค่านี้ (0-255) ถือว่าเป็นสีดำ
     * ตั้งไว้สูงกว่า 128 เล็กน้อย ให้ขอบตัวหนังสือที่ anti-alias กลายเป็นดำ ตัวอักษรจะดูหนาขึ้นบนกระดาษความร้อน
     */
    const val BLACK_THRESHOLD = 160

    /** ESC @ — รีเซ็ตเครื่องพิมพ์ให้อยู่ค่าเริ่มต้นก่อนเริ่มงาน */
    fun initialize(): ByteArray = byteArrayOf(ESC.toByte(), '@'.code.toByte())

    /** ESC d n — เดินกระดาษ n บรรทัด */
    fun feedLines(lines: Int): ByteArray =
        byteArrayOf(ESC.toByte(), 'd'.code.toByte(), lines.coerceIn(0, 255).toByte())

    /** GS V 66 0 — เดินกระดาษไปถึงตำแหน่งใบมีดแล้วตัด รูปแบบที่เครื่องพิมพ์ยุคใหม่รองรับกว้างที่สุด */
    fun cutPaper(): ByteArray = byteArrayOf(GS.toByte(), 'V'.code.toByte(), 66, 0)

    /**
     * แปลงพิกเซล ARGB เป็นคำสั่ง GS v 0 (raster bit image) หลายแถบต่อกัน
     * ในแต่ละไบต์ บิตสูงสุดคือพิกเซลซ้ายสุด บิต 1 = ดำ
     *
     * @param pixels ARGB เรียงทีละแถว ความยาวอย่างน้อย width * height
     */
    fun rasterImage(pixels: IntArray, width: Int, height: Int): ByteArray {
        require(width > 0 && height > 0) { "Image must not be empty" }
        require(pixels.size >= width * height) { "Pixel buffer is smaller than width * height" }

        val bytesPerRow = (width + 7) / 8
        require(bytesPerRow <= 0xFFFF) { "Image is too wide for ESC/POS" }

        val strips = (height + RASTER_STRIP_ROWS - 1) / RASTER_STRIP_ROWS
        val out = ByteArrayOutputStream(bytesPerRow * height + strips * 8)
        var top = 0
        while (top < height) {
            val rows = minOf(RASTER_STRIP_ROWS, height - top)
            out.write(GS)
            out.write('v'.code)
            out.write('0'.code)
            out.write(0) // โหมดปกติ (ไม่ขยาย)
            out.write(bytesPerRow and 0xFF)
            out.write((bytesPerRow shr 8) and 0xFF)
            out.write(rows and 0xFF)
            out.write((rows shr 8) and 0xFF)

            for (y in top until top + rows) {
                val rowStart = y * width
                for (byteIndex in 0 until bytesPerRow) {
                    var packed = 0
                    for (bit in 0 until 8) {
                        val x = byteIndex * 8 + bit
                        if (x < width && isBlack(pixels[rowStart + x])) packed = packed or (0x80 ushr bit)
                    }
                    out.write(packed)
                }
            }
            top += rows
        }
        return out.toByteArray()
    }

    /** พิกเซลนี้ควรพิมพ์เป็นสีดำหรือไม่ — พิกเซลโปร่งใสถือเป็นพื้นกระดาษ */
    fun isBlack(argb: Int): Boolean {
        val alpha = (argb ushr 24) and 0xFF
        if (alpha < 128) return false
        val r = (argb shr 16) and 0xFF
        val g = (argb shr 8) and 0xFF
        val b = argb and 0xFF
        val luminance = (r * 299 + g * 587 + b * 114) / 1000
        return luminance < BLACK_THRESHOLD
    }
}
