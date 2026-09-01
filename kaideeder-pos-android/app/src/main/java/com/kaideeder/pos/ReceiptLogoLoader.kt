package com.kaideeder.pos

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

class ReceiptLogoLoader(private val settings: PosSettings) {
    fun load(urlValue: String?): Bitmap? {
        if (urlValue.isNullOrBlank()) return null
        val uri = Uri.parse(urlValue)
        require(settings.isTrustedAssetUri(uri)) { "Logo URL is not trusted" }

        val connection = (URL(urlValue).openConnection() as HttpURLConnection).apply {
            connectTimeout = 3_000
            readTimeout = 3_000
            instanceFollowRedirects = false
            requestMethod = "GET"
            setRequestProperty("Accept", "image/png,image/jpeg,image/webp")
        }

        try {
            require(connection.responseCode in 200..299) { "Logo download failed" }
            require(connection.contentType?.startsWith("image/") == true) { "Logo response is not an image" }
            require(connection.contentLength <= MAX_LOGO_BYTES || connection.contentLength < 0) {
                "Logo image is too large"
            }

            val output = ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(8 * 1024)
                var total = 0
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    total += count
                    require(total <= MAX_LOGO_BYTES) { "Logo image is too large" }
                    output.write(buffer, 0, count)
                }
            }

            val bytes = output.toByteArray()
            val bitmap = requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size)) {
                "Logo image cannot be decoded"
            }
            if (bitmap.width <= MAX_LOGO_WIDTH) return bitmap

            val height = (bitmap.height.toLong() * MAX_LOGO_WIDTH / bitmap.width).toInt().coerceAtLeast(1)
            val scaled = Bitmap.createScaledBitmap(bitmap, MAX_LOGO_WIDTH, height, true)
            bitmap.recycle()
            return scaled
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val MAX_LOGO_BYTES = 512 * 1024
        private const val MAX_LOGO_WIDTH = 420
    }
}
