'use client'

export type AndroidPOSReceiptType = 'ORIGINAL' | 'REPRINT'

export interface AndroidPOSReceiptItem {
    name: string
    quantity: number
    unitPrice: number
    total: number
    note?: string
}

export interface AndroidPOSReceiptPayload {
    schemaVersion: 1
    requestId: string
    receiptType: AndroidPOSReceiptType
    orderId: string
    receiptNo: string
    saleDateTime: string
    store: {
        name: string
        nameLao?: string
        phone?: string
        address?: string
        taxId?: string
        receiptHeader?: string
        logoUrl?: string
    }
    cashier?: string
    items: AndroidPOSReceiptItem[]
    subtotal: number
    discount: number
    serviceCharge: number
    vat: number
    grandTotal: number
    currency: string
    payment: {
        method: string
        receivedAmount: number
        changeAmount: number
    }
    options: {
        openCashDrawer: boolean
        cutPaper: boolean
    }
    qrText?: string
}

export interface AndroidPOSResult {
    ok: boolean
    code: string
    message: string
}

interface AndroidPOSBridge {
    printReceipt(payloadJson: string): string
    reprintReceipt(payloadJson: string): string
    testPrint(): string
    getPrinterStatus(): string
    openCashDrawer(): string
    getDeviceInfo(): string
    getAppVersion(): string
    reload(): string
}

declare global {
    interface Window {
        AndroidPOS?: AndroidPOSBridge
    }
}

const PRINTED_RECEIPTS_KEY = 'kaideeder.android-pos.printed-receipts.v1'
const MAX_PRINT_RECORDS = 250
const REPRINT_GUARD_MS = 3000
const recentReprints = new Map<string, number>()

function getBridge(): AndroidPOSBridge | undefined {
    return typeof window === 'undefined' ? undefined : window.AndroidPOS
}

function parseBridgeResult(raw: string): AndroidPOSResult {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new Error('AndroidPOS returned malformed JSON')
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('AndroidPOS returned an invalid response')
    }

    const value = parsed as Record<string, unknown>
    if (typeof value.ok !== 'boolean') {
        throw new Error('AndroidPOS response is missing ok')
    }

    return {
        ok: value.ok,
        code: typeof value.code === 'string'
            ? value.code
            : value.ok ? 'OK' : 'NATIVE_ERROR',
        message: typeof value.message === 'string' ? value.message : '',
    }
}

function originalPrintKey(orderId: string): string {
    return `${orderId}:ORIGINAL`
}

function readPrintedReceipts(): string[] {
    if (typeof window === 'undefined') return []
    try {
        const parsed = JSON.parse(window.localStorage.getItem(PRINTED_RECEIPTS_KEY) ?? '[]')
        return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
    } catch {
        return []
    }
}

function rememberOriginalPrint(orderId: string): void {
    if (typeof window === 'undefined') return
    try {
        const key = originalPrintKey(orderId)
        const entries = readPrintedReceipts().filter(entry => entry !== key)
        entries.push(key)
        window.localStorage.setItem(PRINTED_RECEIPTS_KEY, JSON.stringify(entries.slice(-MAX_PRINT_RECORDS)))
    } catch {
        // Printing must not fail because browser storage is unavailable.
    }
}

export function isAndroidPOSApp(): boolean {
    return Boolean(getBridge())
}

export function hasPrintedOriginalReceipt(orderId: string): boolean {
    return readPrintedReceipts().includes(originalPrintKey(orderId))
}

export function createReceiptRequestId(orderId: string, receiptType: AndroidPOSReceiptType): string {
    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return `${orderId}:${receiptType}:${random}`
}

export function printAndroidPOSReceipt(payload: AndroidPOSReceiptPayload): AndroidPOSResult {
    const bridge = getBridge()
    if (!bridge) {
        return { ok: false, code: 'BRIDGE_UNAVAILABLE', message: 'AndroidPOS bridge is unavailable' }
    }

    if (payload.receiptType !== 'ORIGINAL') {
        return { ok: false, code: 'INVALID_RECEIPT_TYPE', message: 'Use reprintReceipt for a reprint' }
    }

    if (hasPrintedOriginalReceipt(payload.orderId)) {
        return { ok: false, code: 'DUPLICATE_BLOCKED', message: 'Original receipt was already submitted' }
    }

    const result = parseBridgeResult(bridge.printReceipt(JSON.stringify(payload)))
    if (result.ok) rememberOriginalPrint(payload.orderId)
    return result
}

export function reprintAndroidPOSReceipt(payload: AndroidPOSReceiptPayload): AndroidPOSResult {
    const bridge = getBridge()
    if (!bridge) {
        return { ok: false, code: 'BRIDGE_UNAVAILABLE', message: 'AndroidPOS bridge is unavailable' }
    }

    const previousReprint = recentReprints.get(payload.orderId) ?? 0
    if (Date.now() - previousReprint < REPRINT_GUARD_MS) {
        return { ok: false, code: 'DUPLICATE_BLOCKED', message: 'Please wait before submitting another reprint' }
    }

    const reprintPayload: AndroidPOSReceiptPayload = {
        ...payload,
        requestId: createReceiptRequestId(payload.orderId, 'REPRINT'),
        receiptType: 'REPRINT',
        options: { ...payload.options, openCashDrawer: false },
    }
    const result = parseBridgeResult(bridge.reprintReceipt(JSON.stringify(reprintPayload)))
    if (result.ok) recentReprints.set(payload.orderId, Date.now())
    return result
}

export function getAndroidPOSPrinterStatus(): AndroidPOSResult {
    const bridge = getBridge()
    if (!bridge) {
        return { ok: false, code: 'BRIDGE_UNAVAILABLE', message: 'AndroidPOS bridge is unavailable' }
    }
    return parseBridgeResult(bridge.getPrinterStatus())
}
