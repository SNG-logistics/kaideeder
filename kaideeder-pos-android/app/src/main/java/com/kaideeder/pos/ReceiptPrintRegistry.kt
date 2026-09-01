package com.kaideeder.pos

import android.content.Context
import org.json.JSONArray

class ReceiptPrintRegistry(context: Context) {
    private val preferences = context.getSharedPreferences("receipt-print-registry-v1", Context.MODE_PRIVATE)

    @Synchronized
    fun hasOriginal(orderId: String): Boolean = readKeys().contains(key(orderId))

    @Synchronized
    fun rememberOriginal(orderId: String) {
        val receiptKey = key(orderId)
        val keys = readKeys().filterNot { it == receiptKey }.toMutableList()
        keys.add(receiptKey)
        val limited = keys.takeLast(MAX_RECORDS)
        preferences.edit().putString(KEY, JSONArray(limited).toString()).apply()
    }

    private fun readKeys(): List<String> = runCatching {
        val array = JSONArray(preferences.getString(KEY, "[]"))
        buildList(array.length()) {
            for (index in 0 until array.length()) add(array.getString(index))
        }
    }.getOrDefault(emptyList())

    private fun key(orderId: String) = "$orderId:ORIGINAL"

    companion object {
        private const val KEY = "printed-originals"
        private const val MAX_RECORDS = 250
    }
}
