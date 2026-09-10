package com.kaideeder.pos

import com.sunmi.peripheral.printer.SunmiPrinterService

class CashDrawerManager(private val settings: PosSettings) {
    fun openForReceipt(service: SunmiPrinterService, receipt: ReceiptPayload): PrinterStatus {
        if (!receipt.options.openCashDrawer) {
            return PrinterStatus.accepted("DRAWER_NOT_REQUESTED", "Cash drawer was not requested")
        }
        if (receipt.payment.method != "CASH") {
            return PrinterStatus.error("DRAWER_BLOCKED", "Cash drawer is allowed only for cash payment")
        }
        return open(service)
    }

    fun openManual(service: SunmiPrinterService): PrinterStatus = open(service)

    private fun open(service: SunmiPrinterService): PrinterStatus {
        if (!settings.cashDrawerEnabled) {
            return PrinterStatus.error("DRAWER_DISABLED", "Cash drawer is disabled in app settings")
        }
        return runCatching {
            service.openDrawer(null)
            PrinterStatus.accepted("DRAWER_QUEUED", "Cash drawer command accepted")
        }.getOrElse { error ->
            PrinterStatus.error("DRAWER_ERROR", error.message ?: "Cash drawer command failed")
        }
    }
}
