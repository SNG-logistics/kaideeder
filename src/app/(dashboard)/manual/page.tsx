'use client'

const ROLES = [
    {
        id: 'owner',
        icon: '👑',
        title: 'เจ้าของร้าน / ผู้จัดการ',
        color: '#E8364E',
        bg: '#FFF5F6',
        border: '#FECDD3',
        desc: 'ตั้งค่าระบบ เพิ่มผู้ใช้ ดูรายงาน',
        sections: [
            {
                title: '1. ตั้งค่าร้านครั้งแรก',
                steps: [
                    { step: '1', text: 'เข้า เมนู ⚙️ การตั้งค่า → ข้อมูลร้าน → กรอกชื่อร้าน, โลโก้' },
                    { step: '2', text: 'ไปที่ การตั้งค่า → คลังสินค้า → สร้างคลังหลัก (ตั้งชื่อ เช่น "คลังหลัก")' },
                    { step: '3', text: 'ไปที่ การตั้งค่า → ผู้ใช้งาน → เพิ่มพนักงานแต่ละคน กำหนด Role ให้ถูกต้อง' },
                    { step: '4', text: 'ไปที่ คลังวัตถุดิบ (Catalog) → เพิ่มหมวดหมู่ เช่น เนื้อสัตว์, ผัก, เครื่องปรุง' },
                ],
            },
            {
                title: '2. ดูรายงานและยอดขาย',
                steps: [
                    { step: '1', text: 'Dashboard → ดูยอดขายวันนี้, สัปดาห์, เดือน' },
                    { step: '2', text: 'รายงาน → สรุปรายวัน / รายเดือน → กด Export PDF ได้' },
                    { step: '3', text: 'ยอดสต็อครายคลัง → ดูของคงเหลือทุกคลัง' },
                ],
            },
        ],
    },
    {
        id: 'warehouse',
        icon: '📦',
        title: 'พนักงานคลัง / จัดซื้อ',
        color: '#7C3AED',
        bg: '#FAF5FF',
        border: '#DDD6FE',
        desc: 'จัดการวัตถุดิบ รับสินค้า นับสต็อค',
        sections: [
            {
                title: '1. เพิ่มวัตถุดิบครั้งแรก',
                steps: [
                    { step: '1', text: 'ไปที่ คลังวัตถุดิบ (Catalog) → กด "+ เพิ่มวัตถุดิบ"' },
                    { step: '2', text: 'กรอก: รหัส (เช่น RAW001), ชื่อ (เช่น หมูสับ), หน่วย (กก.), ราคาทุน, คลังที่เก็บ' },
                    { step: '3', text: 'เลือก ประเภท = วัตถุดิบ (RAW_MATERIAL) — สำคัญมาก!' },
                    { step: '4', text: 'ตั้ง จำนวนขั้นต่ำ / จุดสั่งซื้อ เพื่อให้ระบบแจ้งเตือนเมื่อสต็อคต่ำ' },
                    { step: '5', text: 'กด บันทึก → วัตถุดิบจะปรากฏในระบบ พร้อมให้รับเข้าคลัง' },
                ],
            },
            {
                title: '2. รับสินค้าเข้าคลัง (GR)',
                steps: [
                    { step: '1', text: 'ไปที่ รับสินค้า / GR → กด "+ สร้างใหม่"' },
                    { step: '2', text: 'เลือกวันที่, ใส่เลขที่ใบส่งของ (ถ้ามี)' },
                    { step: '3', text: 'กด Catalog → เลือกวัตถุดิบที่รับเข้า หรือกด "AI อ่านบิล" เพื่อถ่ายรูปใบส่งของ' },
                    { step: '4', text: 'ใส่ จำนวนที่รับ และ ราคา/หน่วย' },
                    { step: '5', text: 'กด ✅ บันทึกรับสินค้า → สต็อคจะเพิ่มโดยอัตโนมัติ' },
                ],
            },
            {
                title: '3. นับสต็อค (Physical Count)',
                steps: [
                    { step: '1', text: 'ไปที่ นับสต็อค → กด "+ สร้างใบนับ"' },
                    { step: '2', text: 'ระบบจะดึงวัตถุดิบทั้งหมด (เฉพาะ RAW_MATERIAL) มาให้นับ' },
                    { step: '3', text: 'นับของจริงแล้วกรอกจำนวนในช่อง "นับได้"' },
                    { step: '4', text: 'กด ✅ ยืนยันการนับ → ระบบปรับยอดสต็อคให้ตรงกับของจริง' },
                    { step: '5', text: 'ใช้ ใบกรอกสต็อค (AI) → พิมพ์ใบว่างไปนับในคลังก่อน แล้วค่อยกรอกในระบบ' },
                ],
            },
            {
                title: '4. โอนสินค้าระหว่างคลัง',
                steps: [
                    { step: '1', text: 'ไปที่ เบิก / โอนคลัง → กด "+ สร้างใบโอน"' },
                    { step: '2', text: 'เลือก จาก-คลัง และ ไป-คลัง, เลือกวัตถุดิบ, ใส่จำนวน' },
                    { step: '3', text: 'กด ✅ ยืนยัน → สต็อคคลังต้นลด คลังปลายเพิ่ม' },
                ],
            },
        ],
    },
    {
        id: 'manager',
        icon: '🍽️',
        title: 'ผู้จัดการเมนู / เชฟใหญ่',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        desc: 'สร้างเมนูอาหาร ตั้งสูตร BOM',
        sections: [
            {
                title: '1. เพิ่มเมนูอาหาร (สินค้าขาย)',
                steps: [
                    { step: '1', text: 'ไปที่ เมนูอาหาร → กด "+ เพิ่มเมนู"' },
                    { step: '2', text: 'กรอก: รหัส (เช่น FD001), ชื่อเมนู (เช่น ข้าวขาหมู), ราคาขาย' },
                    { step: '3', text: 'เลือก ประเภท = เมนูอาหาร (SALE_ITEM) — ไม่นับสต็อคโดยตรง' },
                    { step: '4', text: 'ใส่รูปเมนู, หมวดหมู่, เปิด/ปิด แสดงใน QR Menu' },
                    { step: '5', text: 'กด บันทึก' },
                ],
            },
            {
                title: '2. สร้างสูตรสำเร็จ / BOM Recipe (สำคัญมาก!)',
                steps: [
                    { step: '1', text: 'ไปที่ สูตรเมนู (BOM) → กด "+ สร้างสูตร"' },
                    { step: '2', text: 'เลือก เมนูอาหาร ที่ต้องการตั้งสูตร (เช่น ข้าวขาหมู)' },
                    { step: '3', text: 'เพิ่มวัตถุดิบแต่ละรายการ: เช่น ข้าวสาร 200g, หมู 150g, ไข่ 1 ฟอง' },
                    { step: '4', text: 'ตั้ง yield (จำนวนที่ได้ต่อ 1 จาน)' },
                    { step: '5', text: 'กด บันทึก → เมื่อขายเมนูนี้ ระบบจะตัดวัตถุดิบตามสูตรอัตโนมัติ' },
                ],
            },
            {
                title: '3. สร้างสูตรเตรียม (Prep Recipe)',
                steps: [
                    { step: '1', text: 'ไปที่ สูตรเตรียมวัตถุดิบ (Prep) → กด "+ สร้าง"' },
                    { step: '2', text: 'ตัวอย่าง: "ต้มหมู 1kg" ใช้ หมูสด 1.2kg + เครื่องเทศ 50g' },
                    { step: '3', text: 'ตั้ง คลังผลผลิต และ จำนวนที่ได้' },
                    { step: '4', text: 'เมื่อเตรียมครัวเสร็จ ไปที่ สูตรเตรียม → บันทึกการผลิต → สต็อคจะปรับ' },
                ],
            },
        ],
    },
    {
        id: 'cashier',
        icon: '🧾',
        title: 'พนักงานแคชเชียร์ / เสิร์ฟ',
        color: '#059669',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        desc: 'รับออเดอร์ ชำระเงิน',
        sections: [
            {
                title: '1. รับออเดอร์ที่โต๊ะ',
                steps: [
                    { step: '1', text: 'ไปที่ POS ขายหน้าร้าน → เลือกโต๊ะที่ลูกค้านั่ง' },
                    { step: '2', text: 'กดเมนูที่ลูกค้าสั่ง → ระบุจำนวน, Topping (ถ้ามี)' },
                    { step: '3', text: 'กด ส่งครัว → ออเดอร์จะปรากฏที่จอครัว (KDS)' },
                    { step: '4', text: 'รอครัวเตรียม → เสิร์ฟ' },
                ],
            },
            {
                title: '2. ชำระเงิน',
                steps: [
                    { step: '1', text: 'เลือกโต๊ะ → กด ชำระเงิน' },
                    { step: '2', text: 'เลือกช่องทาง: เงินสด / QR / โอน / บัตร' },
                    { step: '3', text: 'ระบุจำนวนเงินรับ (กรณีเงินสด) → กด ✅ ยืนยัน' },
                    { step: '4', text: 'ระบบตัดสต็อควัตถุดิบอัตโนมัติตาม BOM Recipe' },
                    { step: '5', text: 'พิมพ์ใบเสร็จ / ส่ง Slip ได้ทันที' },
                ],
            },
        ],
    },
    {
        id: 'kitchen',
        icon: '👨‍🍳',
        title: 'พนักงานครัว (KDS)',
        color: '#DB2777',
        bg: '#FDF2F8',
        border: '#FBCFE8',
        desc: 'รับออเดอร์ เตรียมอาหาร',
        sections: [
            {
                title: '1. ใช้งานจอครัว (KDS)',
                steps: [
                    { step: '1', text: 'เปิดหน้า จอครัว (KDS) บน Tablet หรือ TV ในครัว' },
                    { step: '2', text: 'ออเดอร์ใหม่จะขึ้นอัตโนมัติ พร้อมเวลาสั่ง' },
                    { step: '3', text: 'เตรียมอาหารเสร็จ → กด ✅ เสร็จแล้ว' },
                    { step: '4', text: 'ออเดอร์จะย้ายไปหน้า "รอเสิร์ฟ" → แจ้งพนักงานเสิร์ฟ' },
                ],
            },
        ],
    },
]

export default function ManualPage() {
    return (
        <>
            <style>{`
                @media print {
                    aside, header, nav, .no-print { display: none !important; }
                    .print-area { display: block !important; }
                    body > div > div { margin-left: 0 !important; }
                    @page { margin: 15mm; size: A4; }
                    .role-card { break-inside: avoid; page-break-inside: avoid; }
                }
                @media screen { .print-area { display: none; } }
            `}</style>

            {/* ── SCREEN VIEW ── */}
            <div className="no-print" style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 14 }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>📖 คู่มือการใช้งาน KAIDEEDER</h1>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 3 }}>แบ่งตาม Role · ตั้งแต่เริ่มต้นจนถึงการขาย</p>
                    </div>
                    <button
                        onClick={() => window.print()}
                        style={{ padding: '0.6rem 1.25rem', borderRadius: 10, border: 'none', background: '#E8364E', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(232,54,78,0.3)' }}
                    >
                        🖨️ พิมพ์ / Export PDF
                    </button>
                </div>

                {/* Overview Flow */}
                <div className="card" style={{ marginBottom: 24, padding: '1.25rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14 }}>🗺️ ขั้นตอนภาพรวม (เริ่มจาก 0)</h2>
                    <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
                        {[
                            { n: '1', label: 'ตั้งค่าร้าน + เพิ่มผู้ใช้', icon: '⚙️', who: 'เจ้าของ' },
                            { n: '2', label: 'เพิ่มวัตถุดิบ (RAW)', icon: '📦', who: 'คลัง' },
                            { n: '3', label: 'รับสินค้าเข้าคลัง', icon: '🛒', who: 'คลัง' },
                            { n: '4', label: 'สร้างเมนู + ตั้งสูตร BOM', icon: '🍽️', who: 'ผู้จัดการ' },
                            { n: '5', label: 'ขายหน้าร้าน POS', icon: '🧾', who: 'แคชเชียร์' },
                            { n: '6', label: 'ระบบตัดสต็อคอัตโนมัติ', icon: '✅', who: 'อัตโนมัติ' },
                        ].map((s, i, arr) => (
                            <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ textAlign: 'center', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 10, minWidth: 110 }}>
                                    <div style={{ fontSize: '1.4rem' }}>{s.icon}</div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#E8364E', marginTop: 2 }}>ขั้น {s.n}</div>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 1 }}>{s.who}</div>
                                </div>
                                {i < arr.length - 1 && <div style={{ fontSize: '1.2rem', color: '#D1D5DB', padding: '0 4px' }}>→</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Role Cards */}
                {ROLES.map(role => (
                    <div key={role.id} className="role-card" style={{ marginBottom: 24, border: `1.5px solid ${role.border}`, borderRadius: 14, overflow: 'hidden' }}>
                        <div style={{ background: role.bg, padding: '1rem 1.25rem', borderBottom: `1.5px solid ${role.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: '1.8rem' }}>{role.icon}</div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: role.color }}>{role.title}</div>
                                <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 2 }}>{role.desc}</div>
                            </div>
                        </div>
                        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                            {role.sections.map(sec => (
                                <div key={sec.title}>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: role.color, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${role.border}` }}>
                                        {sec.title}
                                    </h3>
                                    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                                        {sec.steps.map(s => (
                                            <li key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: role.color, color: '#fff', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.step}</span>
                                                <span style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>{s.text}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── PRINT AREA ── */}
            <div className="print-area" style={{ display: 'none', fontFamily: 'Noto Sans Thai, sans-serif', fontSize: '10pt', color: '#111' }}>
                {/* Cover */}
                <div style={{ textAlign: 'center', padding: '40px 0 30px', borderBottom: '3px solid #E8364E', marginBottom: 28 }}>
                    <div style={{ fontSize: '28pt', fontWeight: 900, color: '#E8364E', letterSpacing: 2 }}>KAIDEEDER</div>
                    <div style={{ fontSize: '16pt', fontWeight: 700, marginTop: 8 }}>คู่มือการใช้งานระบบ</div>
                    <div style={{ fontSize: '10pt', color: '#666', marginTop: 6 }}>Restaurant & Stock Management Platform</div>
                    <div style={{ fontSize: '9pt', color: '#999', marginTop: 4 }}>พิมพ์วันที่: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>

                {/* Flow */}
                <div style={{ marginBottom: 24, padding: '12px 16px', background: '#FFF5F6', border: '1px solid #FECDD3', borderRadius: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: '11pt', marginBottom: 10, color: '#E8364E' }}>🗺️ ขั้นตอนภาพรวม (เริ่มจาก 0)</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                        <tbody>
                            <tr>
                                {['⚙️ ตั้งค่าร้าน', '📦 เพิ่มวัตถุดิบ', '🛒 รับสินค้า', '🍽️ สร้างเมนู+BOM', '🧾 ขาย POS', '✅ ตัดสต็อคอัตโนมัติ'].map((s, i) => (
                                    <td key={i} style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 600, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>{s}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Role Sections */}
                {ROLES.map(role => (
                    <div key={role.id} style={{ marginBottom: 20, pageBreakInside: 'avoid' }}>
                        <div style={{ background: '#f5f5f5', padding: '8px 14px', borderLeft: `5px solid ${role.color}`, marginBottom: 10 }}>
                            <span style={{ fontSize: '13pt', fontWeight: 900, color: role.color }}>{role.icon} {role.title}</span>
                            <span style={{ fontSize: '9pt', color: '#666', marginLeft: 10 }}>— {role.desc}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', paddingLeft: 10 }}>
                            {role.sections.map(sec => (
                                <div key={sec.title} style={{ marginBottom: 12, pageBreakInside: 'avoid' }}>
                                    <div style={{ fontWeight: 700, fontSize: '10pt', color: role.color, borderBottom: `1px dashed ${role.border}`, paddingBottom: 4, marginBottom: 7 }}>{sec.title}</div>
                                    {sec.steps.map(s => (
                                        <div key={s.step} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
                                            <span style={{ minWidth: 18, height: 18, background: role.color, color: '#fff', borderRadius: '50%', fontSize: '8pt', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.step}</span>
                                            <span style={{ fontSize: '9pt', lineHeight: 1.5 }}>{s.text}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div style={{ marginTop: 30, borderTop: '1px solid #ccc', paddingTop: 10, fontSize: '8pt', color: '#aaa', textAlign: 'center' }}>
                    KAIDEEDER System Manual · kaideeder.com · สงวนลิขสิทธิ์
                </div>
            </div>
        </>
    )
}
