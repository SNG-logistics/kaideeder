export type SunmiReceipt = {
  receiptNo: string
  dateTime?: string
  cashier?: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    total?: number
  }>
  subtotal: number
  discount?: number
  grandTotal: number
  paymentMethod?: string
  qrText?: string
  /** PNG data URL or plain base64 PNG. Keep it small; the native app caps decoded data at 512 KB. */
  logoPngBase64?: string
  /** Set only for a cash sale when a compatible drawer is attached to the printer. */
  openCashDrawer?: boolean
  /** Defaults to true in the Android bridge. */
  cutPaper?: boolean
}

export type SunmiBridgeResult = { ok: boolean; message: string }

type SunmiPrinterBridge = {
  getStatus(): string
  testPrint(): string
  printReceipt(receiptJson: string): string
}

declare global {
  interface Window {
    SunmiPrinter?: SunmiPrinterBridge
  }
}

function bridge(): SunmiPrinterBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.SunmiPrinter
}

function parseResult(raw: string): SunmiBridgeResult {
  const result = JSON.parse(raw) as Partial<SunmiBridgeResult>
  if (typeof result.ok !== 'boolean' || typeof result.message !== 'string') {
    throw new Error('SUNMI bridge returned an invalid response')
  }
  if (!result.ok) throw new Error(result.message)
  return result as SunmiBridgeResult
}

export function isSunmiApp(): boolean {
  return Boolean(bridge())
}

export function getSunmiPrinterStatus(): SunmiBridgeResult {
  const printer = bridge()
  if (!printer) return { ok: false, message: 'NOT_RUNNING_IN_SUNMI_APP' }
  try {
    return parseResult(printer.getStatus())
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'SUNMI_STATUS_UNAVAILABLE' }
  }
}

export function testSunmiPrinter(): SunmiBridgeResult {
  const printer = bridge()
  if (!printer) throw new Error('กรุณาเปิด POS ผ่านแอป 43 Garden POS บนเครื่อง SUNMI')
  return parseResult(printer.testPrint())
}

/** Fetches a same-origin store logo for the receipt without making payment depend on it. */
export async function fetchSunmiReceiptLogo(url: string): Promise<string | undefined> {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error('ไม่สามารถโหลดโลโก้สำหรับพิมพ์ใบเสร็จ')

  const logo = await response.blob()
  if (!logo.type.startsWith('image/')) throw new Error('ไฟล์โลโก้ไม่ใช่รูปภาพ')
  if (logo.size > 512_000) throw new Error('โลโก้สำหรับใบเสร็จต้องมีขนาดไม่เกิน 512 KB')

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านโลโก้สำหรับพิมพ์ใบเสร็จ'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(logo)
  })
}

/**
 * Call only after the payment/close-order API has committed successfully.
 * PRINT_QUEUED means the device accepted the job; physical print completion is asynchronous.
 */
export function printSunmiReceipt(receipt: SunmiReceipt): SunmiBridgeResult {
  const printer = bridge()
  if (!printer) throw new Error('กรุณาเปิด POS ผ่านแอป 43 Garden POS บนเครื่อง SUNMI')
  return parseResult(printer.printReceipt(JSON.stringify(receipt)))
}
