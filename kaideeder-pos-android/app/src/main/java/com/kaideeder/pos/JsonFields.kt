package com.kaideeder.pos

import org.json.JSONObject

/**
 * ตัวช่วยอ่านค่าจาก JSON ที่หน้าเว็บส่งมา ใช้ร่วมกันทั้งใบเสร็จ (ReceiptModels) และสลิปครัว (StationTicketModels)
 * ทุกข้อความถูกล้างอักขระควบคุมและตัดความยาวก่อนเสมอ เพราะเป็นข้อมูลจากภายนอกเครื่อง
 */
internal fun JSONObject.requiredText(key: String, maxLength: Int): String {
    val value = cleanText(getString(key), maxLength)
    require(value.isNotBlank()) { "$key is required" }
    return value
}

internal fun JSONObject.optionalText(key: String, maxLength: Int): String? {
    if (!has(key) || isNull(key)) return null
    return cleanText(optString(key), maxLength).ifBlank { null }
}

internal fun JSONObject.requiredMoney(key: String): Double {
    val value = getDouble(key)
    require(value.isFinite() && value >= 0.0) { "$key must be a non-negative number" }
    return value
}

internal fun JSONObject.requiredPositiveNumber(key: String): Double {
    val value = getDouble(key)
    require(value.isFinite() && value > 0.0) { "$key must be a positive number" }
    return value
}

/** ตัดอักขระควบคุมทิ้ง แต่คงขึ้นบรรทัดใหม่ (\n) และแท็บไว้ เพราะหมายเหตุหลายบรรทัดต้องวาดได้ */
internal fun cleanText(value: String, maxLength: Int): String = value
    .replace(Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]"), "")
    .trim()
    .take(maxLength)
