'use client'
/**
 * เครื่องยนต์พิมพ์สลิปครัว/บาร์อัตโนมัติ — ทำงานเฉพาะในแอป KAIDEEDER POS บนแท็บเล็ต SUNMI
 *
 * ครัวไม่มีจอ กระดาษคือช่องทางเดียวที่ครัวจะรู้ว่ามีออเดอร์ ดังนั้นทุกรายการที่เข้าคิวครัว
 * (kitchenStatus PENDING ของออเดอร์ที่เปิดอยู่) ต้องออกกระดาษหนึ่งครั้ง ไม่ว่าจะมาจาก
 * หน้าขาย, QR รอบแรกที่แคชเชียร์เพิ่งยืนยัน, QR รอบสั่งเพิ่มที่ไหลเข้าครัวเองโดยไม่มีใครกด,
 * การรวมรอบ หรือเดลิเวอรี่ — จึงไม่ผูกกับปุ่มไหนเลย แต่ดูจากคิวครัวจริงแล้วพิมพ์ "ส่วนที่ยังไม่เคยพิมพ์"
 *
 * ปลุกให้ทำงานจาก: สัญญาณ ORDERS_UPDATED (SSE), event ในหน้าเดียวกันหลังบันทึกออเดอร์,
 * และ poll สำรองทุก 20 วิเผื่อ SSE หลุด
 *
 * จำรายการที่พิมพ์แล้วใน localStorage ของเครื่องนี้ (readPrintedStationItems) และพิมพ์เฉพาะรายการ
 * ที่ถูกเพิ่มภายใน RECENT_WINDOW_MS — เปิดใช้ครั้งแรกหรือล้างข้อมูลแอปจะได้ไม่พ่นออเดอร์เก่าทั้งร้าน
 * แต่ออเดอร์ที่เข้ามาระหว่างแอปปิดอยู่ (ไม่กี่ชั่วโมง) ยังออกตามมาครบเมื่อเปิดแอปใหม่
 *
 * ถ้ายังไม่ตั้ง IP เครื่องพิมพ์บาร์ รายการบาร์จะพิมพ์รวมในสลิปครัวใต้หัวข้อ "เครื่องดื่ม"
 * วันหน้าใส่ IP บาร์เมื่อไหร่ ระบบจะแยกสลิปให้เอง
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useT } from '@/context/TenantContext'
import {
    createStationTicketRequestId,
    isAndroidPOSApp,
    parseAndroidPOSPrinterAddress,
    printAndroidPOSStationTicket,
    readPrintedStationItems,
    rememberPrintedStationItems,
    supportsAndroidPOSStationPrint,
    type AndroidPOSPrinterAddress,
    type AndroidPOSResult,
    type AndroidPOSStation,
    type AndroidPOSStationTicketItem,
    type AndroidPOSStationTicketPayload,
} from '@/lib/android-pos'

/** ยิงจากหน้าไหนก็ได้หลังสร้าง/แก้ออเดอร์ ให้เครื่องยนต์ตรวจคิวทันทีโดยไม่ต้องรอ SSE */
export const ORDERS_CHANGED_EVENT = 'kaideeder:orders-changed'

export function notifyOrdersChanged(): void {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT))
}

export interface StationPrintConfig {
    enabled: boolean
    kitchen: AndroidPOSPrinterAddress | null
    bar: AndroidPOSPrinterAddress | null
}

interface QueueItem {
    id: string
    quantity: number
    note: string | null
    toppingsJson?: string | null
    kitchenStatus: string
    stationId: string | null
    createdAt?: string | null
    product?: { name?: string | null } | null
}

interface QueueOrder {
    orderId: string
    orderNumber: string
    tableName: string
    orderType?: string
    orderNote: string | null
    isPendingConfirm: boolean
    items: QueueItem[]
}

interface PrintJob {
    station: AndroidPOSStation
    printer: AndroidPOSPrinterAddress
    entries: { item: QueueItem; section?: string }[]
}

type SyncReason = 'mount' | 'event' | 'poll' | 'manual'

/** ค่าตั้งเครื่องพิมพ์: poll ใช้ค่าที่จำไว้ได้นานเท่านี้ ส่วนสัญญาณออเดอร์ใหม่ดึงสดทุกครั้ง (เผื่อเพิ่งกดบันทึกในหน้าตั้งค่า) */
const CONFIG_TTL_MS = 60_000
const POLL_MS = 20_000
/** รายการที่เก่ากว่านี้ (นับจากเวลาที่ถูกเพิ่ม) ไม่พิมพ์ย้อนหลัง — กันกระดาษท่วมตอนเปิดใช้ครั้งแรก/ล้างข้อมูลแอป */
const RECENT_WINDOW_MS = 3 * 60 * 60 * 1000
/** คิวที่ดู: รวม ACCEPTED/COOKING ด้วย เผื่อมีคนกดรับบนจอครัวก่อนแท็บเล็ตทันพิมพ์ — ทะเบียนกันพิมพ์ซ้ำอยู่แล้ว */
const QUEUE_STATUSES = 'PENDING,ACCEPTED,COOKING'
/** เครื่องพิมพ์ล่ม → หยุดลองใหม่จาก poll ชั่วคราว (สัญญาณออเดอร์ใหม่ยังลองทันที) */
const FAILURE_BACKOFF_MS = 60_000
/** เตือนซ้ำได้ไม่ถี่กว่านี้ ไม่งั้น toast ท่วมจอตอนเครื่องพิมพ์ปิด */
const FAILURE_TOAST_GAP_MS = 60_000

function fmtTime(date: Date): string {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function toppingNames(raw: string | null | undefined): string[] {
    if (!raw) return []
    try {
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map(entry => (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string')
                ? (entry as { name: string }).name.trim()
                : '')
            .filter(Boolean)
    } catch {
        return []
    }
}

/** ท็อปปิ้งกับหมายเหตุลูกค้าเป็นคนละบรรทัด มีเครื่องหมายนำหน้าให้คนครัวแยกออก */
function ticketNote(item: QueueItem): string | undefined {
    const lines: string[] = []
    const toppings = toppingNames(item.toppingsJson)
    if (toppings.length > 0) lines.push(`+ ${toppings.join(', ')}`)
    const note = (item.note || '').trim()
    if (note) lines.push(`» ${note}`)
    return lines.length > 0 ? lines.join('\n') : undefined
}

/** หมายเหตุระดับออเดอร์ โดยตัดบรรทัดที่ระบบอื่นแปะไว้ (เรียกเช็คบิล / ปฏิเสธออเดอร์) ออก */
function cleanOrderNote(note: string | null): string | undefined {
    if (!note) return undefined
    const kept = note
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.includes('🧾 เรียกเช็คบิล') && !line.includes('❌ ปฏิเสธออเดอร์'))
    return kept.length > 0 ? kept.join('\n') : undefined
}

/** ถูกเพิ่มภายในช่วงที่ยังควรพิมพ์ย้อนหลังหรือไม่ — ไม่มีเวลามาด้วย (ฐานข้อมูลยังไม่อัปเดต) ถือว่าเก่า ไม่พิมพ์ */
function isRecent(item: QueueItem, now: number): boolean {
    if (!item.createdAt) return false
    const created = Date.parse(item.createdAt)
    return Number.isFinite(created) && now - created <= RECENT_WINDOW_MS
}

export function parseStationPrintConfig(data: {
    autoPrintEnabled?: boolean | null
    kitchenPrinterIp?: string | null
    barPrinterIp?: string | null
} | null | undefined): StationPrintConfig {
    return {
        enabled: Boolean(data?.autoPrintEnabled),
        kitchen: parseAndroidPOSPrinterAddress(data?.kitchenPrinterIp),
        bar: parseAndroidPOSPrinterAddress(data?.barPrinterIp),
    }
}

export function useStationAutoPrint() {
    const t = useT()
    const tRef = useRef(t)
    tRef.current = t

    const [active, setActive] = useState(false)
    const configRef = useRef<{ value: StationPrintConfig; fetchedAt: number } | null>(null)
    const runningRef = useRef(false)
    const rerunRef = useRef(false)
    const backoffUntilRef = useRef(0)
    const lastToastAtRef = useRef(0)
    const syncRef = useRef<(reason: SyncReason) => void>(() => undefined)

    useEffect(() => {
        setActive(isAndroidPOSApp() && supportsAndroidPOSStationPrint())
    }, [])

    const loadConfig = useCallback(async (force: boolean): Promise<StationPrintConfig | null> => {
        const cached = configRef.current
        if (!force && cached && Date.now() - cached.fetchedAt < CONFIG_TTL_MS) return cached.value
        try {
            const res = await fetch('/api/settings/store')
            if (!res.ok) return cached?.value ?? null
            const json = await res.json()
            if (!json.success) return cached?.value ?? null
            const value = parseStationPrintConfig(json.data)
            configRef.current = { value, fetchedAt: Date.now() }
            return value
        } catch {
            return cached?.value ?? null
        }
    }, [])

    const reportFailure = useCallback((job: PrintJob, result: AndroidPOSResult) => {
        console.warn(`[station-print] ${job.station} → ${job.printer.host}:${job.printer.port} failed: ${result.code} ${result.message}`)
        backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS
        if (Date.now() - lastToastAtRef.current < FAILURE_TOAST_GAP_MS) return
        lastToastAtRef.current = Date.now()
        const label = tRef.current(job.station === 'BAR' ? 'ticket_bar_print_failed' : 'ticket_print_failed')
        toast.error(`🖨️ ${label} (${result.code}) ${job.printer.host}`, { duration: 8000 })
    }, [])

    const buildPayload = useCallback((order: QueueOrder, job: PrintJob): AndroidPOSStationTicketPayload => {
        const tr = tRef.current
        const hasTable = Boolean(order.tableName && order.tableName !== '-')
        const tableName = order.orderType === 'DELIVERY'
            ? tr('ticket_delivery')
            : order.orderType === 'PICKUP'
                ? tr('ticket_pickup')
                : hasTable ? `${tr('ticket_table')} ${order.tableName}` : tr('ticket_no_table')

        const items: AndroidPOSStationTicketItem[] = job.entries.map(({ item, section }) => ({
            name: item.product?.name?.trim() || '-',
            quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
            note: ticketNote(item),
            section,
        }))

        return {
            schemaVersion: 1,
            requestId: createStationTicketRequestId(order.orderId, job.station),
            station: job.station,
            printer: job.printer,
            title: job.station === 'BAR' ? tr('ticket_bar_title') : tr('ticket_kitchen_title'),
            tableName,
            orderNumber: order.orderNumber,
            issuedAt: fmtTime(new Date()),
            orderNote: cleanOrderNote(order.orderNote),
            footer: `${items.length} ${tr('ticket_items_unit')}`,
            items,
            options: { cutPaper: true, copies: 1 },
        }
    }, [])

    const runOnce = useCallback(async (reason: SyncReason) => {
        const config = await loadConfig(reason !== 'poll')
        if (!config?.enabled || !config.kitchen) return

        const res = await fetch(`/api/kitchen/queue?status=${QUEUE_STATUSES}`)
        if (!res.ok) return
        const json = await res.json()
        if (!json.success) return
        const orders: QueueOrder[] = json.data?.queue ?? []

        const printed = readPrintedStationItems()
        const now = Date.now()

        for (const order of orders) {
            if (order.isPendingConfirm) continue   // QR รอบแรกที่แคชเชียร์ยังไม่ยืนยัน — ยังไม่เข้าครัว
            const fresh = order.items.filter(item =>
                item.stationId !== 'SKIP' && !printed.has(item.id) && isRecent(item, now))
            if (fresh.length === 0) continue

            const kitchenItems = fresh.filter(item => item.stationId !== 'BAR')
            const barItems = fresh.filter(item => item.stationId === 'BAR')
            const jobs: PrintJob[] = []
            if (config.bar) {
                if (kitchenItems.length > 0) jobs.push({ station: 'KITCHEN', printer: config.kitchen, entries: kitchenItems.map(item => ({ item })) })
                if (barItems.length > 0) jobs.push({ station: 'BAR', printer: config.bar, entries: barItems.map(item => ({ item })) })
            } else {
                // ไม่มีเครื่องพิมพ์บาร์ → เครื่องดื่มออกที่ครัวในสลิปเดียวกัน แต่มีหัวข้อแยกให้เห็น
                const drinks = tRef.current('ticket_drinks_section')
                jobs.push({
                    station: 'KITCHEN',
                    printer: config.kitchen,
                    entries: [
                        ...kitchenItems.map(item => ({ item })),
                        ...barItems.map(item => ({ item, section: drinks })),
                    ],
                })
            }

            for (const job of jobs) {
                const ids = job.entries.map(entry => entry.item.id)
                const result = await printAndroidPOSStationTicket(buildPayload(order, job))
                if (!result.ok) {
                    reportFailure(job, result)
                    return   // เครื่องพิมพ์ล่ม — เลิกรอบนี้ ของที่ยังไม่พิมพ์จะถูกลองใหม่รอบหน้า
                }
                rememberPrintedStationItems(ids)
                ids.forEach(id => printed.add(id))
                console.info(`[station-print] ${job.station} ${order.orderNumber}: ${ids.length} item(s) sent to ${job.printer.host}`)
            }
        }
    }, [buildPayload, loadConfig, reportFailure])

    const sync = useCallback((reason: SyncReason) => {
        if (!active) return
        if (reason === 'poll' && Date.now() < backoffUntilRef.current) return
        if (runningRef.current) {
            rerunRef.current = true
            return
        }
        runningRef.current = true
        runOnce(reason)
            .catch(error => console.warn('[station-print] sync failed:', error))
            .finally(() => {
                runningRef.current = false
                if (rerunRef.current) {
                    rerunRef.current = false
                    syncRef.current('event')
                }
            })
    }, [active, runOnce])
    syncRef.current = sync

    // ปลุกเมื่อออเดอร์เปลี่ยน: SSE จากเซิร์ฟเวอร์ + event ในหน้าเดียวกัน + poll สำรอง
    useEffect(() => {
        if (!active) return
        sync('mount')

        const source = new EventSource('/api/events')
        const onUpdated = () => sync('event')
        source.addEventListener('ORDERS_UPDATED', onUpdated)

        const onLocal = () => sync('event')
        window.addEventListener(ORDERS_CHANGED_EVENT, onLocal)

        const timer = setInterval(() => sync('poll'), POLL_MS)

        return () => {
            source.removeEventListener('ORDERS_UPDATED', onUpdated)
            source.close()
            window.removeEventListener(ORDERS_CHANGED_EVENT, onLocal)
            clearInterval(timer)
        }
    }, [active, sync])

    return { active, sync }
}
