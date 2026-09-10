// ─── Native in-device printer bridge (Sunmi inner printer etc.) ─────────────────────────
// The Android wrapper APK injects `window.SunmiPrinter` with WebView.addJavascriptInterface
// (bridge contract + Kotlin implementation live in docs/SUNMI_PRINTER.md). A JS bridge can
// only carry strings/numbers, so every method here is a plain synchronous call.
//
// Print flow: build PrintLine[] → draw them on a canvas → PNG base64 → bridge.printImage().
// Rendering to an image means Lao/Thai text prints exactly as it looks on screen and does
// not depend on the printer's own font set. Bridges without printImage get plain text.

export interface NativePrinterBridge {
    /** true once the printer service is bound; when absent the bridge is assumed ready */
    isReady?: () => boolean
    /** UTF-8 text, "\n" separated lines */
    printText: (text: string) => void
    /** PNG base64 (no data: prefix), at most 384px (58mm) / 576px (80mm) wide */
    printImage?: (base64Png: string) => void
    /** raw ESC/POS bytes, base64 */
    printEscPos?: (base64Bytes: string) => void
    lineFeed?: (lines: number) => void
    cutPaper?: () => void
    /** 58 or 80 */
    getPaperWidthMm?: () => number
}

declare global {
    interface Window {
        SunmiPrinter?: NativePrinterBridge
        AndroidPrinter?: NativePrinterBridge
    }
}

export type PaperWidth = '58mm' | '80mm'

const PAPER_PX: Record<PaperWidth, number> = { '58mm': 384, '80mm': 576 }
const PAPER_COLS: Record<PaperWidth, number> = { '58mm': 32, '80mm': 48 }
const FONT_PX = { sm: 20, md: 24, lg: 30, xl: 40 } as const
const LINE_HEIGHT = 1.3

// ─── Bridge detection ──────────────────────────────────────────────────────────────────
export function getNativePrinter(): NativePrinterBridge | null {
    if (typeof window === 'undefined') return null
    const bridge = window.SunmiPrinter ?? window.AndroidPrinter
    return bridge && typeof bridge.printText === 'function' ? bridge : null
}

export function isNativePrinterAvailable(): boolean {
    const bridge = getNativePrinter()
    if (!bridge) return false
    try { return bridge.isReady ? Boolean(bridge.isReady()) : true } catch { return true }
}

/** Paper width reported by the device, else the width saved in settings */
export function nativePaperWidth(fallback: PaperWidth): PaperWidth {
    try {
        const mm = getNativePrinter()?.getPaperWidthMm?.()
        if (mm === 58) return '58mm'
        if (mm === 80) return '80mm'
    } catch { }
    return fallback
}

// ─── Line model ─────────────────────────────────────────────────────────────────────────
export interface PrintLine {
    text?: string
    /** right-aligned value printed on the same row as `text` (two-column row) */
    right?: string
    size?: keyof typeof FONT_PX
    bold?: boolean
    align?: 'left' | 'center' | 'right'
    divider?: 'dashed' | 'solid'
    /** vertical gap in px (measured at 80mm scale) */
    gap?: number
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const out: string[] = []
    for (const para of text.split('\n')) {
        let line = ''
        for (const word of para.split(' ')) {
            const candidate = line ? `${line} ${word}` : word
            if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue }
            if (line) out.push(line)
            // Thai/Lao text has no spaces, so a single "word" can exceed the paper → break by char
            line = ''
            for (const ch of word) {
                const next = line + ch
                if (line && ctx.measureText(next).width > maxWidth) { out.push(line); line = ch }
                else line = next
            }
        }
        out.push(line)
    }
    return out
}

// ─── Canvas renderer → PNG base64 ──────────────────────────────────────────────────────
export async function renderLinesToPng(lines: PrintLine[], paper: PaperWidth): Promise<string> {
    const width = PAPER_PX[paper]
    const scale = width / PAPER_PX['80mm']
    const pad = Math.round(10 * scale)
    const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
    try { await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready } catch { }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = 10
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unsupported')

    const ops: ((c: CanvasRenderingContext2D) => void)[] = []
    let y = pad

    for (const l of lines) {
        if (l.gap) { y += Math.round(l.gap * scale); continue }
        if (l.divider) {
            const yy = y + Math.round(6 * scale)
            const dashed = l.divider === 'dashed'
            ops.push(c => {
                c.save()
                c.lineWidth = 2
                if (dashed) c.setLineDash([6, 4])
                c.beginPath(); c.moveTo(pad, yy); c.lineTo(width - pad, yy); c.stroke()
                c.restore()
            })
            y = yy + Math.round(10 * scale)
            continue
        }
        const px = Math.round(FONT_PX[l.size ?? 'md'] * scale)
        const font = `${l.bold ? '700' : '400'} ${px}px ${family}`
        const lh = Math.round(px * LINE_HEIGHT)
        ctx.font = font
        const rightText = l.right ?? ''
        const rightW = rightText ? ctx.measureText(rightText).width + Math.round(12 * scale) : 0
        const rows = wrapText(ctx, l.text ?? '', Math.max(width - pad * 2 - rightW, px))
        const align = l.align ?? 'left'
        const x = align === 'center' ? width / 2 : align === 'right' ? width - pad : pad
        rows.forEach((row, i) => {
            const rowY = y + i * lh
            ops.push(c => {
                c.font = font
                c.textBaseline = 'top'
                c.textAlign = align
                c.fillText(row, x, rowY)
                if (i === 0 && rightText) { c.textAlign = 'right'; c.fillText(rightText, width - pad, rowY) }
            })
        })
        y += rows.length * lh
    }

    canvas.height = y + pad   // resizing clears the context state, ops re-set their own font
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, canvas.height)
    ctx.fillStyle = '#000'
    ctx.strokeStyle = '#000'
    for (const op of ops) op(ctx)
    return canvas.toDataURL('image/png').split(',')[1]
}

// ─── Plain-text fallback (bridges without printImage) ──────────────────────────────────
export function linesToPlainText(lines: PrintLine[], paper: PaperWidth): string {
    const cols = PAPER_COLS[paper]
    const out: string[] = []
    for (const l of lines) {
        if (l.gap) { out.push(''); continue }
        if (l.divider) { out.push((l.divider === 'solid' ? '=' : '-').repeat(cols)); continue }
        const text = l.text ?? ''
        if (l.right) {
            out.push(text + ' '.repeat(Math.max(1, cols - text.length - l.right.length)) + l.right)
        } else if (l.align === 'center') {
            out.push(' '.repeat(Math.max(0, Math.floor((cols - text.length) / 2))) + text)
        } else if (l.align === 'right') {
            out.push(' '.repeat(Math.max(0, cols - text.length)) + text)
        } else {
            out.push(text)
        }
    }
    return out.join('\n') + '\n'
}

/** Print through the bridge. Returns false when no bridge is present or every attempt failed. */
export async function printLinesNative(lines: PrintLine[], paper: PaperWidth): Promise<boolean> {
    const bridge = getNativePrinter()
    if (!bridge) return false
    let printed = false
    if (bridge.printImage) {
        try {
            bridge.printImage(await renderLinesToPng(lines, paper))
            printed = true
        } catch (e) {
            console.warn('[nativePrinter] image print failed, falling back to text:', e)
        }
    }
    if (!printed) {
        try {
            bridge.printText(linesToPlainText(lines, paper))
            printed = true
        } catch (e) {
            console.warn('[nativePrinter] text print failed:', e)
            return false
        }
    }
    try { bridge.lineFeed?.(3); bridge.cutPaper?.() } catch { }
    return true
}

// ─── Kitchen / bar ticket ──────────────────────────────────────────────────────────────
export interface KitchenTicketData {
    station: 'KITCHEN' | 'BAR'
    tableName: string
    orderNumber: string
    items: { name: string; quantity: number; note?: string | null }[]
}

export function buildKitchenTicketLines(d: KitchenTicketData): PrintLine[] {
    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    const lines: PrintLine[] = [
        { text: d.station === 'BAR' ? '[ BAR ]' : '[ KITCHEN ]', size: 'lg', bold: true, align: 'center' },
        { text: `โต๊ะ ${d.tableName}`, size: 'xl', bold: true, align: 'center' },
        { text: `#${d.orderNumber}`, right: time, size: 'sm' },
        { divider: 'solid' },
    ]
    for (const it of d.items) {
        lines.push({ text: `${it.quantity} x ${it.name}`, size: 'lg', bold: true })
        if (it.note) lines.push({ text: `   >> ${it.note}`, size: 'sm' })
    }
    lines.push({ divider: 'dashed' })
    return lines
}

export function printKitchenTicketNative(d: KitchenTicketData, paper: PaperWidth): Promise<boolean> {
    return printLinesNative(buildKitchenTicketLines(d), nativePaperWidth(paper))
}

// ─── Customer receipt ──────────────────────────────────────────────────────────────────
export interface ReceiptStoreInfo {
    storeName: string
    storeNameLo?: string | null
    phone?: string | null
    header?: string | null
    footer?: string | null
}

export interface ReceiptData extends ReceiptStoreInfo {
    orderNumber: string
    tableName?: string | null
    dateText: string
    staffName?: string | null
    items: { name: string; quantity: number; unitPrice: number; note?: string | null }[]
    discount: number
    discountType: string
    serviceCharge?: number
    vat?: number
    payment?: { method: string; receivedAmount: number; changeAmount: number } | null
    fmt: (n: number) => string
}

const PAY_LABEL: Record<string, string> = {
    CASH: 'เงินสด · ເງິນສົດ',
    TRANSFER: 'โอน · ໂອນ',
    CARD: 'บัตร · ບັດ',
    QRCODE: 'QR',
}

export function buildReceiptLines(d: ReceiptData): PrintLine[] {
    const subtotal = d.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const discountAmt = d.discountType === 'PERCENT' ? subtotal * d.discount / 100 : d.discount
    const total = subtotal - discountAmt + (d.serviceCharge ?? 0) + (d.vat ?? 0)

    const lines: PrintLine[] = [{ text: d.storeName, size: 'xl', bold: true, align: 'center' }]
    if (d.storeNameLo) lines.push({ text: d.storeNameLo, size: 'md', align: 'center' })
    if (d.header) lines.push({ text: d.header, size: 'sm', align: 'center' })
    else if (d.phone) lines.push({ text: `โทร ${d.phone}`, size: 'sm', align: 'center' })
    lines.push({ divider: 'dashed' })
    lines.push({ text: 'วันที่', right: d.dateText, size: 'sm' })
    if (d.tableName) lines.push({ text: 'โต๊ะ', right: d.tableName, size: 'sm' })
    lines.push({ text: 'เลขที่', right: d.orderNumber, size: 'sm' })
    if (d.staffName) lines.push({ text: 'พนักงาน', right: d.staffName, size: 'sm' })
    lines.push({ divider: 'dashed' })
    for (const it of d.items) {
        lines.push({ text: it.name, right: d.fmt(it.quantity * it.unitPrice), size: 'md', bold: true })
        lines.push({ text: `  ${d.fmt(it.unitPrice)} x ${it.quantity}`, size: 'sm' })
        if (it.note) lines.push({ text: `  >> ${it.note}`, size: 'sm' })
    }
    lines.push({ divider: 'dashed' })
    lines.push({ text: 'รวม', right: d.fmt(subtotal), size: 'md' })
    if (discountAmt > 0) {
        lines.push({ text: `ส่วนลด${d.discountType === 'PERCENT' ? ` (${d.discount}%)` : ''}`, right: `- ${d.fmt(discountAmt)}`, size: 'md' })
    }
    if (d.serviceCharge) lines.push({ text: 'ค่าบริการ', right: d.fmt(d.serviceCharge), size: 'md' })
    if (d.vat) lines.push({ text: 'VAT', right: d.fmt(d.vat), size: 'md' })
    lines.push({ text: 'ยอดสุทธิ', right: d.fmt(total), size: 'xl', bold: true })
    if (d.payment) {
        lines.push({ divider: 'dashed' })
        lines.push({ text: 'ชำระโดย', right: PAY_LABEL[d.payment.method] ?? d.payment.method, size: 'md' })
        if (d.payment.receivedAmount > 0) lines.push({ text: 'รับมา', right: d.fmt(d.payment.receivedAmount), size: 'md' })
        if (d.payment.changeAmount > 0) lines.push({ text: 'เงินทอน', right: d.fmt(d.payment.changeAmount), size: 'lg', bold: true })
    } else {
        lines.push({ text: 'ยังไม่ชำระ · ຍັງບໍ່ໄດ້ຊຳລະ', size: 'md', bold: true, align: 'center' })
    }
    lines.push({ divider: 'dashed' })
    lines.push({ text: d.footer || 'ຂອບໃຈທີ່ໃຊ້ບໍລິການ · ขอบคุณที่มาอุดหนุน', size: 'sm', align: 'center' })
    lines.push({ text: `KAIDEEDER POS · ${d.orderNumber}`, size: 'sm', align: 'center' })
    return lines
}

/** Shape of an order as returned by GET /api/pos/orders/[id] — only the fields the receipt needs */
export interface ReceiptOrder {
    orderNumber: string
    openedAt?: string
    closedAt?: string | null
    discount?: number
    discountType?: string
    serviceCharge?: number
    vat?: number
    table?: { name: string } | null
    createdBy?: { name: string } | null
    items: { product?: { name: string } | null; quantity: number; unitPrice: number; isCancelled?: boolean; note?: string | null }[]
    payments?: { method: string; receivedAmount: number; changeAmount: number }[]
}

function fmtDateTime(iso?: string | null): string {
    const d = iso ? new Date(iso) : new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function receiptDataFromOrder(order: ReceiptOrder, store: ReceiptStoreInfo, fmt: (n: number) => string): ReceiptData {
    return {
        ...store,
        orderNumber: order.orderNumber,
        tableName: order.table?.name ?? null,
        dateText: fmtDateTime(order.closedAt || order.openedAt),
        staffName: order.createdBy?.name ?? null,
        items: order.items
            .filter(i => !i.isCancelled)
            .map(i => ({ name: i.product?.name ?? '', quantity: i.quantity, unitPrice: i.unitPrice, note: i.note })),
        discount: order.discount ?? 0,
        discountType: order.discountType ?? 'AMOUNT',
        serviceCharge: order.serviceCharge ?? 0,
        vat: order.vat ?? 0,
        payment: order.payments?.[0] ?? null,
        fmt,
    }
}

export function printReceiptNative(d: ReceiptData, paper: PaperWidth): Promise<boolean> {
    return printLinesNative(buildReceiptLines(d), nativePaperWidth(paper))
}
