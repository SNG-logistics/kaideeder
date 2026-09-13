package com.kaideeder.pos

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class StationTicketPayloadTest {
    @Test
    fun parsesKitchenTicketWithDrinksSection() {
        val ticket = StationTicketPayload.fromJson(validTicket().toString())

        assertEquals("KITCHEN", ticket.station)
        assertEquals("192.168.1.51", ticket.printer.host)
        assertEquals(9100, ticket.printer.port)
        assertEquals("โต๊ะ 12", ticket.tableName)
        assertEquals(2, ticket.items.size)
        assertNull(ticket.items[0].section)
        assertEquals("ເຄື່ອງດື່ມ / DRINKS", ticket.items[1].section)
        assertEquals("» ບໍ່ໃສ່ຜັກ\n+ ไข่ดาว", ticket.items[0].note)
        assertTrue(ticket.options.cutPaper)
        assertEquals(1, ticket.options.copies)
    }

    @Test
    fun defaultsPortAndOptionsWhenOmitted() {
        val json = validTicket()
        json.getJSONObject("printer").remove("port")
        json.remove("options")

        val ticket = StationTicketPayload.fromJson(json.toString())

        assertEquals(9100, ticket.printer.port)
        assertTrue(ticket.options.cutPaper)
        assertEquals(1, ticket.options.copies)
    }

    @Test
    fun rejectsHostWithSpacesOrGarbage() {
        listOf("192.168.1 .51", "192.168..51", "printer;rm", "-bad", "").forEach { host ->
            val json = validTicket()
            json.getJSONObject("printer").put("host", host)
            assertThrows("host=$host", IllegalArgumentException::class.java) {
                StationTicketPayload.fromJson(json.toString())
            }
        }
    }

    @Test
    fun rejectsPortOutOfRange() {
        listOf(0, 65536, -1).forEach { port ->
            val json = validTicket()
            json.getJSONObject("printer").put("port", port)
            assertThrows("port=$port", IllegalArgumentException::class.java) {
                StationTicketPayload.fromJson(json.toString())
            }
        }
    }

    @Test
    fun rejectsEmptyItemsAndUnknownStation() {
        assertThrows(IllegalArgumentException::class.java) {
            StationTicketPayload.fromJson(validTicket().put("items", JSONArray()).toString())
        }
        assertThrows(IllegalArgumentException::class.java) {
            StationTicketPayload.fromJson(validTicket().put("station", "PATIO").toString())
        }
    }

    @Test
    fun rejectsTooManyCopies() {
        val json = validTicket().put("options", JSONObject().put("copies", 4))
        assertThrows(IllegalArgumentException::class.java) {
            StationTicketPayload.fromJson(json.toString())
        }
    }

    private fun validTicket(): JSONObject = JSONObject()
        .put("schemaVersion", 1)
        .put("requestId", "order-1:KITCHEN:test")
        .put("station", "KITCHEN")
        .put("printer", JSONObject().put("host", "192.168.1.51").put("port", 9100))
        .put("title", "ครัว / KITCHEN")
        .put("tableName", "โต๊ะ 12")
        .put("orderNumber", "ORD-0012")
        .put("issuedAt", "14:32")
        .put("items", JSONArray()
            .put(JSONObject()
                .put("name", "ເຂົ້າຜັດ / ข้าวผัด")
                .put("quantity", 2)
                .put("note", "» ບໍ່ໃສ່ຜັກ\n+ ไข่ดาว"))
            .put(JSONObject()
                .put("name", "Beerlao")
                .put("quantity", 1)
                .put("section", "ເຄື່ອງດື່ມ / DRINKS")))
        .put("options", JSONObject().put("cutPaper", true).put("copies", 1))
}
