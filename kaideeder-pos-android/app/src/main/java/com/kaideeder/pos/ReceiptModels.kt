package com.kaideeder.pos

import org.json.JSONObject
import java.util.Locale

enum class ReceiptType { ORIGINAL, REPRINT }

data class ReceiptStore(
    val name: String,
    val nameLao: String?,
    val phone: String?,
    val address: String?,
    val taxId: String?,
    val receiptHeader: String?,
    val logoUrl: String?
)

data class ReceiptItem(
    val name: String,
    val quantity: Double,
    val unitPrice: Double,
    val total: Double,
    val note: String?
)

data class ReceiptPayment(
    val method: String,
    val receivedAmount: Double,
    val changeAmount: Double
)

data class ReceiptOptions(
    val openCashDrawer: Boolean,
    val cutPaper: Boolean
)

data class ReceiptPayload(
    val schemaVersion: Int,
    val requestId: String,
    val receiptType: ReceiptType,
    val orderId: String,
    val receiptNo: String,
    val saleDateTime: String,
    val store: ReceiptStore,
    val cashier: String?,
    val items: List<ReceiptItem>,
    val subtotal: Double,
    val discount: Double,
    val serviceCharge: Double,
    val vat: Double,
    val grandTotal: Double,
    val currency: String,
    val payment: ReceiptPayment,
    val options: ReceiptOptions,
    val qrText: String?
) {
    companion object {
        private const val MAX_PAYLOAD_BYTES = 256 * 1024
        private const val MAX_ITEMS = 200

        fun fromJson(raw: String, forcedType: ReceiptType? = null): ReceiptPayload {
            require(raw.toByteArray(Charsets.UTF_8).size <= MAX_PAYLOAD_BYTES) {
                "Receipt payload exceeds 256 KB"
            }

            val json = JSONObject(raw)
            val schemaVersion = json.getInt("schemaVersion")
            require(schemaVersion == 1) { "Unsupported receipt schema version" }

            val payloadType = runCatching {
                ReceiptType.valueOf(json.getString("receiptType").uppercase(Locale.US))
            }.getOrElse { throw IllegalArgumentException("Invalid receipt type") }
            if (forcedType != null) require(payloadType == forcedType) { "Receipt type does not match command" }

            val itemsJson = json.getJSONArray("items")
            require(itemsJson.length() in 1..MAX_ITEMS) { "Receipt must contain 1 to $MAX_ITEMS items" }
            val items = buildList(itemsJson.length()) {
                for (index in 0 until itemsJson.length()) {
                    val item = itemsJson.getJSONObject(index)
                    add(
                        ReceiptItem(
                            name = item.requiredText("name", 200),
                            quantity = item.requiredPositiveNumber("quantity"),
                            unitPrice = item.requiredMoney("unitPrice"),
                            total = item.requiredMoney("total"),
                            note = item.optionalText("note", 300)
                        )
                    )
                }
            }

            val storeJson = json.getJSONObject("store")
            val paymentJson = json.getJSONObject("payment")
            val optionsJson = json.getJSONObject("options")

            return ReceiptPayload(
                schemaVersion = schemaVersion,
                requestId = json.requiredText("requestId", 180),
                receiptType = payloadType,
                orderId = json.requiredText("orderId", 100),
                receiptNo = json.requiredText("receiptNo", 80),
                saleDateTime = json.requiredText("saleDateTime", 80),
                store = ReceiptStore(
                    name = storeJson.requiredText("name", 150),
                    nameLao = storeJson.optionalText("nameLao", 150),
                    phone = storeJson.optionalText("phone", 80),
                    address = storeJson.optionalText("address", 300),
                    taxId = storeJson.optionalText("taxId", 80),
                    receiptHeader = storeJson.optionalText("receiptHeader", 500),
                    logoUrl = storeJson.optionalText("logoUrl", 500)
                ),
                cashier = json.optionalText("cashier", 120),
                items = items,
                subtotal = json.requiredMoney("subtotal"),
                discount = json.requiredMoney("discount"),
                serviceCharge = json.requiredMoney("serviceCharge"),
                vat = json.requiredMoney("vat"),
                grandTotal = json.requiredMoney("grandTotal"),
                currency = json.requiredText("currency", 12).uppercase(Locale.US),
                payment = ReceiptPayment(
                    method = paymentJson.requiredText("method", 30).uppercase(Locale.US),
                    receivedAmount = paymentJson.requiredMoney("receivedAmount"),
                    changeAmount = paymentJson.requiredMoney("changeAmount")
                ),
                options = ReceiptOptions(
                    openCashDrawer = optionsJson.optBoolean("openCashDrawer", false),
                    cutPaper = optionsJson.optBoolean("cutPaper", true)
                ),
                qrText = json.optionalText("qrText", 1500)
            )
        }

        private fun JSONObject.requiredText(key: String, maxLength: Int): String {
            val value = cleanText(getString(key), maxLength)
            require(value.isNotBlank()) { "$key is required" }
            return value
        }

        private fun JSONObject.optionalText(key: String, maxLength: Int): String? {
            if (!has(key) || isNull(key)) return null
            return cleanText(optString(key), maxLength).ifBlank { null }
        }

        private fun JSONObject.requiredMoney(key: String): Double {
            val value = getDouble(key)
            require(value.isFinite() && value >= 0.0) { "$key must be a non-negative number" }
            return value
        }

        private fun JSONObject.requiredPositiveNumber(key: String): Double {
            val value = getDouble(key)
            require(value.isFinite() && value > 0.0) { "$key must be a positive number" }
            return value
        }

        private fun cleanText(value: String, maxLength: Int): String = value
            .replace(Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]"), "")
            .trim()
            .take(maxLength)
    }
}
