package com.kaideeder.pos

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ReceiptPayloadTest {
    @Test
    fun parsesVersionedOriginalReceipt() {
        val receipt = ReceiptPayload.fromJson(validReceipt().toString(), ReceiptType.ORIGINAL)

        assertEquals("order-1", receipt.orderId)
        assertEquals(ReceiptType.ORIGINAL, receipt.receiptType)
        assertEquals("CASH", receipt.payment.method)
        assertTrue(receipt.options.openCashDrawer)
        assertEquals(1, receipt.items.size)
    }

    @Test
    fun rejectsReceiptTypeMismatch() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            ReceiptPayload.fromJson(validReceipt().toString(), ReceiptType.REPRINT)
        }
        assertTrue(error.message.orEmpty().contains("type"))
    }

    @Test
    fun rejectsEmptyItemList() {
        val json = validReceipt().put("items", JSONArray())
        assertThrows(IllegalArgumentException::class.java) {
            ReceiptPayload.fromJson(json.toString(), ReceiptType.ORIGINAL)
        }
    }

    @Test
    fun mapsOutOfPaperStateTruthfully() {
        val status = PrinterStatus.fromSunmiState(4)
        assertFalse(status.ok)
        assertEquals("OUT_OF_PAPER", status.code)
    }

    private fun validReceipt(): JSONObject = JSONObject()
        .put("schemaVersion", 1)
        .put("requestId", "order-1:ORIGINAL:test")
        .put("receiptType", "ORIGINAL")
        .put("orderId", "order-1")
        .put("receiptNo", "R-001")
        .put("saleDateTime", "2026-09-01T12:00:00+07:00")
        .put("store", JSONObject().put("name", "KAIDEEDER"))
        .put("items", JSONArray().put(
            JSONObject()
                .put("name", "ເຂົ້າຜັດ / ข้าวผัด")
                .put("quantity", 1)
                .put("unitPrice", 50_000)
                .put("total", 50_000)
        ))
        .put("subtotal", 50_000)
        .put("discount", 0)
        .put("serviceCharge", 0)
        .put("vat", 0)
        .put("grandTotal", 50_000)
        .put("currency", "LAK")
        .put("payment", JSONObject()
            .put("method", "CASH")
            .put("receivedAmount", 100_000)
            .put("changeAmount", 50_000)
        )
        .put("options", JSONObject()
            .put("openCashDrawer", true)
            .put("cutPaper", true)
        )
}
