package com.kaideeder.pos

import org.json.JSONObject

data class PrinterStatus(
    val ok: Boolean,
    val code: String,
    val message: String,
    val state: Int? = null
) {
    fun toJson(): String = JSONObject()
        .put("ok", ok)
        .put("code", code)
        .put("message", message)
        .apply { state?.let { put("state", it) } }
        .toString()

    companion object {
        fun fromSunmiState(state: Int): PrinterStatus = when (state) {
            1 -> PrinterStatus(true, "READY", "Printer is ready", state)
            2 -> PrinterStatus(false, "PREPARING", "Printer is preparing", state)
            3 -> PrinterStatus(false, "COMMUNICATION_ERROR", "Printer communication error", state)
            4 -> PrinterStatus(false, "OUT_OF_PAPER", "Printer is out of paper", state)
            5 -> PrinterStatus(false, "OVERHEATED", "Printer head is overheated", state)
            6 -> PrinterStatus(false, "COVER_OPEN", "Printer cover is open", state)
            7 -> PrinterStatus(false, "CUTTER_ERROR", "Printer cutter error", state)
            8 -> PrinterStatus(false, "CUTTER_RECOVERING", "Printer cutter is recovering", state)
            9 -> PrinterStatus(false, "BLACK_MARK_NOT_FOUND", "Black mark was not found", state)
            505 -> PrinterStatus(false, "UNSUPPORTED", "No built-in SUNMI printer", state)
            else -> PrinterStatus(false, "UNKNOWN_STATE", "Unknown printer state", state)
        }

        fun accepted(code: String, message: String): PrinterStatus =
            PrinterStatus(true, code, message)

        fun error(code: String, message: String): PrinterStatus =
            PrinterStatus(false, code, message.take(200))
    }
}
