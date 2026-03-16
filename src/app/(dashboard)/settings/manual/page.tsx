'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useStoreBranding } from '@/hooks/useStoreBranding'
import { useEffect, useState } from 'react'

export default function ManualPage() {
    useRoleGuard(['owner', 'manager'])
    const branding = useStoreBranding()
    const storeName = branding.displayName || 'ร้านอาหาร'
    const [printDate, setPrintDate] = useState('')
    useEffect(() => {
        setPrintDate(new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }))
    }, [])

    return (
        <div style={{ fontFamily: "'Sarabun', 'Inter', sans-serif", padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
            {/* Toolbar */}
            <div className="no-print" style={{
                marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 20px',
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1A1D26' }}>📖 คู่มือการใช้งานระบบ</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>คลิกปุ่ม &quot;ดาวน์โหลด PDF&quot; เพื่อบันทึกเป็นไฟล์</p>
                </div>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: '10px 24px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg,#3B82F6,#2563EB)',
                        color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                        fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
                    }}
                >
                    📄 ดาวน์โหลด PDF
                </button>
            </div>

            <div id="manual-content">
                {/* Cover */}
                <div style={{ textAlign: 'center', padding: '48px 0 40px', borderBottom: '3px double #000', marginBottom: 32, pageBreakAfter: 'avoid' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>🍽️</div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                        คู่มือการใช้งานระบบ POS &amp; จัดการร้านอาหาร
                    </h1>
                    <div style={{ fontSize: '1.1rem', color: '#555', marginBottom: 4 }}>{storeName}</div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>จัดทำ: {printDate}</div>
                    <div style={{ marginTop: 12, display: 'inline-block', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '4px 14px', fontSize: '0.8rem', color: '#1D4ED8', fontWeight: 600 }}>
                        ✨ อัพเดต: QR Self-Order · จัดการคลัง · ย้ายสินค้า · บิล 80mm
                    </div>
                </div>

                {/* TOC */}
                <Section title="📋 สารบัญ">
                    <ol style={{ lineHeight: 2.1, paddingLeft: 24 }}>
                        <li>ภาพรวมระบบและโครงสร้าง Role</li>
                        <li>เจ้าของร้าน / ผู้จัดการ (OWNER / MANAGER)</li>
                        <li>แคชเชียร์ (CASHIER) — ระบบ POS</li>
                        <li>พนักงานครัว (KITCHEN) — KDS</li>
                        <li>บาร์เทนเดอร์ (BAR) — KDS</li>
                        <li>พนักงานเสิร์ฟ (WAITER)</li>
                        <li>คลังสินค้า (WAREHOUSE)</li>
                        <li>ฝ่ายจัดซื้อ (PURCHASER)</li>
                        <li>Flow การทำงานครบวงจร</li>
                        <li>การตั้งค่าระบบ (Settings)</li>
                        <li>✨ ใหม่: QR Self-Order — ลูกค้าสั่งเองที่โต๊ะ</li>
                        <li>✨ ใหม่: จัดการหมวดหมู่ &amp; ย้ายสินค้าผิดหมวด</li>
                        <li>✨ ใหม่: จัดการคลังสินค้า (Warehouse Locations)</li>
                    </ol>
                </Section>

                {/* §1 */}
                <Section title="1. ภาพรวมระบบและโครงสร้าง Role">
                    <p>ระบบนี้เป็นระบบจัดการร้านอาหารครบวงจร ประกอบด้วย:</p>
                    <ul style={{ lineHeight: 1.9, paddingLeft: 24 }}>
                        <li><b>POS (Point of Sale)</b> — รับออเดอร์และเก็บเงิน</li>
                        <li><b>KDS (Kitchen Display System)</b> — จอครัวแสดงออเดอร์แบบ real-time</li>
                        <li><b>QR Self-Order</b> — ลูกค้าสแกน QR ที่โต๊ะแล้วสั่งอาหารเองผ่านมือถือ</li>
                        <li><b>Waiter Display</b> — แจ้งพนักงานเสิร์ฟอาหารพร้อม</li>
                        <li><b>Stock Management</b> — จัดการสต็อควัตถุดิบและคลัง</li>
                        <li><b>Reports</b> — รายงานยอดขายและสต็อค</li>
                    </ul>
                    <h4 style={{ marginTop: 16 }}>ตารางสิทธิ์การเข้าถึง</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: '#1A1D26', color: '#fff' }}>
                                <Th>Role</Th><Th>POS</Th><Th>KDS</Th><Th>Waiter</Th><Th>สต็อค</Th><Th>จัดซื้อ</Th><Th>Reports</Th><Th>ตั้งค่า</Th>
                            </tr>
                        </thead>
                        <tbody>
                            <Tr cells={['OWNER 👑', '✅', '✅', '✅', '✅', '✅', '✅', '✅']} />
                            <Tr cells={['MANAGER', '✅', '✅', '✅', '✅', '✅', '✅', '❌']} alt />
                            <Tr cells={['CASHIER', '✅', '👁️', '❌', '❌', '❌', '✅', '❌']} />
                            <Tr cells={['KITCHEN', '❌', '✅', '❌', '❌', '❌', '❌', '❌']} alt />
                            <Tr cells={['BAR', '❌', '✅', '❌', '❌', '❌', '❌', '❌']} />
                            <Tr cells={['WAITER', '❌', '👁️', '✅', '❌', '❌', '❌', '❌']} alt />
                            <Tr cells={['WAREHOUSE', '❌', '❌', '❌', '✅', '✅', '✅', '❌']} />
                            <Tr cells={['PURCHASER', '❌', '❌', '❌', '👁️', '✅', '✅', '❌']} alt />
                        </tbody>
                    </table>
                    <p style={{ fontSize: '0.78rem', color: '#666', marginTop: 6 }}>✅ = เข้าถึงได้เต็ม · 👁️ = ดูได้อย่างเดียว · ❌ = ไม่มีสิทธิ์</p>
                </Section>

                {/* §2 */}
                <Section title="2. เจ้าของร้าน / ผู้จัดการ (OWNER / MANAGER)">
                    <Steps items={[
                        'เข้าระบบที่ kaideeder.com → กรอก Email + Password',
                        'Dashboard — ดูภาพรวม ยอดขายวัน, ออเดอร์ที่เปิดอยู่, สต็อคต่ำ',
                        'เมนูร้าน (/menu) — เพิ่ม/แก้ไข/ลบเมนูอาหาร, กำหนดราคาและหมวดหมู่',
                        'วัตถุดิบ (/products) — จัดการวัตถุดิบ ราคาต้นทุน, unit',
                        'สูตรอาหาร (/recipes) — กำหนด BOM ว่าเมนูใช้วัตถุดิบอะไร',
                        'สต็อค (/inventory) — ดูสต็อคทุก location',
                        'ปรับสต็อค (/adjustment) — ปรับยอดสต็อค',
                        'ซื้อเข้า (/purchase) — สร้างใบ GR รับสินค้า',
                        'รายงาน (/reports) — ดูยอดขาย, สต็อค, กำไร',
                        'ตั้งค่าผู้ใช้ (/settings/users) — เพิ่ม/แก้ไขพนักงาน กำหนด Role',
                        'QR Menu โต๊ะ (/settings/qr) — พิมพ์ QR ติดโต๊ะ',
                        'จัดการคลัง (/settings/locations) — สร้างหรือแก้ไข warehouse location',
                    ]} />
                </Section>

                {/* §3 */}
                <Section title="3. แคชเชียร์ (CASHIER) — ระบบ POS">
                    <Steps items={[
                        'เข้าระบบ → คลิก "POS ขายหน้าร้าน" ในเมนูซ้ายมือ',
                        'เลือกโต๊ะที่มีจุดสีเขียว (AVAILABLE) ที่ต้องการเปิดบิล',
                        'คลิก "➕ เพิ่ม" → เลือกหมวดหมู่ → คลิกเมนูที่ต้องการ',
                        'เพิ่มหลายเมนูซ้ำได้ — ปรับจำนวน เพิ่มหมายเหตุ ยกเลิกรายการได้',
                        'กด "✓ สถานะ" — ส่งออเดอร์ → ปริ้นบิลครัว/บาร์อัตโนมัติ (80mm thermal)',
                        'หากมีออเดอร์ "รอยืนยัน" จาก QR Self-Order → กด "✅ ยืนยัน" เพื่อส่งครัว',
                        'เมื่อลูกค้าต้องการชำระ กด "เช็คบิล" → เลือกวิธีชำระ → กด "ยืนยันชำระ"',
                        'โต๊ะจะกลับสู่สถานะ AVAILABLE อัตโนมัติ',
                    ]} />
                    <Note>Pop-up บิลต้องอนุญาตให้ browser เปิด popup จาก kaideeder.com ก่อนครั้งแรก — บิลครัว/บาร์ใช้กระดาษ 80mm thermal</Note>
                </Section>

                {/* §4 */}
                <Section title="4. พนักงานครัว (KITCHEN) — KDS">
                    <Steps items={[
                        'เข้าระบบ → คลิก "จอครัว (KDS)"',
                        'หน้าจอแสดงออเดอร์แบบ real-time อัตโนมัติทุก 5 วินาที',
                        'Card ที่มีขอบสีแดง = ออเดอร์ใหม่ที่ยังไม่รับ',
                        'กด "👌 รับงาน" — เปลี่ยนสถานะเป็น "รับแล้ว"',
                        'กด "🔥 เริ่มทำ" — เปลี่ยนสถานะเป็น "กำลังทำ"',
                        'กด "✅ เสร็จแล้ว" — เปลี่ยนสถานะเป็น READY → พนักงานเสิร์ฟได้รับแจ้ง',
                        'แท็บ "บาร์" — กรองเฉพาะรายการเครื่องดื่ม',
                        'ตัวเลขสีส้ม/เหลือง = เวลารอ (เขียว < 5 นาที, เหลือง < 10, แดง > 10)',
                    ]} />
                    <Note>พนักงานครัวจะได้รับเสียงแจ้งเตือน "bing" เมื่อมีออเดอร์ใหม่</Note>
                </Section>

                {/* §5 */}
                <Section title="5. บาร์เทนเดอร์ (BAR) — KDS">
                    <Steps items={[
                        'เข้าระบบ → คลิก "จอครัว (KDS)"',
                        'คลิกแท็บ "🍺 บาร์" ด้านบน — แสดงเฉพาะรายการเครื่องดื่ม',
                        'สถานะปุ่มและ flow เดียวกับพนักงานครัว',
                        'เมื่อเตรียมเครื่องดื่มเสร็จ กด "✅ เสร็จแล้ว"',
                    ]} />
                </Section>

                {/* §6 */}
                <Section title="6. พนักงานเสิร์ฟ (WAITER)">
                    <Steps items={[
                        'เข้าระบบ → คลิก "หน้าเสิร์ฟ"',
                        'หน้าจอแสดงรายการอาหาร READY (พร้อมเสิร์ฟ) แบบ real-time',
                        'เสียงกริ่งจะดังเมื่อมีอาหารพร้อมใหม่',
                        'นำอาหารไปเสิร์ฟ → กด "🍽️ เสิร์ฟ" ทีละรายการ',
                        'หรือกด "✅ เสิร์ฟครบทั้งโต๊ะ" เมื่อนำออกหมดแล้ว',
                        'รายการจะหายออกจากหน้าจอเมื่อ mark SERVED',
                    ]} />
                </Section>

                {/* §7 */}
                <Section title="7. คลังสินค้า (WAREHOUSE)">
                    <Steps items={[
                        'สต็อค (/inventory) — ดูยอดสต็อคทุก location',
                        'รับของเข้า (/quick-receive) — บันทึกรับวัตถุดิบรายวัน พิมพ์ชื่อหรือสแกน SKU',
                        'ปรับสต็อค (/adjustment) — แก้ไขยอด (สูญหาย, นับใหม่)',
                        'บันทึก Waste (/quick-waste) — บันทึกของเสีย/ของสูญเสีย',
                        'โอนสต็อค (/transfer) — โอนระหว่าง location',
                        'จัดการคลัง (/settings/locations) — เพิ่ม/ปิดใช้งาน location',
                    ]} />
                </Section>

                {/* §8 */}
                <Section title="8. ฝ่ายจัดซื้อ (PURCHASER)">
                    <Steps items={[
                        'ซื้อเข้า/GR (/purchase) — สร้างใบ GR เมื่อรับของจากซัพพลายเออร์',
                        'ดูสต็อค (/inventory) — ตรวจสอบสต็อคก่อนสั่งซื้อ',
                        'รับของเข้า (/quick-receive) — บันทึกรับสินค้าด่วน',
                    ]} />
                </Section>

                {/* §9 */}
                <Section title="9. Flow การทำงานครบวงจร">
                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 16, border: '1px solid #E2E8F0', marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 8 }}>🔷 Flow ปกติ (Cashier เปิดบิลเอง)</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 2 }}>
                            <b>CASHIER</b> → เปิดโต๊ะ → เพิ่มเมนู → กด &quot;✓&quot;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ ส่งออเดอร์ + ปริ้นบิลอัตโนมัติ<br />
                            <b>KITCHEN/BAR</b> → รับงาน → เริ่มทำ → เสร็จ (READY)<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ แจ้งพนักงานเสิร์ฟ<br />
                            <b>WAITER</b> → เสิร์ฟ → กด &quot;เสิร์ฟ&quot;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br />
                            <b>CASHIER</b> → เช็คบิล → ชำระ → โต๊ะ AVAILABLE → ตัดสต็อค
                        </div>
                    </div>
                    <div style={{ background: '#F0FDF4', borderRadius: 10, padding: 16, border: '1px solid #BBF7D0' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#166534', marginBottom: 8 }}>📱 Flow QR Self-Order (ลูกค้าสั่งเอง)</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 2, color: '#15803D' }}>
                            <b>ลูกค้า</b> → สแกน QR บนโต๊ะ → เลือกเมนู → ส่งออเดอร์<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ ออเดอร์ขึ้น POS สถานะ &quot;รอยืนยัน&quot;<br />
                            <b>CASHIER</b> → กด &quot;✅ ยืนยัน&quot; → ออเดอร์ OPEN<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ ส่งครัว/บาร์<br />
                            <b>KITCHEN/BAR → WAITER → CASHIER</b> → (เช่นเดิม)
                        </div>
                    </div>
                </Section>

                {/* §10 */}
                <Section title="10. การตั้งค่าระบบ (Settings)">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: '#1A1D26', color: '#fff' }}>
                                <Th>หน้า</Th><Th>ใช้ทำอะไร</Th><Th>สิทธิ์</Th>
                            </tr>
                        </thead>
                        <tbody>
                            <Tr cells={['/settings/categories', 'จัดการหมวดหมู่ + ย้ายสินค้าผิดหมวด', 'OWNER/MANAGER']} />
                            <Tr cells={['/settings/locations', 'จัดการ warehouse location + template', 'OWNER/MANAGER']} alt />
                            <Tr cells={['/settings/qr', 'สร้าง/พิมพ์ QR Code ติดโต๊ะ', 'OWNER/MANAGER']} />
                            <Tr cells={['/settings/users', 'เพิ่ม/ลบ/แก้ไขพนักงาน กำหนด Role', 'OWNER/MANAGER']} alt />
                            <Tr cells={['/settings/manual', 'คู่มือนี้ — ดาวน์โหลด PDF', 'OWNER/MANAGER']} />
                        </tbody>
                    </table>
                    <h4 style={{ marginTop: 14 }}>ขั้นตอนเพิ่มพนักงานใหม่:</h4>
                    <ol style={{ lineHeight: 1.9, paddingLeft: 24 }}>
                        <li>ไปที่ ตั้งค่า → จัดการผู้ใช้</li>
                        <li>กด &quot;+ เพิ่มผู้ใช้&quot;</li>
                        <li>กรอกชื่อ, Email, รหัสผ่าน</li>
                        <li>เลือก Role ที่เหมาะสม</li>
                        <li>กด &quot;บันทึก&quot;</li>
                    </ol>
                </Section>

                {/* §11 NEW */}
                <Section title="✨ 11. QR Self-Order — ลูกค้าสั่งอาหารเองที่โต๊ะ">
                    <p style={{ lineHeight: 1.8 }}>ฟีเจอร์นี้ช่วยให้ลูกค้าสั่งอาหารเองผ่านมือถือ <b>ไม่ต้องติดตั้ง App</b> — แค่สแกน QR แล้วเปิดเมนูได้ทันที</p>

                    <h4 style={{ marginTop: 14 }}>การติดตั้ง (admin/manager ทำครั้งเดียว):</h4>
                    <Steps items={[
                        'ไปที่ Settings → 📱 QR Menu โต๊ะ',
                        'เห็น QR Code ของทุกโต๊ะ — กดปุ่ม 🖨️ พิมพ์รายโต๊ะ หรือ "พิมพ์ QR ทุกโต๊ะ" พร้อมกัน',
                        'ตัด QR ขนาด 9×11 ซม. ติดบนโต๊ะแต่ละตัว',
                    ]} />

                    <h4 style={{ marginTop: 14 }}>Flow ลูกค้า:</h4>
                    <Steps items={[
                        'ลูกค้าสแกน QR → เปิดเมนูใน browser โดยอัตโนมัติ (URL: kaideeder.com/m/[code]/[เลขโต๊ะ])',
                        'เลือกหมวดหมู่ → กด "+ เพิ่ม" ที่เมนูที่ต้องการ',
                        'กด "ดูตะกร้า" → ตรวจสอบรายการ → กด "🍽️ ยืนยันสั่งอาหาร"',
                        'ลูกค้าเห็นหน้า "สั่งอาหารเรียบร้อยแล้ว ✅" พร้อมเลขออเดอร์',
                    ]} />

                    <h4 style={{ marginTop: 14 }}>Flow แคชเชียร์ (รับออเดอร์ QR):</h4>
                    <Steps items={[
                        'ออเดอร์จาก QR จะขึ้นใน POS สถานะ "🟡 รอยืนยัน" (PENDING_CONFIRM)',
                        'แคชเชียร์ตรวจสอบรายการ → กด "✅ ยืนยัน"',
                        'ออเดอร์เปลี่ยนเป็น OPEN → ส่งครัว/บาร์ → flow ปกติต่อไป',
                    ]} />
                    <Note>หากโต๊ะมีออเดอร์ OPEN อยู่แล้ว ระบบจะแจ้ง "โต๊ะนี้มีออเดอร์อยู่แล้ว กรุณาติดต่อพนักงาน" — ลูกค้าต้องแจ้งพนักงานให้รวมออเดอร์</Note>
                </Section>

                {/* §12 NEW */}
                <Section title="✨ 12. จัดการหมวดหมู่ &amp; ย้ายสินค้าผิดหมวด">
                    <p style={{ lineHeight: 1.8 }}>เมื่อโหลดข้อมูลสินค้าจากไฟล์ Excel อาจมีบางรายการอยู่ผิดหมวดหมู่ ใช้ฟีเจอร์นี้แก้ไขได้ง่าย</p>

                    <h4 style={{ marginTop: 14 }}>วิธีย้ายสินค้าผิดหมวด (ใช้ Auto-Select):</h4>
                    <Steps items={[
                        'ไปที่ Settings → 📂 จัดการหมวดหมู่',
                        'คลิกปุ่ม 📦 (ย้ายสินค้า) ที่หมวดที่ต้องการจัดการ',
                        'Modal จะแสดงสินค้าทั้งหมดในหมวด พร้อม badge ประเภท (🛒 ขายหน้าร้าน / 🥩 วัตถุดิบ / 📦 บรรจุภัณฑ์)',
                        'สินค้าที่มีเส้นขอบแดง + ป้าย "⚠️ ผิดประเภท" = มีประเภทไม่ตรงกับหมวด',
                        'กดปุ่ม "⚠️ เลือกผิดประเภทอัตโนมัติ (X)" — เลือกให้ทั้งหมดอัตโนมัติ',
                        'เลือกหมวดหมู่ปลายทาง → กด "ย้าย X รายการ"',
                    ]} />

                    <h4 style={{ marginTop: 14 }}>ทำความเข้าใจ productType:</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: '#374151', color: '#fff' }}>
                                <Th>ประเภท</Th><Th>badge</Th><Th>ควรอยู่ในหมวด</Th><Th>ขึ้น QR Menu</Th>
                            </tr>
                        </thead>
                        <tbody>
                            <Tr cells={['SALE_ITEM', '🛒 ขายหน้าร้าน', 'เมนูอาหาร / เมนูเครื่องดื่ม', '✅']} />
                            <Tr cells={['ENTERTAIN', '🎉 Entertain', 'เมนู / โปรโมชั่น', '✅']} alt />
                            <Tr cells={['RAW_MATERIAL', '🥩 วัตถุดิบ', 'หมวดวัตถุดิบ', '❌']} />
                            <Tr cells={['PACKAGING', '📦 บรรจุภัณฑ์', 'หมวดวัตถุดิบ', '❌']} alt />
                        </tbody>
                    </table>
                </Section>

                {/* §13 NEW */}
                <Section title="✨ 13. จัดการคลังสินค้า (Warehouse Locations)">
                    <p style={{ lineHeight: 1.8 }}>ระบบรองรับหลาย location (คลัง) สำหรับร้านที่มีพื้นที่เก็บของแยกกัน</p>

                    <h4 style={{ marginTop: 14 }}>สร้างคลังด้วย Template (แนะนำ):</h4>
                    <Steps items={[
                        'ไปที่ Settings → 🏭 จัดการคลัง',
                        'เลือก Template ที่เหมาะกับร้าน:',
                        '• 🏪 ร้านเล็ก — คลังหลักเดียว (WH_MAIN)',
                        '• 🍽️ ร้านอาหาร — คลังใหญ่ + ของสด + ครัว',
                        '• 🍺 ร้านอาหาร + บาร์ — เพิ่ม BAR_STOCK และตู้แช่',
                        '• 🏭 เต็มรูปแบบ — ทั้ง 7 คลัง',
                        'กด "🚀 ใช้ Template นี้" — ระบบสร้างคลังให้อัตโนมัติ (ข้ามรายการที่มีอยู่แล้ว)',
                    ]} />

                    <h4 style={{ marginTop: 14 }}>ประเภทคลังที่รองรับ:</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: '#374151', color: '#fff' }}>
                                <Th>ประเภท</Th><Th>ใช้สำหรับ</Th><Th>Code ตัวอย่าง</Th>
                            </tr>
                        </thead>
                        <tbody>
                            <Tr cells={['🏭 คลังหลัก', 'เก็บสินค้าหลักทั้งหมด', 'WH_MAIN']} />
                            <Tr cells={['🌿 คลังของสด', 'ผัก, เนื้อ, อาหารสด', 'WH_FRESH']} alt />
                            <Tr cells={['🍺 คลังเครื่องดื่ม', 'เบียร์, น้ำดื่ม, วัตถุดิบบาร์', 'WH_DRINKbar1']} />
                            <Tr cells={['❄️ ตู้แช่', 'ของแช่หน้าร้าน', 'FR_FREEZER']} alt />
                            <Tr cells={['🍳 ครัว', 'สต็อคพร้อมใช้ในครัว', 'KIT_STOCK']} />
                            <Tr cells={['🍸 บาร์', 'สต็อคพร้อมใช้ที่บาร์', 'BAR_STOCK']} alt />
                        </tbody>
                    </table>
                    <Note>หาก Quick Receive ขึ้น error ว่า "ไม่พบคลัง" ให้ตรวจสอบว่า location code ที่ใช้ใน Quick Receive มีอยู่ในระบบแล้ว (/settings/locations)</Note>
                </Section>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 48, paddingTop: 16, borderTop: '1px dashed #ccc', color: '#999', fontSize: '0.78rem' }}>
                    {storeName} | ระบบ POS &amp; Stock Management | {printDate}
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    @page { size: A4; margin: 15mm; }
                    section { page-break-inside: avoid; }
                    table { page-break-inside: avoid; }
                }
            `}</style>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ marginBottom: 32 }}>
            <h2 style={{
                fontSize: '1.1rem', fontWeight: 800, borderBottom: '2px solid #1A1D26',
                paddingBottom: 6, marginBottom: 12, color: '#1A1D26',
            }}>{title}</h2>
            {children}
        </section>
    )
}

function Steps({ items }: { items: string[] }) {
    return (
        <ol style={{ lineHeight: 1.9, paddingLeft: 24 }}>
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
    )
}

function Note({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 14px', marginTop: 10, fontSize: '0.83rem', color: '#92400E' }}>
            ⚠️ {children}
        </div>
    )
}

function Th({ children }: { children: React.ReactNode }) {
    return <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, border: '1px solid #374151' }}>{children}</th>
}

function Tr({ cells, alt }: { cells: string[]; alt?: boolean }) {
    return (
        <tr style={{ background: alt ? '#F8FAFC' : '#fff' }}>
            {cells.map((c, i) => (
                <td key={i} style={{ padding: '5px 10px', textAlign: i === 0 ? 'left' : 'center', border: '1px solid #E2E8F0', fontWeight: i === 0 ? 700 : 400, fontSize: '0.8rem' }}>{c}</td>
            ))}
        </tr>
    )
}
