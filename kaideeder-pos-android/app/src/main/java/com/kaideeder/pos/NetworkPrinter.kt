package com.kaideeder.pos

import android.graphics.Bitmap
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.net.ConnectException
import java.net.InetSocketAddress
import java.net.NoRouteToHostException
import java.net.Socket
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

/**
 * ส่งสลิปครัว/บาร์จากแท็บเล็ตไปเครื่องพิมพ์ในวงแลนเดียวกันโดยตรง (TCP พอร์ต 9100, ESC/POS)
 *
 * ทำไมต้องเป็นแท็บเล็ตส่ง — เซิร์ฟเวอร์ของ KAIDEEDER อยู่ที่ดาต้าเซ็นเตอร์ มองไม่เห็นเลขวงใน
 * (192.168.x.x) ของร้าน ส่งจากที่นั่นไปไม่ถึงเครื่องพิมพ์แน่นอน
 *
 * งานพิมพ์เข้าคิวบนเธรดเดียว งานถัดไปรอให้งานก่อนหน้าส่งจบ กันสลิปสองใบวิ่งชนกันบน socket
 * ของเครื่องพิมพ์ตัวเดียว ผลลัพธ์ส่งกลับผ่าน [onResult] แบบไม่บล็อกหน้าเว็บ:
 * JS bridge ตอบ PRINT_QUEUED ทันที แล้วหน้าเว็บรอ event ผลลัพธ์ต่างหาก
 * ถ้าทำแบบบล็อก หน้าขายจะค้าง 5 วินาทีทุกครั้งที่เครื่องพิมพ์ปิดอยู่
 */
class NetworkPrinter(
    private val formatter: ReceiptFormatter,
    private val onResult: (requestId: String, status: PrinterStatus) -> Unit
) {
    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "kaideeder-network-printer").apply { isDaemon = true }
    }

    /** ตัวเฝ้า — ปิด socket ที่ค้างนานผิดปกติ ไม่งั้นงานเดียวที่ค้างจะขวางคิวทั้งหมดจนกว่าจะเปิดแอปใหม่ */
    private val watchdog = Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "kaideeder-network-printer-watchdog").apply { isDaemon = true }
    }

    /** เข้าคิวแล้วคืนค่าทันที ผลจริงจะมาทาง [onResult] พร้อม requestId เดิม */
    fun enqueue(ticket: StationTicketPayload): PrinterStatus = try {
        executor.execute { onResult(ticket.requestId, printNow(ticket)) }
        PrinterStatus.accepted("PRINT_QUEUED", "Ticket queued for ${ticket.printer.host}:${ticket.printer.port}")
    } catch (error: RejectedExecutionException) {
        PrinterStatus.error("PRINTER_BUSY", "Print queue is shutting down")
    }

    fun shutdown() {
        executor.shutdownNow()
        watchdog.shutdownNow()
    }

    /** พิมพ์ทันทีบนเธรดปัจจุบัน — ห้ามเรียกจาก main thread (Android ห้ามใช้เครือข่ายบนนั้น) */
    fun printNow(ticket: StationTicketPayload): PrinterStatus {
        var bitmap: Bitmap? = null
        val target = "${ticket.printer.host}:${ticket.printer.port}"
        return try {
            bitmap = formatter.renderStationTicket(ticket)
            val job = buildJob(bitmap, ticket.options)
            send(ticket.printer.host, ticket.printer.port, job)
            PrinterStatus.accepted("PRINT_ACCEPTED", "Ticket sent to $target")
        } catch (error: SocketTimeoutException) {
            PrinterStatus.error("PRINTER_TIMEOUT", "Printer $target did not answer within ${CONNECT_TIMEOUT_MS / 1000}s")
        } catch (error: UnknownHostException) {
            PrinterStatus.error("PRINTER_UNREACHABLE", "Unknown printer host ${ticket.printer.host}")
        } catch (error: ConnectException) {
            PrinterStatus.error("PRINTER_UNREACHABLE", "Printer $target refused the connection")
        } catch (error: NoRouteToHostException) {
            PrinterStatus.error("PRINTER_UNREACHABLE", "No route to printer $target")
        } catch (error: IllegalArgumentException) {
            PrinterStatus.error("INVALID_REQUEST", error.message ?: "Invalid ticket")
        } catch (error: Exception) {
            PrinterStatus.error("NETWORK_PRINT_ERROR", error.message ?: "Network print failed")
        } finally {
            bitmap?.recycle()
        }
    }

    private fun buildJob(bitmap: Bitmap, options: StationTicketOptions): ByteArray {
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        val raster = EscPos.rasterImage(pixels, bitmap.width, bitmap.height)

        val single = ByteArrayOutputStream(raster.size + 16).apply {
            write(EscPos.initialize())
            write(raster)
            write(EscPos.feedLines(FEED_LINES_AFTER_TICKET))
            if (options.cutPaper) write(EscPos.cutPaper())
        }.toByteArray()
        if (options.copies <= 1) return single

        return ByteArrayOutputStream(single.size * options.copies).apply {
            repeat(options.copies) { write(single) }
        }.toByteArray()
    }

    private fun send(host: String, port: Int, data: ByteArray) {
        val socket = Socket()
        // ถ้าเครื่องพิมพ์รับข้อมูลแล้วหยุดกลางคัน (กระดาษหมด ค้าง) write จะบล็อกไม่มีกำหนด — ตัดทิ้งหลังครบเวลา
        val killer = watchdog.schedule({ runCatching { socket.close() } }, JOB_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        try {
            socket.soTimeout = CONNECT_TIMEOUT_MS
            socket.connect(InetSocketAddress(host, port), CONNECT_TIMEOUT_MS)
            val out = BufferedOutputStream(socket.getOutputStream(), 8 * 1024)
            out.write(data)
            out.flush()
            // ปิดฝั่งส่งอย่างสุภาพ — ข้อมูลที่ค้างในบัฟเฟอร์ของระบบยังถูกส่งจนครบก่อน FIN
            runCatching { socket.shutdownOutput() }
        } finally {
            killer.cancel(false)
            runCatching { socket.close() }
        }
    }

    companion object {
        /** เวลารอเชื่อมต่อ — ถ้าเครื่องพิมพ์ปิดหรือสายหลุด ต้องรู้ผลภายในเวลานี้ ไม่ค้าง */
        const val CONNECT_TIMEOUT_MS = 5_000

        /** เพดานเวลาทั้งงาน (เชื่อมต่อ + ส่งข้อมูล) ก่อนตัวเฝ้าจะปิด socket ทิ้ง */
        const val JOB_TIMEOUT_MS = 20_000L

        /** เดินกระดาษก่อนตัด ให้บรรทัดสุดท้ายพ้นใบมีดแน่ ๆ */
        private const val FEED_LINES_AFTER_TICKET = 3
    }
}
