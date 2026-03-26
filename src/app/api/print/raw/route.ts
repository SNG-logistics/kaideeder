import { NextRequest, NextResponse } from 'next/server'
import * as net from 'net'

// ─── ESC/POS Commands ──────────────────────────────────────────────────────
const ESC = '\x1B'
const GS  = '\x1D'
const CMD = {
    INIT:         ESC + '@',
    ALIGN_LEFT:   ESC + 'a\x00',
    ALIGN_CENTER: ESC + 'a\x01',
    BOLD_ON:      ESC + 'E\x01',
    BOLD_OFF:     ESC + 'E\x00',
    DOUBLE_HEIGHT: ESC + '!\x10',
    NORMAL:       ESC + '!\x00',
    LF:           '\x0A',
    FULL_CUT:     GS  + 'V\x00',
    PARTIAL_CUT:  GS  + 'V\x01',
    FEED_LINES:   (n: number) => ESC + 'd' + String.fromCharCode(n),
}

// ─── Build kitchen/bar ticket in ESC/POS bytes ────────────────────────────
function buildKitchenTicket(opts: {
    station: 'KITCHEN' | 'BAR'
    tableName: string
    orderNumber: string
    items: { name: string; quantity: number; note?: string | null }[]
    autoCut: boolean
    copies: number
    stationLabel?: string
}): Buffer {
    const { station, tableName, orderNumber, items, autoCut, copies } = opts
    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    const stationLabel = station === 'BAR' ? 'BAR' : 'KITCHEN'

    let ticket = ''
    ticket += CMD.INIT
    ticket += CMD.ALIGN_CENTER
    ticket += CMD.BOLD_ON + CMD.DOUBLE_HEIGHT
    ticket += `[${stationLabel}]` + CMD.LF
    ticket += CMD.NORMAL + CMD.BOLD_OFF
    ticket += CMD.ALIGN_LEFT
    ticket += '--------------------------------' + CMD.LF
    ticket += CMD.BOLD_ON
    ticket += `Table: ${tableName}` + CMD.LF
    ticket += `#${orderNumber}  ${time}` + CMD.LF
    ticket += CMD.BOLD_OFF
    ticket += '================================' + CMD.LF

    for (const item of items) {
        ticket += CMD.BOLD_ON
        ticket += `${item.quantity}x ${item.name}` + CMD.LF
        ticket += CMD.BOLD_OFF
        if (item.note) {
            ticket += `  >> ${item.note}` + CMD.LF
        }
    }

    ticket += '--------------------------------' + CMD.LF
    ticket += CMD.FEED_LINES(3)
    if (autoCut) ticket += CMD.FULL_CUT

    // Repeat for copies
    let full = ticket
    for (let i = 1; i < copies; i++) {
        full += ticket
    }

    return Buffer.from(full, 'binary')
}

// ─── Send bytes to printer via TCP socket ─────────────────────────────────
function sendToTcpPrinter(ip: string, port: number, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket()
        const timeout = 5000  // 5 seconds

        socket.setTimeout(timeout)

        socket.connect(port, ip, () => {
            socket.write(data, () => {
                socket.end()
            })
        })

        socket.on('close', () => resolve())
        socket.on('error', err => reject(err))
        socket.on('timeout', () => {
            socket.destroy()
            reject(new Error(`Printer timeout at ${ip}:${port}`))
        })
    })
}

// ─── POST /api/print/raw ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            ip = '192.168.1.101',
            port = 9100,
            station = 'KITCHEN',
            tableName = '',
            orderNumber = '',
            items = [],
            autoCut = true,
            copies = 1,
        } = body

        if (!ip) return NextResponse.json({ error: 'Missing printer IP' }, { status: 400 })
        if (!items.length) return NextResponse.json({ error: 'No items to print' }, { status: 400 })

        const data = buildKitchenTicket({ station, tableName, orderNumber, items, autoCut, copies })
        await sendToTcpPrinter(ip, port, data)

        return NextResponse.json({ ok: true, bytes: data.length })
    } catch (err: any) {
        console.error('[print/raw]', err.message)
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
    }
}
