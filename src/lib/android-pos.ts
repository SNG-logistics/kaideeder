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

// ─── Kitchen / bar tickets → LAN printer, sent by the tablet itself (APK 1.2.0+) ──────────
// เซิร์ฟเวอร์อยู่ที่ดาต้าเซ็นเตอร์ ยิง TCP ไปหา 192.168.x.x ของร้านไม่ถึง — แท็บเล็ตต้องเป็นคนส่งเอง

export type AndroidPOSStation = 'KITCHEN' | 'BAR'

export interface AndroidPOSPrinterAddress {
    host: string
    port: number
}

export interface AndroidPOSStationTicketItem {
    name: string
    quantity: number
    /** ขึ้นบรรทัดใหม่ได้ — ฝั่งเว็บใส่เครื่องหมายนำหน้ามาเอง ("+ ท็อปปิ้ง", "» หมายเหตุ") */
    note?: string
    /** หัวข้อกลุ่ม พิมพ์ครั้งเดียวตอนกลุ่มเปลี่ยน (ใช้ตอนรวมเครื่องดื่มเข้าสลิปครัว) */
    section?: string
}

export interface AndroidPOSStationTicketPayload {
    schemaVersion: 1
    requestId: string
    station: AndroidPOSStation
    printer: AndroidPOSPrinterAddress
    title: string
    tableName: string
    orderNumber: string
    issuedAt: string
    orderNote?: string
    footer?: string
    items: AndroidPOSStationTicketItem[]
    options: {
        cutPaper: boolean
        copies: number
    }
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
    /** APK 1.2.0 ขึ้นไป — ไม่มีในรุ่นเก่า ต้องเช็คก่อนเรียก */
    printStationTicket?(payloadJson: string): string
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
    return normalizeBridgeResult(parsed)
}

function normalizeBridgeResult(parsed: unknown): AndroidPOSResult {
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

// ─── Receipt payload from an order fetched via GET /api/pos/orders/[id] ────────────────
// Used for reprints (order history, /receipt page, pre-bill preview). The POS page builds
// its ORIGINAL payload inline from the close-order response instead.

/** Subset of the order shape returned by GET /api/pos/orders/[id] that a receipt needs */
export interface AndroidPOSOrderSource {
    id: string
    orderNumber: string
    subtotal?: number
    discount?: number
    discountType?: string
    serviceCharge?: number
    vat?: number
    totalAmount?: number
    openedAt?: string
    closedAt?: string | null
    createdBy?: { name: string } | null
    items: {
        productId?: string
        product?: { name: string } | null
        quantity: number
        unitPrice: number
        isCancelled?: boolean
        note?: string | null
    }[]
    payments?: { method: string; receivedAmount: number; changeAmount: number }[]
}

export type AndroidPOSStoreInfo = AndroidPOSReceiptPayload['store']

export function buildAndroidPOSReceiptPayload(
    order: AndroidPOSOrderSource,
    store: AndroidPOSStoreInfo,
    currency: string,
    options?: { cutPaper?: boolean; qrText?: string },
): AndroidPOSReceiptPayload {
    const items = order.items
        .filter(item => !item.isCancelled)
        .map(item => ({
            name: item.product?.name || item.productId || '-',
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            total: Number(item.quantity) * Number(item.unitPrice),
            note: item.note || undefined,
        }))

    // The stored subtotal can be stale (0 after a merge) — recompute from live items like /receipt does
    const subtotal = items.reduce((sum, item) => sum + item.total, 0) || Number(order.subtotal || 0)
    const discount = order.discountType === 'PERCENT'
        ? subtotal * (Number(order.discount || 0) / 100)
        : Number(order.discount || 0)
    const serviceCharge = Number(order.serviceCharge || 0)
    const vat = Number(order.vat || 0)
    const computedTotal = subtotal - discount + serviceCharge + vat
    const payment = order.payments?.[0]

    return {
        schemaVersion: 1,
        requestId: createReceiptRequestId(order.id, 'ORIGINAL'),
        receiptType: 'ORIGINAL',
        orderId: order.id,
        receiptNo: order.orderNumber,
        saleDateTime: order.closedAt || order.openedAt || new Date().toISOString(),
        store,
        cashier: order.createdBy?.name || undefined,
        items,
        subtotal,
        discount,
        serviceCharge,
        vat,
        grandTotal: computedTotal > 0 ? computedTotal : Number(order.totalAmount || 0),
        currency,
        payment: {
            method: payment?.method || 'UNPAID',
            receivedAmount: Number(payment?.receivedAmount || 0),
            changeAmount: Number(payment?.changeAmount || 0),
        },
        options: {
            openCashDrawer: false,
            cutPaper: options?.cutPaper ?? true,
        },
        qrText: options?.qrText,
    }
}

export function testAndroidPOSPrint(): AndroidPOSResult {
    const bridge = getBridge()
    if (!bridge) {
        return { ok: false, code: 'BRIDGE_UNAVAILABLE', message: 'AndroidPOS bridge is unavailable' }
    }
    return parseBridgeResult(bridge.testPrint())
}

// ─── Station (kitchen / bar) tickets over the LAN ─────────────────────────────────────────

/** ชื่อ CustomEvent ที่แอปยิงกลับมาเมื่อพิมพ์เสร็จ/ล้มเหลว — ต้องตรงกับ PosWebViewManager.PRINT_RESULT_EVENT */
export const ANDROID_POS_PRINT_RESULT_EVENT = 'androidpos:print-result'

/** แอปมี 5 วิ ต่อการเชื่อมต่อ + เวลาส่งข้อมูล + คิวงานก่อนหน้า — รอได้นานกว่านั้นเผื่อสลิปหลายใบต่อกัน */
const STATION_PRINT_RESULT_TIMEOUT_MS = 45_000

const PRINTED_STATION_ITEMS_KEY = 'kaideeder.android-pos.printed-station-items.v1'
const MAX_STATION_ITEM_RECORDS = 2000

/** แอปรุ่นนี้พิมพ์สลิปครัว/บาร์ผ่านแลนได้หรือไม่ (ต้อง 1.2.0 ขึ้นไป) */
export function supportsAndroidPOSStationPrint(): boolean {
    const bridge = getBridge()
    return Boolean(bridge && typeof bridge.printStationTicket === 'function')
}

export function createStationTicketRequestId(orderId: string, station: AndroidPOSStation): string {
    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return `${orderId}:${station}:${random}`
}

/**
 * แปลงค่าที่ผู้ใช้กรอกในหน้าตั้งค่า ("192.168.1.51" หรือ "192.168.1.51:9100") เป็น host/port
 * คืน null ถ้าว่างหรือรูปแบบไม่ถูก — กติกาเดียวกับที่แอปตรวจ (StationTicketModels.kt)
 */
export function parseAndroidPOSPrinterAddress(raw: string | null | undefined): AndroidPOSPrinterAddress | null {
    const value = (raw ?? '').trim()
    if (!value) return null
    const match = value.match(/^([A-Za-z0-9][A-Za-z0-9.-]{0,252})(?::(\d{1,5}))?$/)
    if (!match || match[1].includes('..') || match[1].endsWith('.') || match[1].endsWith('-')) return null
    const port = match[2] ? parseInt(match[2], 10) : 9100
    if (port < 1 || port > 65535) return null
    return { host: match[1], port }
}

/**
 * สั่งพิมพ์สลิปครัว/บาร์ผ่านแอป — แอปตอบ PRINT_QUEUED ทันทีแล้วส่งผลจริงกลับมาเป็น event
 * (ไม่บล็อกหน้าขายระหว่างรอเครื่องพิมพ์ที่อาจปิดอยู่) Promise นี้จบเมื่อได้ผลจริง หรือหมดเวลารอ
 */
export function printAndroidPOSStationTicket(payload: AndroidPOSStationTicketPayload): Promise<AndroidPOSResult> {
    const bridge = getBridge()
    if (!bridge) {
        return Promise.resolve({ ok: false, code: 'BRIDGE_UNAVAILABLE', message: 'AndroidPOS bridge is unavailable' })
    }
    if (typeof bridge.printStationTicket !== 'function') {
        return Promise.resolve({
            ok: false,
            code: 'APP_UPDATE_REQUIRED',
            message: 'KAIDEEDER POS app 1.2.0 or newer is required for LAN ticket printing',
        })
    }
    const printStationTicket = bridge.printStationTicket.bind(bridge)

    return new Promise(resolve => {
        let settled = false
        let timer: ReturnType<typeof setTimeout> | undefined

        const finish = (result: AndroidPOSResult) => {
            if (settled) return
            settled = true
            window.removeEventListener(ANDROID_POS_PRINT_RESULT_EVENT, onResult)
            if (timer) clearTimeout(timer)
            resolve(result)
        }

        const onResult = (event: Event) => {
            const detail = (event as CustomEvent<unknown>).detail
            if (!detail || typeof detail !== 'object') return
            if ((detail as { requestId?: unknown }).requestId !== payload.requestId) return
            try {
                finish(normalizeBridgeResult(detail))
            } catch (error) {
                finish({ ok: false, code: 'BRIDGE_ERROR', message: error instanceof Error ? error.message : 'Bad print result' })
            }
        }

        window.addEventListener(ANDROID_POS_PRINT_RESULT_EVENT, onResult)
        timer = setTimeout(() => finish({
            ok: false,
            code: 'RESULT_TIMEOUT',
            message: 'The app did not report a print result in time',
        }), STATION_PRINT_RESULT_TIMEOUT_MS)

        let queued: AndroidPOSResult
        try {
            queued = parseBridgeResult(printStationTicket(JSON.stringify(payload)))
        } catch (error) {
            finish({ ok: false, code: 'BRIDGE_ERROR', message: error instanceof Error ? error.message : 'AndroidPOS bridge error' })
            return
        }
        // ปฏิเสธตั้งแต่ตรวจ payload (INVALID_REQUEST, UNTRUSTED_PAGE, ...) — ไม่มี event ตามมา
        if (!queued.ok || queued.code !== 'PRINT_QUEUED') finish(queued)
    })
}

// ─── Which order items already came out on a kitchen/bar slip (per device) ────────────────
// ครัวไม่มีจอ — กระดาษคือความจริงเพียงอย่างเดียว จึงต้องจำว่ารายการไหนพิมพ์แล้ว
// จะได้ไม่พิมพ์ซ้ำทุกครั้งที่มีสัญญาณออเดอร์อัปเดต และไม่ตกหล่นเมื่อรอบสั่งเพิ่มจาก QR ไหลเข้ามาเอง

export function readPrintedStationItems(): Set<string> {
    if (typeof window === 'undefined') return new Set()
    try {
        const parsed = JSON.parse(window.localStorage.getItem(PRINTED_STATION_ITEMS_KEY) ?? '[]')
        return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [])
    } catch {
        return new Set()
    }
}

export function rememberPrintedStationItems(itemIds: string[]): void {
    if (typeof window === 'undefined' || itemIds.length === 0) return
    try {
        const fresh = new Set(itemIds)
        const entries = [...readPrintedStationItems()].filter(entry => !fresh.has(entry))
        entries.push(...fresh)
        window.localStorage.setItem(PRINTED_STATION_ITEMS_KEY, JSON.stringify(entries.slice(-MAX_STATION_ITEM_RECORDS)))
    } catch {
        // Printing must not fail because browser storage is unavailable.
    }
}
