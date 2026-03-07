'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useStoreBranding } from '@/hooks/useStoreBranding'

export default function ManualPage() {
    useRoleGuard(['owner', 'manager'])
    const branding = useStoreBranding()
    const storeName = branding.displayName || 'ร้านอาหาร'
    const printDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

    const handlePrint = () => {
        window.print()
    }

    return (
        <div style={{ fontFamily: "'Sarabun', 'Inter', sans-serif", padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
            {/* Toolbar — hidden on print */}
            <div className="no-print" style={{
                marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 20px',
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1A1D26' }}>📖 คู่มือการใช้งานระบบ</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>คลิกปุ่ม "ดาวน์โหลด PDF" เพื่อบันทึกเป็นไฟล์</p>
                </div>
                <button
                    onClick={handlePrint}
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

            {/* Print content */}
            <div id="manual-content">
                {/* Cover page */}
                <div style={{ textAlign: 'center', padding: '48px 0 40px', borderBottom: '3px double #000', marginBottom: 32, pageBreakAfter: 'avoid' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>🍽️</div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                        คู่มือการใช้งานระบบ POS & จัดการร้านอาหาร
                    </h1>
                    <div style={{ fontSize: '1.1rem', color: '#555', marginBottom: 4 }}>{storeName}</div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>จัดทำ: {printDate}</div>
                </div>

                {/* Table of Contents */}
                <Section title="📋 สารบัญ">
                    <ol style={{ lineHeight: 2, paddingLeft: 24 }}>
                        <li>ภาพรวมระบบและโครงสร้าง Role</li>
                        <li>เจ้าของร้าน / ผู้จัดการ (OWNER / MANAGER)</li>
                        <li>แคชเชียร์ (CASHIER) — ระบบ POS</li>
                        <li>พนักงานครัว (KITCHEN) — KDS</li>
                        <li>บาร์เทนเดอร์ (BAR) — KDS</li>
                        <li>พนักงานเสิร์ฟ (WAITER)</li>
                        <li>คลังสินค้า (WAREHOUSE)</li>
                        <li>ฝ่ายจัดซื้อ (PURCHASER)</li>
                        <li>Flow การทำงานครบวงจร</li>
                        <li>การตั้งค่าระบบ</li>
                    </ol>
                </Section>

                {/* Section 1 */}
                <Section title="1. ภาพรวมระบบและโครงสร้าง Role">
                    <p>ระบบนี้เป็นระบบจัดการร้านอาหารครบวงจร ประกอบด้วย:</p>
                    <ul style={{ lineHeight: 1.9, paddingLeft: 24 }}>
                        <li><b>POS (Point of Sale)</b> — รับออเดอร์และเก็บเงิน</li>
                        <li><b>KDS (Kitchen Display System)</b> — จอครัวแสดงออเดอร์แบบ real-time</li>
                        <li><b>Waiter Display</b> — แจ้งพนักงานเสิร์ฟอาหารพร้อม</li>
                        <li><b>Stock Management</b> — จัดการสต็อควัตถุดิบ</li>
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

                {/* Section 2 */}
                <Section title="2. เจ้าของร้าน / ผู้จัดการ (OWNER / MANAGER)">
                    <Steps items={[
                        'เข้าระบบที่ http://localhost:3000 → กรอก Email + Password',
                        'Dashboard — ดูภาพรวม ยอดขายวัน, ออเดอร์ที่เปิดอยู่, สต็อคต่ำ',
                        'เมนูร้าน (/menu) — เพิ่ม/แก้ไข/ลบเมนูอาหาร, กำหนดราคา, หมวดหมู่',
                        'วัตถุดิบ (/products) — จัดการวัตถุดิบ ราคาต้นทุน, unit',
                        'สูตรอาหาร (/recipes) — กำหนด BOM (Bill of Materials) ว่าเมนูใช้วัตถุดิบอะไรบ้าง',
                        'สต็อค (/inventory) — ดูสต็อคทั้งหมด',
                        'ปรับสต็อค (/adjustment) — ปรับยอดสต็อค',
                        'ซื้อเข้า (/purchase) — สร้างใบสั่งซื้อ GR',
                        'รายงาน (/reports) — ดูยอดขาย, สต็อค, กำไร',
                        'ตั้งค่าผู้ใช้ (/settings/users) — เพิ่ม/แก้ไขพนักงาน กำหนด Role',
                    ]} />
                </Section>

                {/* Section 3 */}
                <Section title="3. แคชเชียร์ (CASHIER) — ระบบ POS">
                    <Steps items={[
                        'เข้าระบบ → คลิก "POS ขายหน้าร้าน" ในเมนูซ้ายมือ',
                        'เลือกโต๊ะที่มีจุดสีเขียว (AVAILABLE) ที่ต้องการเปิดบิล',
                        'คลิก "➕ เพิ่ม" เพื่อเปิดเมนูอาหาร → เลือกหมวดหมู่ → คลิกเมนูที่ต้องการ',
                        'เพิ่มหลายเมนูซ้ำได้ — ตัวเลข badge จะเพิ่มขึ้น',
                        'เลื่อนลงดูตะกร้า — แก้จำนวน, เพิ่มหมายเหตุ, ยกเลิกรายการได้',
                        'กด "✓ สถานะ" — ส่งออเดอร์ไปครัว/บาร์ + บิลจะปริ้นอัตโนมัติ',
                        'เมื่อลูกค้าต้องการชำระ กด "เช็คบิล" → เลือกวิธีชำระ → กด "ยืนยันชำระ"',
                        'โต๊ะจะกลับสู่สถานะ AVAILABLE อัตโนมัติ',
                    ]} />
                    <Note>Pop-up บิลจะต้องอนุญาตให้ browser เปิด popup จาก localhost ก่อนครั้งแรก</Note>
                </Section>

                {/* Section 4 */}
                <Section title="4. พนักงานครัว (KITCHEN) — KDS">
                    <Steps items={[
                        'เข้าระบบ → คลิก "จอครัว (KDS)"',
                        'หน้าจอแสดงออเดอร์แบบ real-time โดยอัตโนมัติทุก 5 วินาที',
                        'Card ที่มีขอบสีแดง = ออเดอร์ใหม่ที่ยังไม่รับ',
                        'กด "👌 รับงาน" — เปลี่ยนสถานะเป็น "รับแล้ว"',
                        'กด "🔥 เริ่มทำ" — เปลี่ยนสถานะเป็น "กำลังทำ"',
                        'กด "✅ เสร็จแล้ว" — เปลี่ยนสถานะเป็น READY → พนักงานเสิร์ฟได้รับแจ้ง',
                        'แท็บ "บาร์" — กรองเฉพาะรายการเครื่องดื่ม',
                        'ตัวเลข badge สีส้ม/เหลือง = เวลาที่รอ (เขียว < 5 นาที, เหลือง < 10, แดง > 10)',
                    ]} />
                    <Note>พนักงานครัวจะได้รับการแจ้งเตือนเสียง "bing" เมื่อมีออเดอร์ใหม่</Note>
                </Section>

                {/* Section 5 */}
                <Section title="5. บาร์เทนเดอร์ (BAR) — KDS">
                    <Steps items={[
                        'เข้าระบบ → คลิก "จอครัว (KDS)"',
                        'คลิกแท็บ "🍺 บาร์" ด้านบน — จะแสดงเฉพาะรายการเครื่องดื่ม',
                        'สถานะปุ่มและ flow เดียวกับพนักงานครัว',
                        'เมื่อเตรียมเครื่องดื่มเสร็จ กด "✅ เสร็จแล้ว"',
                    ]} />
                </Section>

                {/* Section 6 */}
                <Section title="6. พนักงานเสิร์ฟ (WAITER)">
                    <Steps items={[
                        'เข้าระบบ → คลิก "หน้าเสิร์ฟ" ในเมนู',
                        'หน้าจอแสดงรายการอาหารที่ READY (พร้อมเสิร์ฟ) แบบ real-time',
                        'เสียงกริ่งจะดังเมื่อมีอาหารพร้อมใหม่',
                        'นำอาหารไปเสิร์ฟ → กด "🍽️ เสิร์ฟ" ทีละรายการ',
                        'หรือกด "✅ เสิร์ฟครบทั้งโต๊ะ" เมื่อนำออกหมดแล้ว',
                        'รายการจะหายออกจากหน้าจอเมื่อ mark SERVED แล้ว',
                    ]} />
                </Section>

                {/* Section 7 */}
                <Section title="7. คลังสินค้า (WAREHOUSE)">
                    <Steps items={[
                        'สต็อค (/inventory) — ดูยอดสต็อคทุก location',
                        'รับของเข้า (/quick-receive) — บันทึกรับวัตถุดิบรายวัน',
                        'ปรับสต็อค (/adjustment) — แก้ไขยอดสต็อค (สูญหาย, นับใหม่)',
                        'บันทึก Waste (/quick-waste) — บันทึกของเสีย/ของสูญเสีย',
                        'โอนสต็อค (/transfer) — โอนระหว่าง location',
                    ]} />
                </Section>

                {/* Section 8 */}
                <Section title="8. ฝ่ายจัดซื้อ (PURCHASER)">
                    <Steps items={[
                        'ซื้อเข้า/GR (/purchase) — สร้างใบ GR เมื่อรับของจากซัพพลายเออร์',
                        'ดูสต็อค (/inventory) — ตรวจสอบสต็อคก่อนสั่งซื้อ',
                        'รับของเข้า (/quick-receive) — บันทึกรับสินค้า',
                    ]} />
                </Section>

                {/* Section 9 */}
                <Section title="9. Flow การทำงานครบวงจร">
                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 16, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 2 }}>
                            <b>CASHIER/OWNER</b> → เปิดโต๊ะ → เพิ่มเมนู → กด &quot;✓ สถานะ&quot;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ ส่งออเดอร์ + ปริ้นบิลอัตโนมัติ<br />
                            <b>KITCHEN/BAR</b> → รับงาน → เริ่มทำ → เสร็จแล้ว (READY)<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ แจ้งเตือนพนักงานเสิร์ฟ<br />
                            <b>WAITER</b> → เห็นอาหาร READY → นำเสิร์ฟ → กด &quot;เสิร์ฟ&quot;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓<br />
                            <b>CASHIER</b> → เช็คบิล → ชำระ → โต๊ะ AVAILABLE → ตัดสต็อคอัตโนมัติ
                        </div>
                    </div>
                </Section>

                {/* Section 10 */}
                <Section title="10. การตั้งค่าระบบ (Settings)">
                    <Steps items={[
                        'ตั้งค่าผู้ใช้ (/settings/users) — เพิ่ม/ลบพนักงาน กำหนด Role',
                        'โปรไฟล์ร้าน — แก้ไขชื่อร้าน โลโก้',
                        'คู่มือการใช้งาน (หน้านี้) — ดาวน์โหลด PDF สำหรับแจกพนักงาน',
                    ]} />
                    <h4 style={{ marginTop: 12 }}>ขั้นตอนเพิ่มพนักงานใหม่:</h4>
                    <ol style={{ lineHeight: 1.9, paddingLeft: 24 }}>
                        <li>ไปที่ ตั้งค่า → จัดการผู้ใช้</li>
                        <li>กด &quot;+ เพิ่มผู้ใช้&quot;</li>
                        <li>กรอกชื่อ, Email, รหัสผ่าน</li>
                        <li>เลือก Role ที่เหมาะสม</li>
                        <li>กด &quot;บันทึก&quot;</li>
                    </ol>
                </Section>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 48, paddingTop: 16, borderTop: '1px dashed #ccc', color: '#999', fontSize: '0.78rem' }}>
                    {storeName} | ระบบ POS & Stock Management | {printDate}
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    @page { size: A4; margin: 15mm; }
                    section { page-break-inside: avoid; }
                }
                table { page-break-inside: avoid; }
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
                <td key={i} style={{ padding: '5px 10px', textAlign: i === 0 ? 'left' : 'center', border: '1px solid #E2E8F0', fontWeight: i === 0 ? 700 : 400 }}>{c}</td>
            ))}
        </tr>
    )
}
