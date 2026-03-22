'use client'
import { useState } from 'react'

/* ────────────────────────────────────────────────────────────
   DATA — Sections grouped into 5 tabs
──────────────────────────────────────────────────────────── */
const TABS = [
    { id: 'overview',  icon: '🌐', label: 'ภาพรวมระบบ' },
    { id: 'pos',       icon: '💰', label: 'POS & ขาย' },
    { id: 'stock',     icon: '📦', label: 'สต็อค & คลัง' },
    { id: 'recipe',    icon: '📋', label: 'สูตร & BOM' },
    { id: 'settings',  icon: '⚙️', label: 'ตั้งค่า & จัดการ' },
] as const

type TabId = typeof TABS[number]['id']

type Step = { text: string; sub?: string[] }
type Tip  = { type: 'tip' | 'warn' | 'info'; text: string }
type Section = {
    id: string
    icon: string
    title: string
    subtitle: string
    roles?: string[]
    steps: Step[]
    tips?: Tip[]
}
type TabContent = { sections: Section[] }

const CONTENT: Record<TabId, TabContent> = {
    overview: {
        sections: [
            {
                id: 'intro',
                icon: '🏢',
                title: 'KAIDEEDER คืออะไร?',
                subtitle: 'ระบบจัดการร้านอาหารและสต็อคแบบ Multi-Tenant',
                roles: [],
                steps: [
                    { text: 'KAIDEEDER เป็นระบบ POS + สต็อค + BOM ออกแบบมาสำหรับร้านอาหาร' },
                    { text: 'ระบบทำงานบนเบราว์เซอร์ — ไม่ต้องติดตั้งโปรแกรม' },
                    { text: 'หลายร้านใช้งานพร้อมกันได้ (Multi-Tenant) — ข้อมูลแยกกันสมบูรณ์' },
                    { text: 'รองรับภาษาไทย / ลาว และสกุลเงิน KIP' },
                ],
                tips: [
                    { type: 'info', text: 'URL: https://kaideeder.com/  เข้าใช้งานด้วย Email + Password ที่ได้รับจาก Admin' },
                ],
            },
            {
                id: 'roles',
                icon: '👥',
                title: 'บทบาทผู้ใช้ (Roles)',
                subtitle: 'แต่ละ Role เห็นและใช้งานเมนูต่างกัน',
                roles: [],
                steps: [
                    { text: '👑 Owner — เข้าถึงได้ทุกอย่าง รวมถึงการตั้งค่า, ผู้ใช้, รายงาน' },
                    { text: '📊 Manager — จัดการสต็อค, BOM, รายงาน, ผู้ใช้' },
                    { text: '💰 Cashier — ใช้ POS, รับชำระ, ดูรายงานยอดขาย' },
                    { text: '🍳 Kitchen — เห็นจอครัว (KDS), ยืนยัน/เสร็จออเดอร์' },
                    { text: '🍸 Bar — เหมือนครัว แต่เห็นเฉพาะออเดอร์เครื่องดื่ม' },
                    { text: '🏭 Warehouse — รับสินค้า, โอนคลัง, นับสต็อค' },
                    { text: '🛒 Purchaser — สั่งซื้อสินค้า, GR, ดูรายงานการซื้อ' },
                ],
                tips: [
                    { type: 'tip', text: 'Owner/Manager เท่านั้นที่เพิ่ม/ลบผู้ใช้ได้' },
                ],
            },
            {
                id: 'login',
                icon: '🔐',
                title: 'การเข้าสู่ระบบ',
                subtitle: 'Login ด้วย Email + Password',
                roles: ['ทุก role'],
                steps: [
                    { text: 'เปิด https://kaideeder.com/ ด้วย Chrome / Safari / Edge' },
                    { text: 'กรอก Email และ Password ที่ได้รับจาก Manager' },
                    { text: 'กด Login — ระบบจะพาไปหน้า Dashboard' },
                    { text: 'ถ้าลืม Password: แจ้ง Owner หรือ Manager ให้รีเซ็ตให้' },
                ],
                tips: [
                    { type: 'warn', text: 'อย่าแชร์ Password กับคนอื่น — แต่ละคนควรมี Account ของตัวเอง' },
                    { type: 'tip', text: 'บุ๊กมาร์คหน้า Login ไว้ใน browser เพื่อความรวดเร็ว' },
                ],
            },
            {
                id: 'dashboard',
                icon: '🏠',
                title: 'หน้า Dashboard (Home)',
                subtitle: 'สรุปยอดขาย, สต็อคต่ำ, กิจกรรมล่าสุด',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ยอดขายวันนี้ — แสดงจำนวน Order และมูลค่ารวม' },
                    { text: 'สต็อคต่ำ — แสดงวัตถุดิบที่ต้องสั่งซื้อ (ต่ำกว่า Reorder Point)' },
                    { text: 'กิจกรรมล่าสุด — Stock Movement และ Consume ล่าสุด' },
                    { text: 'ไปยังหน้าอื่น: คลิก Sidebar ซ้ายมือ' },
                ],
            },
        ],
    },

    pos: {
        sections: [
            {
                id: 'pos-use',
                icon: '💰',
                title: 'POS ขายหน้าร้าน',
                subtitle: 'รับออเดอร์, เพิ่มสินค้า, ชำระเงิน',
                roles: ['Cashier', 'Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ POS ขายหน้าร้าน จาก Sidebar (สีแดง บนสุด)' },
                    { text: 'เลือกโต๊ะ (ถ้ามี) หรือ Walk-in' },
                    { text: 'เพิ่มเมนู: คลิกสินค้าในกริดด้านขวา', sub: ['ค้นหาเมนูด้วยช่องค้นหาด้านบน', 'คลิกหมวดหมู่เพื่อกรอง'] },
                    { text: 'แก้ไขจำนวน: คลิกตัวเลขในรายการออเดอร์' },
                    { text: 'เพิ่ม Note ต่อ Item: กดค้างที่รายการ หรือปุ่ม ✏️' },
                    { text: 'ส่งไปครัว: กด 📤 ส่งครัว — KDS จะแสดงออเดอร์ทันที' },
                    { text: 'ชำระเงิน: กด 💰 ชำระ → เลือกวิธีชำระ → ยืนยัน' },
                    { text: 'พิมพ์ใบเสร็จ: กด 🖨️ ใบเสร็จ (ต้องเชื่อมต่อเครื่องพิมพ์)' },
                ],
                tips: [
                    { type: 'tip', text: 'สามารถเปิดหลายโต๊ะพร้อมกันได้ — สลับโต๊ะด้วยปุ่มด้านบน' },
                    { type: 'info', text: 'ระบบตัดสต็อคอัตโนมัติตาม BOM ทุกครั้งที่ชำระเงิน' },
                    { type: 'warn', text: 'ถ้า BOM ไม่ครบ ระบบจะบันทึกใน Consume Fail Log — ต้องแก้ BOM ให้ครบ' },
                ],
            },
            {
                id: 'kds',
                icon: '🍳',
                title: 'จอครัว (KDS)',
                subtitle: 'ติดตามออเดอร์ที่ส่งมาจาก POS',
                roles: ['Kitchen', 'Bar', 'Manager'],
                steps: [
                    { text: 'เปิด /kitchen หรือ /bar บน iPad/จอครัว' },
                    { text: 'ออเดอร์ใหม่จะปรากฏเป็น Card สีเหลือง' },
                    { text: 'กด ✅ บน Item เมื่อทำเสร็จแต่ละรายการ' },
                    { text: 'กด ✅ เสร็จแล้ว บน Card เมื่อออเดอร์ทั้งหมดพร้อมเสิร์ฟ' },
                    { text: 'Card จะเปลี่ยนเป็นสีเขียว และหายออกไปหลัง 30 วิ' },
                ],
                tips: [
                    { type: 'info', text: 'KDS รีเฟรชอัตโนมัติทุก 10 วินาที — ไม่ต้องกด Refresh' },
                    { type: 'tip', text: 'ครัว/บาร์เห็นเฉพาะ Item ที่กำหนดให้แต่ละฝ่าย (routing ตามหมวดหมู่)' },
                ],
            },
            {
                id: 'waiter',
                icon: '🍽️',
                title: 'หน้าเสิร์ฟ (Waiter)',
                subtitle: 'ดูสถานะออเดอร์ สั่งอาหารเพิ่ม',
                roles: ['Waiter', 'Manager'],
                steps: [
                    { text: 'เปิด /waiter บน iPad หรือมือถือ' },
                    { text: 'เห็นรายการโต๊ะและสถานะออเดอร์แต่ละโต๊ะ' },
                    { text: 'กดโต๊ะเพื่อเพิ่มรายการอาหารพิเศษ หรือ Note' },
                    { text: 'เห็นสถานะจากครัว: ⏳ รอ / 🔔 พร้อมเสิร์ฟ' },
                ],
            },
            {
                id: 'tables',
                icon: '🪑',
                title: 'จัดการโต๊ะ',
                subtitle: 'เพิ่ม/แก้ไขโต๊ะและโซน',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'กดปุ่ม 🪑 Tables ใน Sidebar (หรือในหน้า POS)' },
                    { text: 'กด + เพิ่มโต๊ะ → กรอกชื่อโต๊ะ (เช่น A1, VIP1)' },
                    { text: 'กำหนด Zone: กด + โซน → ตั้งชื่อ (ในร้าน, นอกร้าน, VIP)' },
                    { text: 'ลากย้ายโต๊ะระหว่างโซนได้' },
                ],
            },
        ],
    },

    stock: {
        sections: [
            {
                id: 'products',
                icon: '🥩',
                title: 'วัตถุดิบ / Products',
                subtitle: 'จัดการรายการสินค้าและวัตถุดิบทั้งหมด',
                roles: ['Manager', 'Owner', 'Warehouse'],
                steps: [
                    { text: 'ไปที่ วัตถุดิบ / Stock จาก Sidebar' },
                    { text: 'กด ➕ เพิ่มสินค้าใหม่ → กรอก:', sub: ['SKU (รหัสสินค้า) — ต้องไม่ซ้ำ', 'ชื่อสินค้า', 'หมวดหมู่', 'หน่วย (กก. / ชิ้น / ถุง)', 'ราคาต้นทุนเริ่มต้น', 'Reorder Point (จุดสั่งซื้อ)'] },
                    { text: 'บันทึก — สินค้าจะปรากฏในรายการ' },
                    { text: 'แก้ไข: กดปุ่ม ✏️ ที่แถวสินค้า' },
                    { text: 'ปิดการใช้งาน: Toggle ที่ Active — ไม่ปรากฏใน BOM และ POS' },
                ],
                tips: [
                    { type: 'info', text: 'SKU ใช้เป็น Key หลักในการ match กับ Excel Import — ตั้งให้สั้น จดจำง่าย เช่น PORK-NECK, GARLIC' },
                    { type: 'tip', text: 'ตั้ง Reorder Point ให้ถูกต้อง — ระบบจะแจ้งเตือนใน Sidebar badge' },
                ],
            },
            {
                id: 'inventory',
                icon: '📦',
                title: 'สต็อคคลัง',
                subtitle: 'ดูยอดคงเหลือแต่ละคลัง',
                roles: ['Manager', 'Owner', 'Warehouse'],
                steps: [
                    { text: 'ไปที่ สต็อคคลัง จาก Sidebar' },
                    { text: 'ดูยอดคงเหลือ (onHand) แต่ละสินค้าต่อคลัง' },
                    { text: 'กรองด้วยคลัง: เลือก Location ด้านบน' },
                    { text: 'ค้นหาสินค้า: พิมพ์ในช่อง 🔍' },
                    { text: 'สินค้าสีแดง: ต่ำกว่า Reorder Point → ต้องสั่งซื้อด่วน' },
                ],
                tips: [
                    { type: 'info', text: 'Sidebar badge 🔴 แสดงจำนวนสินค้าที่ต่ำกว่า Reorder Point — Refresh ทุก 60 วินาที' },
                ],
            },
            {
                id: 'stock-count',
                icon: '📋',
                title: 'นับสต็อคจริง (Stock Count)',
                subtitle: 'นับสต็อครอบสิ้นเดือน แล้ว Auto Adjust',
                roles: ['Manager', 'Owner', 'Warehouse'],
                steps: [
                    { text: 'ไปที่ นับสต็อคจริง จาก Sidebar' },
                    { text: 'กด + สร้าง Sheet ใหม่ → กรอกชื่อ (เช่น "นับสต็อค มี.ค. 67")', sub: ['เลือกคลัง: ถ้าต้องการนับเฉพาะคลัง', 'ว่างเปล่า = นับทุกคลัง'] },
                    { text: 'กด ▶️ เริ่มนับ — ระบบ Snapshot ยอดปัจจุบัน' },
                    { text: 'กรอกจำนวนที่นับได้จริงทุกรายการ', sub: ['กด Enter เพื่อไปรายการถัดไป', 'ช่องว่าง = ถือว่าตรงกับระบบ'] },
                    { text: 'กด 💾 บันทึก หรือ Floating bar ด้านล่าง' },
                    { text: 'กด ✅ เสร็จสิ้นการนับ — คำนวณผลต่าง' },
                    { text: 'ตรวจสอบรายงานผลต่าง (บวก/ลบ) → กด ✅ Approve' },
                    { text: 'ระบบปรับ Inventory อัตโนมัติ + บันทึก Movement[ADJUSTMENT]' },
                ],
                tips: [
                    { type: 'warn', text: 'Approve แล้วไม่สามารถย้อนคืนได้ — ตรวจสอบให้ดีก่อน' },
                    { type: 'tip', text: 'ยกเลิก Sheet ได้ระหว่าง DRAFT / IN_PROGRESS โดยกด "ยกเลิก"' },
                ],
            },
            {
                id: 'purchase',
                icon: '🛒',
                title: 'ซื้อเข้า / GR (Goods Receipt)',
                subtitle: 'บันทึกการรับสินค้าเข้าคลัง',
                roles: ['Manager', 'Owner', 'Purchaser', 'Warehouse'],
                steps: [
                    { text: 'ไปที่ ซื้อเข้า / GR จาก Sidebar' },
                    { text: 'กด ➕ GR ใหม่ → เลือกซัพพลายเออร์ + วันที่' },
                    { text: 'เพิ่มรายการสินค้า:', sub: ['ค้นหาสินค้าด้วย SKU หรือชื่อ', 'ระบุจำนวนที่รับ, หน่วย, ราคาต่อหน่วย', 'เลือกคลังที่รับเข้า'] },
                    { text: 'ตรวจสอบมูลค่ารวม → กด ✅ บันทึก GR' },
                    { text: 'ระบบเพิ่มสต็อคอัตโนมัติ + คำนวณ Avg Cost ใหม่' },
                ],
                tips: [
                    { type: 'info', text: 'Avg Cost คำนวณแบบ Moving Average ทุกครั้งที่ GR' },
                ],
            },
            {
                id: 'transfer',
                icon: '🔄',
                title: 'เบิก / โอนคลัง',
                subtitle: 'ย้ายสินค้าระหว่าง Location',
                roles: ['Manager', 'Owner', 'Warehouse'],
                steps: [
                    { text: 'ไปที่ เบิก / โอนคลัง → กด ➕' },
                    { text: 'เลือก จาก: ต้นทาง → ไป: ปลายทาง' },
                    { text: 'เพิ่มรายการสินค้าและจำนวน' },
                    { text: 'กด ✅ โอน — สต็อคเปลี่ยนทันที' },
                ],
                tips: [
                    { type: 'tip', text: 'ตัวอย่าง: โอนหมูจาก WH_MAIN → KIT_STOCK ก่อนเปิดร้าน' },
                ],
            },
            {
                id: 'adjustment',
                icon: '⚖️',
                title: 'ปรับสต็อค (Adjustment)',
                subtitle: 'ปรับยอดสต็อคแบบ Manual (บวก/ลบ)',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ ปรับสต็อค จาก Sidebar' },
                    { text: 'เลือกสินค้า + คลัง' },
                    { text: 'ระบุจำนวนที่ปรับ (+ เพิ่ม / - ลด) และเหตุผล' },
                    { text: 'กด ✅ บันทึก — ระบบปรับสต็อคและบันทึก Movement' },
                ],
                tips: [
                    { type: 'warn', text: 'ใช้ Stock Count Sheet แทน Adjustment ทุกครั้งที่เป็นไปได้ — Audit trail ครบกว่า' },
                ],
            },
            {
                id: 'quick-receive',
                icon: '⚡',
                title: 'รับสินค้าด่วน (Quick Receive)',
                subtitle: 'รับสินค้าโดยไม่ต้องสร้าง GR เต็มรูปแบบ',
                roles: ['Warehouse', 'Manager'],
                steps: [
                    { text: 'ไปที่ ⚡ รับสินค้าด่วน จาก Quick Actions ใน Sidebar' },
                    { text: 'ค้นหาสินค้าด้วยชื่อหรือ SKU → กรอกจำนวน + คลัง' },
                    { text: 'กด ✅ บันทึก — สต็อคเพิ่มทันที' },
                ],
                tips: [
                    { type: 'info', text: 'เหมาะสำหรับของสดที่รับประจำวัน รวดเร็วกว่า GR เต็มรูปแบบ' },
                ],
            },
            {
                id: 'quick-waste',
                icon: '🗑️',
                title: 'บันทึก Waste',
                subtitle: 'บันทึกของเสีย / หมดอายุ / ตกแตก',
                roles: ['Warehouse', 'Kitchen', 'Manager'],
                steps: [
                    { text: 'ไปที่ 🗑️ บันทึก Waste จาก Quick Actions' },
                    { text: 'เลือกคลัง → ค้นหาสินค้า → กรอกจำนวน + หน่วย + สาเหตุ' },
                    { text: 'กด 🗑️ บันทึก Waste — สต็อคลดทันที' },
                ],
            },
            {
                id: 'sales-import',
                icon: '💾',
                title: 'นำเข้ายอดขาย (Sales Import)',
                subtitle: 'Import Excel จาก POS เก่า เพื่อตัดสต็อค',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ นำเข้ายอดขาย จาก Sidebar' },
                    { text: 'Download Template Excel → กรอกข้อมูลยอดขาย' },
                    { text: 'Upload → Preview → ตรวจสอบ Match เมนู' },
                    { text: 'กด ✅ Import — ตัดสต็อคตาม BOM อัตโนมัติ' },
                ],
                tips: [
                    { type: 'warn', text: 'ชื่อเมนูใน Excel ต้องตรงกับ POS Menu Code หรือชื่อเมนูในระบบ' },
                ],
            },
            {
                id: 'qr-sheets',
                icon: '🖨️',
                title: 'พิมพ์ QR Sheet',
                subtitle: 'พิมพ์ QR Code สำหรับนับสต็อคด้วยมือถือ',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ 🖨️ พิมพ์ QR Sheet จาก Quick Actions' },
                    { text: 'เลือก Location → กด ⚡ สร้าง QR' },
                    { text: 'กด 🖨️ Print — พิมพ์เป็น A4 (4 คอลัมน์)' },
                    { text: 'ติดบนชั้นวาง → พนักงานสแกนมือถือ กรอกจำนวน' },
                ],
                tips: [
                    { type: 'warn', text: 'QR Token หมดอายุใน 8 ชั่วโมง — พิมพ์ใหม่ทุกวัน' },
                    { type: 'info', text: 'พนักงานสแกน QR ด้วยมือถือ ไม่ต้อง Login ระบบ' },
                ],
            },
            {
                id: 'consume-fail',
                icon: '⚠️',
                title: 'ปัญหาตัดสต็อค (Consume Fail)',
                subtitle: 'ดูรายการที่ระบบตัดสต็อคไม่ได้',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'Badge ⚠️ ใน Sidebar แสดงจำนวน Fail ที่ค้างอยู่' },
                    { text: 'ไปที่ ⚠️ ปัญหาตัดสต็อค → ดูสาเหตุ:', sub: ['NO_BOM: สูตรอาหารยังไม่มี BOM', 'STOCK_EMPTY: สต็อคในคลัง = 0', 'NO_UOM_CONV: ไม่มีหน่วยแปลง'] },
                    { text: 'แก้ไขปัญหา (เพิ่ม BOM / GR สต็อค / ตั้ง UOM)' },
                    { text: 'กด ✅ Resolved หรือ Skip' },
                ],
                tips: [
                    { type: 'warn', text: 'Consume Fail = สต็อคไม่ถูกตัด — ยอดในระบบสูงกว่าความเป็นจริง' },
                ],
            },
        ],
    },

    recipe: {
        sections: [
            {
                id: 'menu',
                icon: '🍽️',
                title: 'เมนูร้าน',
                subtitle: 'จัดการเมนูที่แสดงใน POS และ QR Menu',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ เมนูร้าน จาก Sidebar' },
                    { text: 'กด ➕ เพิ่มเมนู → กรอกชื่อ, ราคา, หมวดหมู่, รูปภาพ' },
                    { text: 'ตั้ง Featured ⭐: กดไอคอนดาว → ปรากฏหน้า QR Menu ลูกค้า' },
                    { text: 'ปิดเมนู: Toggle Active → ซ่อนจาก POS ชั่วคราว' },
                ],
                tips: [
                    { type: 'tip', text: 'เมนู Featured แสดงในส่วน "แนะนำ" ของ QR Menu ลูกค้า' },
                ],
            },
            {
                id: 'recipes',
                icon: '📋',
                title: 'สูตรอาหาร (BOM)',
                subtitle: 'เชื่อมเมนูกับวัตถุดิบที่ต้องตัดสต็อค',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ สูตรอาหาร (BOM) จาก Sidebar' },
                    { text: 'กด ➕ เพิ่มสูตร → ระบุชื่อเมนู + POS Menu Code' },
                    { text: 'เพิ่มวัตถุดิบ (BOM Line):', sub: ['เลือกสินค้า → ระบุจำนวน + หน่วย + คลัง', 'เพิ่มได้หลายรายการต่อสูตร'] },
                    { text: 'กด ✅ บันทึก' },
                    { text: 'ตรวจสอบ Badge:', sub: ['✅ เขียว = BOM ครบ', '⚠️ เหลือง = BOM ไม่ครบ', '❌ แดง = ยังไม่มี BOM'] },
                ],
                tips: [
                    { type: 'warn', text: 'ไม่มี BOM = ตัดสต็อคไม่ได้เมื่อขาย — ต้องสร้าง BOM ทุกเมนู' },
                    { type: 'info', text: 'Banner แจ้งเตือนสีส้ม: กด 🔍 แสดงเฉพาะที่ขาด เพื่อแก้ทีเดียวได้เลย' },
                ],
            },
            {
                id: 'prep',
                icon: '🧪',
                title: 'สูตรแปรรูป (Prep Recipe)',
                subtitle: 'บันทึก Semi-finished goods เช่น หมูหมัก, น้ำซุป',
                roles: ['Manager', 'Owner', 'Kitchen'],
                steps: [
                    { text: 'ไปที่ สูตรแปรรูป (Prep) จาก Sidebar' },
                    { text: 'กด ➕ เพิ่ม Prep → ระบุชื่อ, Output: จำนวน + หน่วย + คลัง Output' },
                    { text: 'เพิ่ม Ingredient (Input): เลือกวัตถุดิบ → จำนวน + หน่วย + คลัง Input' },
                    { text: 'เมื่อผลิตจริง: กด ✅ ผลิต → ตัด Input + เพิ่ม Output สต็อคอัตโนมัติ' },
                ],
                tips: [
                    { type: 'info', text: 'ตัวอย่าง: "หมูหมัก" 10 kg จาก หมูสาม 12 kg + น้ำปลา 200 ml + กระเทียม 100 g' },
                    { type: 'tip', text: 'BOM เมนูสามารถ link ไปที่ Prep Item แทนวัตถุดิบดิบได้' },
                ],
            },
            {
                id: 'sku-queue',
                icon: '🔍',
                title: 'SKU Queue',
                subtitle: 'จัดการรายการที่ระบบยังไม่จับคู่ SKU',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ SKU Queue จาก Sidebar' },
                    { text: 'ดูรายการเมนูที่ Import แต่ยังไม่ Match กับ Recipe' },
                    { text: 'กด Match → เลือก Recipe ที่ตรงกัน' },
                    { text: 'หรือกด สร้าง Recipe ใหม่ → ระบบพาไป /recipes' },
                ],
            },
            {
                id: 'uom',
                icon: '🔄',
                title: 'หน่วยแปลง (UOM Conversion)',
                subtitle: 'ตั้งค่าการแปลงหน่วยวัดสำหรับตัดสต็อค',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ หน่วยแปลง (UOM) จาก Settings' },
                    { text: 'กด ➕ เพิ่มการแปลง: สินค้า → 1 ถุง = 500 กรัม' },
                    { text: 'บันทึก — ระบบใช้อัตราแปลงนี้ตอนตัดสต็อคโดยอัตโนมัติ' },
                ],
                tips: [
                    { type: 'info', text: 'BOM เขียนว่า 1 ถุง แต่สต็อคบันทึกเป็น กรัม → ต้องตั้ง UOM: 1 ถุง = 500 กรัม' },
                ],
            },
        ],
    },

    settings: {
        sections: [
            {
                id: 'reports',
                icon: '📈',
                title: 'Reports & รายงาน',
                subtitle: 'ดูยอดขาย, ต้นทุน, การซื้อ',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ Reports จาก Sidebar' },
                    { text: 'รายงานที่มี:', sub: ['ยอดขายรายวัน/สัปดาห์/เดือน', 'ต้นทุนต่อเมนู (Theoretical)', 'วิเคราะห์การสั่งซื้อ (AI Purchase Analysis)', 'Stock Movement history'] },
                    { text: 'กด AI Analyze: วิเคราะห์สินค้าที่ซื้อเกิน (Over-bought)' },
                    { text: 'Export: กด 📥 Download เพื่อดาวน์โหลด Excel' },
                ],
            },
            {
                id: 'ai-chat',
                icon: '🤖',
                title: 'AI Assistant',
                subtitle: 'ถามคำถามเกี่ยวกับร้านด้วย AI',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ AI Assistant จาก Sidebar' },
                    { text: 'พิมพ์คำถาม เช่น:', sub: ['"สรุปยอดขายวันนี้"', '"วัตถุดิบไหนใกล้หมด?"', '"แนะนำเมนูที่ทำกำไรดี"'] },
                    { text: 'กด Enter หรือ 📤 ส่ง — AI ตอบภาษาไทย' },
                ],
                tips: [
                    { type: 'info', text: 'AI มี Budget จำกัด — ดูยอดใช้ที่มุมขวาบน ($x.xx remaining)' },
                ],
            },
            {
                id: 'categories',
                icon: '📂',
                title: 'จัดการหมวดหมู่',
                subtitle: 'สร้างหมวดหมู่สินค้าและเมนู',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ จัดการหมวดหมู่ จาก Settings' },
                    { text: 'กด ➕ เพิ่มหมวดหมู่ → กรอกชื่อ, ไอคอน (Emoji), สี' },
                    { text: 'กำหนด Route to Kitchen/Bar: ออเดอร์ในหมวดนี้ไปที่ KDS ใด' },
                    { text: 'บันทึก — ปรากฏใน POS, Menu, Products' },
                ],
            },
            {
                id: 'locations',
                icon: '🏭',
                title: 'จัดการคลัง (Locations)',
                subtitle: 'ตั้งค่าคลังสินค้าต่างๆ',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ระบบมาพร้อม Location มาตรฐาน:', sub: ['WH_MAIN — คลังกลาง', 'WH_FRESH — ของสด', 'KIT_STOCK — ครัว', 'BAR_STOCK — บาร์', 'FR_FREEZER — ตู้แช่'] },
                    { text: 'กด ➕ เพิ่มคลังใหม่ → ตั้ง Code + ชื่อ + ประเภท' },
                    { text: 'ปิด Location: Toggle ปิด — ไม่ปรากฏใน Dropdown' },
                ],
                tips: [
                    { type: 'warn', text: 'ไม่แนะนำให้ลบ Location ที่มีสต็อคอยู่ — ให้ Disable แทน' },
                ],
            },
            {
                id: 'users',
                icon: '👥',
                title: 'จัดการผู้ใช้',
                subtitle: 'เพิ่ม/แก้ไข/ปิดบัญชีพนักงาน',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ จัดการผู้ใช้ → กด ➕ เพิ่มผู้ใช้' },
                    { text: 'กรอก: ชื่อ, Email, Password, Role' },
                    { text: 'รีเซ็ต Password: กด 🔑 → ตั้ง Password ใหม่' },
                    { text: 'ปิดบัญชี: Toggle ปิด — ยังเก็บข้อมูลไว้' },
                ],
                tips: [
                    { type: 'warn', text: 'ต้องมี Owner อย่างน้อย 1 คนเสมอ — ลบ Owner คนสุดท้ายไม่ได้' },
                ],
            },
            {
                id: 'qr-menu',
                icon: '📱',
                title: 'QR Menu โต๊ะ',
                subtitle: 'ให้ลูกค้าสแกน QR ดูเมนูตัวเอง',
                roles: ['Manager', 'Owner'],
                steps: [
                    { text: 'ไปที่ QR Menu โต๊ะ จาก Settings' },
                    { text: 'ดู QR Code ของแต่ละโต๊ะ' },
                    { text: 'กด 📥 Download PNG → พิมพ์ติดที่โต๊ะ' },
                    { text: 'ลูกค้าสแกน → เปิดเมนูในมือถือ ไม่ต้อง App' },
                ],
            },
        ],
    },
}

/* ────────────────────────────────────────────────────────────
   COMPONENT
──────────────────────────────────────────────────────────── */
export default function ManualPage() {
    const [activeTab, setActiveTab] = useState<TabId>('overview')
    const [openSection, setOpenSection] = useState<string | null>(null)

    const sections = CONTENT[activeTab].sections

    return (
        <div className="page-container" style={{ maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ marginBottom: 28, borderBottom: '2px solid var(--border)', paddingBottom: 18 }}>
                <h1 className="page-title">📖 คู่มือการใช้งาน KAIDEEDER</h1>
                <p className="page-subtitle">
                    ฉบับสมบูรณ์ — ครอบคลุมทุก feature &nbsp;•&nbsp; อัปเดต มี.ค. 2568
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
                {/* ── Left Tab Navigation ────────────────── */}
                <div style={{ position: 'sticky', top: 80 }}>
                    <div className="card" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setOpenSection(null) }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                                    color: activeTab === tab.id ? '#fff' : 'var(--text)',
                                    fontWeight: activeTab === tab.id ? 700 : 500,
                                    fontSize: '0.82rem', textAlign: 'left', width: '100%',
                                    fontFamily: 'inherit', transition: 'all 0.15s',
                                }}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}

                        {sections.length > 0 && (
                            <>
                                <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
                                {sections.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            setOpenSection(openSection === s.id ? null : s.id)
                                            setTimeout(() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                            background: openSection === s.id ? 'rgba(232,54,78,0.08)' : 'transparent',
                                            color: openSection === s.id ? 'var(--accent)' : 'var(--text-secondary)',
                                            fontWeight: openSection === s.id ? 600 : 400,
                                            fontSize: '0.74rem', textAlign: 'left', width: '100%',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        <span style={{ fontSize: '0.7rem' }}>{s.icon}</span>
                                        <span style={{ lineHeight: 1.3 }}>{s.title}</span>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* ── Right Content ─────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {sections.map((sec, idx) => {
                        const isOpen = openSection === null || openSection === sec.id
                        return (
                            <div
                                key={sec.id}
                                id={`sec-${sec.id}`}
                                className="card"
                                style={{ padding: 0, overflow: 'hidden', scrollMarginTop: 90 }}
                            >
                                {/* Section Header */}
                                <button
                                    onClick={() => setOpenSection(openSection === sec.id ? null : sec.id)}
                                    style={{
                                        width: '100%', border: 'none', cursor: 'pointer', background: 'none',
                                        padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 14,
                                        textAlign: 'left', fontFamily: 'inherit',
                                        borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                                    }}
                                >
                                    <span style={{
                                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.3rem',
                                        background: `hsl(${(idx * 47) % 360}, 55%, 94%)`,
                                    }}>
                                        {sec.icon}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{sec.title}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 1 }}>{sec.subtitle}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {sec.roles && sec.roles.filter(Boolean).map(r => (
                                            <span key={r} style={{
                                                fontSize: '0.65rem', padding: '2px 8px', borderRadius: 20,
                                                background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                                                fontWeight: 600, whiteSpace: 'nowrap',
                                            }}>{r}</span>
                                        ))}
                                        <span style={{
                                            color: 'var(--text-secondary)', fontSize: '0.75rem',
                                            transition: 'transform 0.2s', display: 'inline-block',
                                            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                        }}>▶</span>
                                    </div>
                                </button>

                                {/* Section Body */}
                                {isOpen && (
                                    <div style={{ padding: '1rem 1.25rem' }}>
                                        <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {sec.steps.map((step, si) => (
                                                <li key={si} style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.65 }}>
                                                    <span style={{ fontWeight: 500 }}>{step.text}</span>
                                                    {step.sub && (
                                                        <ul style={{ margin: '4px 0 0', padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {step.sub.map((s, si2) => (
                                                                <li key={si2} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>

                                        {sec.tips && sec.tips.length > 0 && (
                                            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {sec.tips.map((tip, ti) => (
                                                    <div key={ti} style={{
                                                        padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem', lineHeight: 1.55,
                                                        background: tip.type === 'warn' ? '#FFF8F0' : tip.type === 'tip' ? '#F0FDF4' : '#EFF6FF',
                                                        border: `1px solid ${tip.type === 'warn' ? '#FED7AA' : tip.type === 'tip' ? '#BBF7D0' : '#BFDBFE'}`,
                                                        color: tip.type === 'warn' ? '#9A3412' : tip.type === 'tip' ? '#166534' : '#1D4ED8',
                                                    }}>
                                                        {tip.type === 'warn' ? '⚠️ ' : tip.type === 'tip' ? '💡 ' : 'ℹ️ '}{tip.text}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {/* Footer */}
                    <div style={{
                        textAlign: 'center', padding: '1.5rem', borderRadius: 12, marginTop: 8,
                        background: 'linear-gradient(135deg, rgba(232,54,78,0.06), rgba(232,54,78,0.02))',
                        border: '1px solid rgba(232,54,78,0.15)',
                    }}>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: 4 }}>
                            📖 KAIDEEDER User Manual v1.0
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            มีปัญหาหรือข้อสงสัย — ใช้ 🤖 AI Assistant บน Sidebar ได้เลย
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
