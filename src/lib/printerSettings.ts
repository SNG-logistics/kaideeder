// ─── Printer Settings — stored in localStorage (per device, not per tenant) ──

export interface PrinterSettings {
    /** Thermal paper width for kitchen/bar tickets */
    paperWidth: '80mm' | '58mm'
    /** Auto-print kitchen ticket when items are sent to kitchen */
    autoKitchen: boolean
    /** Auto-print bar ticket when bar items are sent */
    autoBar: boolean
    /** Number of copies for kitchen/bar tickets */
    copies: 1 | 2
    /** Auto-print receipt after payment */
    autoReceipt: boolean
}

const KEY = 'kaideeder_printer_settings'

const DEFAULT: PrinterSettings = {
    paperWidth: '80mm',
    autoKitchen: true,
    autoBar: true,
    copies: 1,
    autoReceipt: false,
}

export function getPrinterSettings(): PrinterSettings {
    if (typeof window === 'undefined') return DEFAULT
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return DEFAULT
        return { ...DEFAULT, ...JSON.parse(raw) }
    } catch {
        return DEFAULT
    }
}

export function setPrinterSettings(patch: Partial<PrinterSettings>): PrinterSettings {
    const current = getPrinterSettings()
    const next = { ...current, ...patch }
    try {
        localStorage.setItem(KEY, JSON.stringify(next))
    } catch { }
    return next
}
