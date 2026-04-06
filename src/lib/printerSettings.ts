// ─── Multi-Printer Settings — stored in localStorage (per device, not per tenant) ────────────
// แต่ละเครื่องปริ้นตั้งค่าแยกกัน: ครัว / บาร์ / ใบเสร็จ เพื่อรองรับหลาย printer ในร้าน

// ─── Config ของ printer แต่ละตัว ────────────────────────────────────────────
export interface StationPrinterConfig {
    /** เปิด/ปิด TCP direct print สำหรับ station นี้ (ปิด = ใช้ browser print) */
    enabled: boolean
    /** IP ของเครื่องปริ้น (รองรับทั้ง WiFi และ LAN) */
    ip: string
    /** TCP port — Xprinter/Epson/Star ปกติใช้ 9100 */
    port: number
    /** ขนาดกระดาษ thermal */
    paperWidth: '80mm' | '58mm'
    /** ส่งคำสั่ง ESC/POS auto-cut หลังพิมพ์ */
    autoCut: boolean
    /** จำนวนสำเนา */
    copies: 1 | 2
}

// ─── Settings รวมทั้งระบบ ─────────────────────────────────────────────────────
export interface PrinterSettings {
    // ── Global auto-print toggles ──
    /** Auto-print slip ครัวเมื่อกด "ส่งครัว" */
    autoKitchen: boolean
    /** Auto-print slip บาร์เมื่อกด "ส่งบาร์" */
    autoBar: boolean
    /** Auto-print ใบเสร็จหลังชำระเงิน */
    autoReceipt: boolean

    // ── Per-station printers ──
    /** เครื่องปริ้น slip ครัว */
    kitchenPrinter: StationPrinterConfig
    /** เครื่องปริ้น slip บาร์ */
    barPrinter: StationPrinterConfig
    /** เครื่องปริ้น ใบเสร็จลูกค้า */
    receiptPrinter: StationPrinterConfig

    // ── Legacy fallback (เผื่อโค้ดเก่ายังเรียก printerIp/Port) ──
    /** @deprecated ใช้ kitchenPrinter.ip แทน */
    printerIp: string
    /** @deprecated ใช้ kitchenPrinter.port แทน */
    printerPort: number
    /** @deprecated ใช้ kitchenPrinter.paperWidth แทน */
    paperWidth: '80mm' | '58mm'
    /** @deprecated ใช้ kitchenPrinter.autoCut แทน */
    autoCut: boolean
    /** @deprecated ใช้ kitchenPrinter.copies แทน */
    copies: 1 | 2
}

// ─── Default per-station config ──────────────────────────────────────────────
const DEFAULT_STATION = (ip = '192.168.18.100'): StationPrinterConfig => ({
    enabled: false,         // ปิดไว้ก่อน จนกว่าจะตั้งค่า IP จริง
    ip,
    port: 9100,            // Xprinter / Epson / Star มาตรฐาน
    paperWidth: '80mm',
    autoCut: true,
    copies: 1,
})

const DEFAULT: PrinterSettings = {
    autoKitchen: true,
    autoBar: true,
    autoReceipt: false,

    kitchenPrinter: DEFAULT_STATION('192.168.18.100'),
    barPrinter:     DEFAULT_STATION('192.168.18.101'),
    receiptPrinter: DEFAULT_STATION('192.168.18.102'),

    // legacy
    printerIp:   '192.168.18.100',
    printerPort: 9100,
    paperWidth:  '80mm',
    autoCut:     true,
    copies:      1,
}

const KEY = 'kaideeder_printer_settings'

// ─── Get ──────────────────────────────────────────────────────────────────────
export function getPrinterSettings(): PrinterSettings {
    if (typeof window === 'undefined') return DEFAULT
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return DEFAULT
        const saved = JSON.parse(raw)
        return {
            ...DEFAULT,
            ...saved,
            // deep merge per-station configs
            kitchenPrinter: { ...DEFAULT_STATION(), ...saved.kitchenPrinter },
            barPrinter:     { ...DEFAULT_STATION(), ...saved.barPrinter },
            receiptPrinter: { ...DEFAULT_STATION(), ...saved.receiptPrinter },
        }
    } catch {
        return DEFAULT
    }
}

// ─── Set (partial patch) ──────────────────────────────────────────────────────
export function setPrinterSettings(patch: Partial<PrinterSettings>): PrinterSettings {
    const current = getPrinterSettings()
    const next: PrinterSettings = {
        ...current,
        ...patch,
        // deep merge nested objects
        kitchenPrinter: patch.kitchenPrinter
            ? { ...current.kitchenPrinter, ...patch.kitchenPrinter }
            : current.kitchenPrinter,
        barPrinter: patch.barPrinter
            ? { ...current.barPrinter, ...patch.barPrinter }
            : current.barPrinter,
        receiptPrinter: patch.receiptPrinter
            ? { ...current.receiptPrinter, ...patch.receiptPrinter }
            : current.receiptPrinter,
    }
    // sync legacy fields เพื่อ backward compat
    next.printerIp   = next.kitchenPrinter.ip
    next.printerPort = next.kitchenPrinter.port
    next.paperWidth  = next.kitchenPrinter.paperWidth
    next.autoCut     = next.kitchenPrinter.autoCut
    next.copies      = next.kitchenPrinter.copies
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { }
    return next
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** ดึง config ของ station ที่ต้องการ */
export function getStationPrinter(
    station: 'KITCHEN' | 'BAR' | 'RECEIPT'
): StationPrinterConfig {
    const s = getPrinterSettings()
    if (station === 'KITCHEN') return s.kitchenPrinter
    if (station === 'BAR')     return s.barPrinter
    return s.receiptPrinter
}

/** อัปเดต config ของ station เดียว */
export function setStationPrinter(
    station: 'KITCHEN' | 'BAR' | 'RECEIPT',
    patch: Partial<StationPrinterConfig>
): PrinterSettings {
    if (station === 'KITCHEN') return setPrinterSettings({ kitchenPrinter: patch as StationPrinterConfig })
    if (station === 'BAR')     return setPrinterSettings({ barPrinter:     patch as StationPrinterConfig })
    return setPrinterSettings({ receiptPrinter: patch as StationPrinterConfig })
}
