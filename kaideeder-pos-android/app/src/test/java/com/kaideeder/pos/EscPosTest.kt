package com.kaideeder.pos

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class EscPosTest {
    private val black = 0xFF000000.toInt()
    private val white = 0xFFFFFFFF.toInt()
    private val transparent = 0x00000000

    @Test
    fun packsPixelsMsbFirstWithRasterHeader() {
        // 16 px กว้าง 2 แถว: แถวแรกดำเฉพาะพิกเซลซ้ายสุดกับขวาสุด แถวสองสลับดำขาว
        val row1 = IntArray(16) { if (it == 0 || it == 15) black else white }
        val row2 = IntArray(16) { if (it % 2 == 0) black else white }
        val bytes = EscPos.rasterImage(row1 + row2, 16, 2)

        val expected = byteArrayOf(
            0x1D, 'v'.code.toByte(), '0'.code.toByte(), 0,
            2, 0, // 2 ไบต์ต่อแถว
            2, 0, // 2 แถว
            0x80.toByte(), 0x01, // แถว 1
            0xAA.toByte(), 0xAA.toByte() // แถว 2
        )
        assertArrayEquals(expected, bytes)
    }

    @Test
    fun padsWidthThatIsNotMultipleOfEight() {
        val pixels = IntArray(10) { black }
        val bytes = EscPos.rasterImage(pixels, 10, 1)
        assertEquals(8 + 2, bytes.size)
        assertEquals(0xFF.toByte(), bytes[8])
        assertEquals(0xC0.toByte(), bytes[9]) // 2 พิกเซลสุดท้าย แล้วเติมขาว
    }

    @Test
    fun splitsTallImagesIntoStrips() {
        val height = EscPos.RASTER_STRIP_ROWS + 1
        val bytes = EscPos.rasterImage(IntArray(8 * height) { white }, 8, height)
        // สองชุดคำสั่ง: หัว 8 ไบต์ + ข้อมูล 1 ไบต์ต่อแถว
        assertEquals(8 * 2 + height, bytes.size)
        assertEquals(1, bytes[8 * 1 + EscPos.RASTER_STRIP_ROWS + 6].toInt()) // yL ของชุดที่สอง = 1
    }

    @Test
    fun treatsTransparentAndLightGreyAsPaper() {
        assertTrue(EscPos.isBlack(black))
        assertFalse(EscPos.isBlack(white))
        assertFalse(EscPos.isBlack(transparent))
        assertTrue(EscPos.isBlack(0xFF505050.toInt())) // เทาเข้มจาก anti-alias → ดำ
        assertFalse(EscPos.isBlack(0xFFC8C8C8.toInt())) // เทาอ่อน → ขาว
    }

    @Test
    fun rejectsEmptyImage() {
        assertThrows(IllegalArgumentException::class.java) { EscPos.rasterImage(IntArray(0), 0, 0) }
    }
}
