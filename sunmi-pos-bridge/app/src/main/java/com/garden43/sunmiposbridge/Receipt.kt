package com.garden43.sunmiposbridge

import org.json.JSONObject

data class ReceiptItem(
    val name: String,
    val quantity: Double,
    val unitPrice: Long,
    val total: Long
)

data class Receipt(
    val receiptNo: String,
    val dateTime: String,
    val cashier: String,
    val items: List<ReceiptItem>,
    val subtotal: Long,
    val discount: Long,
    val grandTotal: Long,
    val paymentMethod: String,
    val qrText: String?,
    val logoPngBase64: String?,
    val openCashDrawer: Boolean,
    val cutPaper: Boolean
) {
    companion object {
        private const val MAX_PAYLOAD_CHARS = 768_000
        private const val MAX_LOGO_CHARS = 700_000

        fun fromJson(raw: String): Receipt {
            require(raw.length <= MAX_PAYLOAD_CHARS) { "Receipt payload is too large" }
            val json = JSONObject(raw)
            val rows = json.getJSONArray("items")
            require(rows.length() in 1..200) { "Receipt must contain 1-200 items" }

            val items = (0 until rows.length()).map { index ->
                val row = rows.getJSONObject(index)
                val quantity = row.getDouble("quantity")
                val unitPrice = row.getLong("unitPrice")
                val total = row.optLong("total", (quantity * unitPrice).toLong())
                require(quantity.isFinite() && quantity > 0) { "Item $index has an invalid quantity" }
                require(unitPrice >= 0 && total >= 0) { "Item $index has an invalid amount" }
                ReceiptItem(
                    name = row.getString("name").trim().take(80).ifBlank { "รายการ" },
                    quantity = quantity,
                    unitPrice = unitPrice,
                    total = total
                )
            }

            val subtotal = json.getLong("subtotal")
            val discount = json.optLong("discount", 0)
            val grandTotal = json.getLong("grandTotal")
            require(subtotal >= 0 && discount >= 0 && grandTotal >= 0) { "Receipt has an invalid total" }

            val logo = json.optString("logoPngBase64").trim()
                .takeIf { it.isNotEmpty() }
                ?.also { require(it.length <= MAX_LOGO_CHARS) { "Logo image is too large" } }

            return Receipt(
                receiptNo = json.getString("receiptNo").trim().take(50).ifBlank { "-" },
                dateTime = json.optString("dateTime").trim().take(40),
                cashier = json.optString("cashier").trim().take(50),
                items = items,
                subtotal = subtotal,
                discount = discount,
                grandTotal = grandTotal,
                paymentMethod = json.optString("paymentMethod", "CASH").trim().take(30),
                qrText = json.optString("qrText").trim().takeIf { it.isNotEmpty() }?.take(500),
                logoPngBase64 = logo,
                openCashDrawer = json.optBoolean("openCashDrawer", false),
                cutPaper = json.optBoolean("cutPaper", true)
            )
        }
    }
}
