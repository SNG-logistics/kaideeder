'use client'
import { useStationAutoPrint } from '@/hooks/useStationAutoPrint'

/**
 * ตัวพิมพ์สลิปครัว/บาร์อัตโนมัติ — ไม่มี UI ทำงานเฉพาะในแอป KAIDEEDER POS บนแท็บเล็ต
 * ต้องมีอยู่ในทุกหน้าที่แท็บเล็ตเปิดค้างไว้ได้ (หน้าขาย + หลังร้าน) ไม่งั้นรอบสั่งเพิ่มจาก QR
 * จะไม่ออกกระดาษตอนแคชเชียร์เผลอเปิดหน้าอื่นอยู่
 */
export default function StationAutoPrint() {
    useStationAutoPrint()
    return null
}
