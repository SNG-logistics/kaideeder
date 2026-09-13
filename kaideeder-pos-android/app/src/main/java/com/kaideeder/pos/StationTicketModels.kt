package com.kaideeder.pos

import org.json.JSONObject
import java.util.Locale

/** ปลายทางของสลิป — เครื่องพิมพ์ในวงแลนเดียวกับแท็บเล็ต */
data class StationPrinterAddress(
    val host: String,
    val port: Int
)

/**
 * หนึ่งบรรทัดในสลิปครัว/บาร์
 * [note] อาจมีหลายบรรทัด (ท็อปปิ้ง + หมายเหตุลูกค้า) หน้าเว็บเป็นคนใส่เครื่องหมายนำหน้ามาแล้ว
 * [section] หัวข้อกลุ่ม เช่น "เครื่องดื่ม" ใช้ตอนรวมรายการบาร์เข้าสลิปครัวเพราะยังไม่มีเครื่องพิมพ์บาร์
 */
data class StationTicketItem(
    val name: String,
    val quantity: Double,
    val note: String?,
    val section: String?
)

data class StationTicketOptions(
    val cutPaper: Boolean,
    val copies: Int
)

/**
 * สลิปครัว/บาร์ schema v1 — ส่งจาก window.AndroidPOS.printStationTicket(payloadJson)
 * แยกจาก ReceiptPayload เพราะไม่มีเรื่องเงินเลย มีแต่ "โต๊ะไหน สั่งอะไร กี่ที่ หมายเหตุอะไร"
 */
data class StationTicketPayload(
    val schemaVersion: Int,
    val requestId: String,
    val station: String,
    val printer: StationPrinterAddress,
    val title: String,
    val tableName: String,
    val orderNumber: String,
    val issuedAt: String,
    val orderNote: String?,
    val footer: String?,
    val items: List<StationTicketItem>,
    val options: StationTicketOptions
) {
    companion object {
        private const val MAX_PAYLOAD_BYTES = 256 * 1024
        private const val MAX_ITEMS = 200
        private const val MAX_COPIES = 3
        private val STATIONS = setOf("KITCHEN", "BAR")

        /** IPv4 หรือชื่อโฮสต์ธรรมดา — ไม่รับช่องว่าง, เครื่องหมายอื่น หรือจุดติดกัน */
        private val HOST_PATTERN = Regex("^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$")

        fun fromJson(raw: String): StationTicketPayload {
            require(raw.toByteArray(Charsets.UTF_8).size <= MAX_PAYLOAD_BYTES) {
                "Ticket payload exceeds 256 KB"
            }

            val json = JSONObject(raw)
            val schemaVersion = json.getInt("schemaVersion")
            require(schemaVersion == 1) { "Unsupported ticket schema version" }

            val station = json.requiredText("station", 20).uppercase(Locale.US)
            require(station in STATIONS) { "station must be KITCHEN or BAR" }

            val printerJson = json.getJSONObject("printer")
            val host = printerJson.requiredText("host", 253)
            require(HOST_PATTERN.matches(host) && !host.contains("..")) { "printer.host is not a valid IP or host name" }
            val port = printerJson.optInt("port", 9100)
            require(port in 1..65535) { "printer.port must be between 1 and 65535" }

            val itemsJson = json.getJSONArray("items")
            require(itemsJson.length() in 1..MAX_ITEMS) { "Ticket must contain 1 to $MAX_ITEMS items" }
            val items = buildList(itemsJson.length()) {
                for (index in 0 until itemsJson.length()) {
                    val item = itemsJson.getJSONObject(index)
                    add(
                        StationTicketItem(
                            name = item.requiredText("name", 200),
                            quantity = item.requiredPositiveNumber("quantity"),
                            note = item.optionalText("note", 400),
                            section = item.optionalText("section", 60)
                        )
                    )
                }
            }

            val optionsJson = json.optJSONObject("options") ?: JSONObject()
            val copies = optionsJson.optInt("copies", 1)
            require(copies in 1..MAX_COPIES) { "options.copies must be between 1 and $MAX_COPIES" }

            return StationTicketPayload(
                schemaVersion = schemaVersion,
                requestId = json.requiredText("requestId", 180),
                station = station,
                printer = StationPrinterAddress(host = host, port = port),
                title = json.requiredText("title", 60),
                tableName = json.requiredText("tableName", 60),
                orderNumber = json.requiredText("orderNumber", 80),
                issuedAt = json.requiredText("issuedAt", 80),
                orderNote = json.optionalText("orderNote", 300),
                footer = json.optionalText("footer", 80),
                items = items,
                options = StationTicketOptions(
                    cutPaper = optionsJson.optBoolean("cutPaper", true),
                    copies = copies
                )
            )
        }
    }
}
