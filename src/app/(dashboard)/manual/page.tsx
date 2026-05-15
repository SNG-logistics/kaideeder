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

                {/* Workflow SVG Diagram */}
                <div className="card" style={{ marginBottom: 24, padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 4 }}>🗺️ Workflow ภาพรวม — ทุก Role เชื่อมกันอย่างไร?</h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 20 }}>แต่ละ Role ส่งต่องานให้กัน → ระบบทำงานอัตโนมัติเมื่อครบวงจร</p>
                    <div style={{ overflowX: 'auto' }}>
                        <svg viewBox="0 0 860 340" style={{ width: '100%', minWidth: 700, height: 'auto', fontFamily: 'inherit' }}>
                            {/* ─── Definitions ─── */}
                            <defs>
                                <marker id="arrowR" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" />
                                </marker>
                                <marker id="arrowG" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <polygon points="0 0, 8 3, 0 6" fill="#059669" />
                                </marker>
                                <marker id="arrowP" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <polygon points="0 0, 8 3, 0 6" fill="#7C3AED" />
                                </marker>
                                <marker id="arrowO" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <polygon points="0 0, 8 3, 0 6" fill="#D97706" />
                                </marker>
                                <marker id="arrowB" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <polygon points="0 0, 8 3, 0 6" fill="#E8364E" />
                                </marker>
                            </defs>

                            {/* ─── ROW 1: Setup phase ─── */}
                            {/* Box: เจ้าของ/ผู้จัดการ */}
                            <rect x="10" y="20" width="150" height="72" rx="10" fill="#FFF5F6" stroke="#E8364E" strokeWidth="1.5"/>
                            <text x="85" y="40" textAnchor="middle" fontSize="16">👑</text>
                            <text x="85" y="57" textAnchor="middle" fontSize="10" fontWeight="700" fill="#E8364E">เจ้าของร้าน</text>
                            <text x="85" y="71" textAnchor="middle" fontSize="8.5" fill="#6B7280">ตั้งค่า · เพิ่มผู้ใช้</text>
                            <text x="85" y="84" textAnchor="middle" fontSize="8.5" fill="#6B7280">ตั้งค่าคลัง · หมวดหมู่</text>
                            {/* Arrow → */}
                            <line x1="160" y1="56" x2="200" y2="56" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#arrowR)"/>
                            <text x="180" y="50" textAnchor="middle" fontSize="7.5" fill="#9CA3AF">ตั้งค่า</text>

                            {/* Box: ระบบพร้อม */}
                            <rect x="200" y="36" width="100" height="40" rx="8" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1.5" strokeDasharray="4,2"/>
                            <text x="250" y="53" textAnchor="middle" fontSize="9" fontWeight="700" fill="#374151">⚙️ ระบบพร้อมใช้</text>
                            <text x="250" y="68" textAnchor="middle" fontSize="8" fill="#6B7280">Users, Warehouses</text>

                            {/* ─── ROW 2: Stock phase (center) ─── */}
                            {/* Arrow down from เจ้าของ */}
                            <line x1="85" y1="92" x2="85" y2="148" stroke="#7C3AED" strokeWidth="1.5" markerEnd="url(#arrowP)"/>
                            <text x="95" y="125" fontSize="7.5" fill="#7C3AED">มอบหมาย</text>

                            {/* Box: พนักงานคลัง */}
                            <rect x="10" y="148" width="150" height="72" rx="10" fill="#FAF5FF" stroke="#7C3AED" strokeWidth="1.5"/>
                            <text x="85" y="168" textAnchor="middle" fontSize="16">📦</text>
                            <text x="85" y="185" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7C3AED">พนักงานคลัง</text>
                            <text x="85" y="199" textAnchor="middle" fontSize="8.5" fill="#6B7280">เพิ่มวัตถุดิบ (RAW)</text>
                            <text x="85" y="212" textAnchor="middle" fontSize="8.5" fill="#6B7280">รับสินค้า GR · นับสต็อค</text>

                            {/* Arrow → to Inventory */}
                            <line x1="160" y1="184" x2="220" y2="184" stroke="#7C3AED" strokeWidth="1.5" markerEnd="url(#arrowP)"/>
                            <text x="190" y="178" textAnchor="middle" fontSize="7.5" fill="#7C3AED">เพิ่มสต็อค</text>

                            {/* Box: คลังวัตถุดิบ */}
                            <rect x="220" y="155" width="130" height="58" rx="10" fill="#F5F3FF" stroke="#7C3AED" strokeWidth="1.5"/>
                            <text x="285" y="175" textAnchor="middle" fontSize="13">🏪</text>
                            <text x="285" y="191" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#7C3AED">คลังวัตถุดิบ</text>
                            <text x="285" y="205" textAnchor="middle" fontSize="8" fill="#6B7280">Inventory Stock Level</text>

                            {/* ─── ROW 2 right: Menu phase ─── */}
                            {/* Box: ผู้จัดการเมนู */}
                            <rect x="430" y="20" width="150" height="72" rx="10" fill="#FFFBEB" stroke="#D97706" strokeWidth="1.5"/>
                            <text x="505" y="40" textAnchor="middle" fontSize="16">🍽️</text>
                            <text x="505" y="57" textAnchor="middle" fontSize="10" fontWeight="700" fill="#D97706">ผู้จัดการเมนู</text>
                            <text x="505" y="71" textAnchor="middle" fontSize="8.5" fill="#6B7280">สร้างเมนูอาหาร</text>
                            <text x="505" y="84" textAnchor="middle" fontSize="8.5" fill="#6B7280">ตั้งสูตร BOM Recipe</text>

                            {/* Arrow down from ผู้จัดการ */}
                            <line x1="505" y1="92" x2="505" y2="148" stroke="#D97706" strokeWidth="1.5" markerEnd="url(#arrowO)"/>
                            <text x="518" y="125" fontSize="7.5" fill="#D97706">กำหนดสูตร</text>

                            {/* Box: BOM Recipe */}
                            <rect x="430" y="148" width="150" height="72" rx="10" fill="#FEF9EC" stroke="#D97706" strokeWidth="1.5"/>
                            <text x="505" y="168" textAnchor="middle" fontSize="13">📋</text>
                            <text x="505" y="184" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#D97706">สูตร BOM Recipe</text>
                            <text x="505" y="198" textAnchor="middle" fontSize="8" fill="#6B7280">เมนู → วัตถุดิบที่ใช้</text>
                            <text x="505" y="211" textAnchor="middle" fontSize="8" fill="#6B7280">ข้าวขาหมู = หมู+ข้าว+ไข่</text>

                            {/* ─── CONVERGE: Inventory + BOM → POS ─── */}
                            {/* Arrow from คลัง to POS */}
                            <line x1="350" y1="184" x2="400" y2="260" stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#arrowP)"/>
                            <text x="355" y="230" fontSize="7.5" fill="#7C3AED">สต็อควัตถุดิบ</text>
                            {/* Arrow from BOM to POS */}
                            <line x1="505" y1="220" x2="505" y2="260" stroke="#D97706" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#arrowO)"/>
                            <text x="515" y="248" fontSize="7.5" fill="#D97706">สูตร</text>

                            {/* Box: POS หน้าร้าน (แคชเชียร์) */}
                            <rect x="395" y="260" width="160" height="68" rx="10" fill="#ECFDF5" stroke="#059669" strokeWidth="2"/>
                            <text x="475" y="280" textAnchor="middle" fontSize="16">🧾</text>
                            <text x="475" y="296" textAnchor="middle" fontSize="10" fontWeight="700" fill="#059669">แคชเชียร์ / POS</text>
                            <text x="475" y="310" textAnchor="middle" fontSize="8.5" fill="#6B7280">รับออเดอร์ · ชำระเงิน</text>
                            <text x="475" y="323" textAnchor="middle" fontSize="8.5" fill="#6B7280">ส่งครัว (KDS)</text>

                            {/* Arrow → to Kitchen */}
                            <line x1="555" y1="294" x2="615" y2="294" stroke="#059669" strokeWidth="1.5" markerEnd="url(#arrowG)"/>
                            <text x="585" y="287" textAnchor="middle" fontSize="7.5" fill="#059669">ออเดอร์</text>

                            {/* Box: KDS ครัว */}
                            <rect x="615" y="260" width="130" height="68" rx="10" fill="#FDF2F8" stroke="#DB2777" strokeWidth="1.5"/>
                            <text x="680" y="280" textAnchor="middle" fontSize="14">👨‍🍳</text>
                            <text x="680" y="296" textAnchor="middle" fontSize="10" fontWeight="700" fill="#DB2777">ครัว (KDS)</text>
                            <text x="680" y="310" textAnchor="middle" fontSize="8.5" fill="#6B7280">รับออเดอร์จาก POS</text>
                            <text x="680" y="323" textAnchor="middle" fontSize="8.5" fill="#6B7280">เตรียม → ✅ เสร็จ</text>

                            {/* Box: ตัดสต็อคอัตโนมัติ */}
                            <rect x="615" y="148" width="130" height="68" rx="10" fill="#ECFDF5" stroke="#059669" strokeWidth="1.5"/>
                            <text x="680" y="168" textAnchor="middle" fontSize="13">⚡</text>
                            <text x="680" y="184" textAnchor="middle" fontSize="9" fontWeight="700" fill="#059669">ตัดสต็อคอัตโนมัติ</text>
                            <text x="680" y="198" textAnchor="middle" fontSize="8" fill="#6B7280">หักวัตถุดิบตาม BOM</text>
                            <text x="680" y="211" textAnchor="middle" fontSize="8" fill="#6B7280">อัปเดตคลังทันที</text>

                            {/* Arrow: POS → ตัดสต็อค */}
                            <line x1="555" y1="275" x2="610" y2="210" stroke="#059669" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#arrowG)"/>
                            <text x="600" y="250" fontSize="7.5" fill="#059669">ยืนยัน</text>
                            {/* Arrow: ตัดสต็อค → back to คลัง (loop) */}
                            <line x1="615" y1="182" x2="365" y2="182" stroke="#059669" strokeWidth="1.2" strokeDasharray="4,3" markerEnd="url(#arrowG)"/>
                            <text x="490" y="177" textAnchor="middle" fontSize="7.5" fill="#059669">อัปเดตยอดคงเหลือ</text>

                            {/* Box: รายงาน */}
                            <rect x="750" y="20" width="100" height="58" rx="10" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5"/>
                            <text x="800" y="40" textAnchor="middle" fontSize="13">📊</text>
                            <text x="800" y="56" textAnchor="middle" fontSize="9" fontWeight="700" fill="#3B82F6">รายงาน</text>
                            <text x="800" y="70" textAnchor="middle" fontSize="8" fill="#6B7280">Dashboard · ยอดขาย</text>
                            {/* Arrow to report */}
                            <line x1="745" y1="180" x2="800" y2="78" stroke="#3B82F6" strokeWidth="1.2" strokeDasharray="4,3" markerEnd="url(#arrowB)"/>

                            {/* Legend */}
                            <text x="10" y="320" fontSize="8" fill="#9CA3AF">━━ ขั้นตอนหลัก</text>
                            <text x="100" y="320" fontSize="8" fill="#9CA3AF">- - - ข้อมูลส่งต่อ</text>
                        </svg>
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

                {/* Workflow SVG Diagram — print version */}
                <div style={{ marginBottom: 20, padding: '10px 14px', background: '#FFF5F6', border: '1px solid #FECDD3', borderRadius: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: '11pt', marginBottom: 8, color: '#E8364E' }}>🗺️ Workflow ภาพรวม — ทุก Role เชื่อมกันอย่างไร?</div>
                    <svg viewBox="0 0 860 340" style={{ width: '100%', height: 'auto', fontFamily: 'Noto Sans Thai, sans-serif' }}>
                        <defs>
                            <marker id="parrowR" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" /></marker>
                            <marker id="parrowG" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#059669" /></marker>
                            <marker id="parrowP" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#7C3AED" /></marker>
                            <marker id="parrowO" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#D97706" /></marker>
                            <marker id="parrowB" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#3B82F6" /></marker>
                        </defs>
                        {/* เจ้าของ */}
                        <rect x="10" y="20" width="150" height="72" rx="10" fill="#FFF5F6" stroke="#E8364E" strokeWidth="1.5"/>
                        <text x="85" y="40" textAnchor="middle" fontSize="16">👑</text>
                        <text x="85" y="57" textAnchor="middle" fontSize="10" fontWeight="700" fill="#E8364E">เจ้าของร้าน</text>
                        <text x="85" y="71" textAnchor="middle" fontSize="8.5" fill="#6B7280">ตั้งค่า · เพิ่มผู้ใช้</text>
                        <text x="85" y="84" textAnchor="middle" fontSize="8.5" fill="#6B7280">ตั้งค่าคลัง · หมวดหมู่</text>
                        <line x1="160" y1="56" x2="200" y2="56" stroke="#9CA3AF" strokeWidth="1.5" markerEnd="url(#parrowR)"/>
                        <text x="180" y="50" textAnchor="middle" fontSize="7.5" fill="#9CA3AF">ตั้งค่า</text>
                        <rect x="200" y="36" width="100" height="40" rx="8" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1.5" strokeDasharray="4,2"/>
                        <text x="250" y="53" textAnchor="middle" fontSize="9" fontWeight="700" fill="#374151">⚙️ ระบบพร้อมใช้</text>
                        <text x="250" y="68" textAnchor="middle" fontSize="8" fill="#6B7280">Users, Warehouses</text>
                        {/* คลัง */}
                        <line x1="85" y1="92" x2="85" y2="148" stroke="#7C3AED" strokeWidth="1.5" markerEnd="url(#parrowP)"/>
                        <text x="95" y="125" fontSize="7.5" fill="#7C3AED">มอบหมาย</text>
                        <rect x="10" y="148" width="150" height="72" rx="10" fill="#FAF5FF" stroke="#7C3AED" strokeWidth="1.5"/>
                        <text x="85" y="168" textAnchor="middle" fontSize="16">📦</text>
                        <text x="85" y="185" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7C3AED">พนักงานคลัง</text>
                        <text x="85" y="199" textAnchor="middle" fontSize="8.5" fill="#6B7280">เพิ่มวัตถุดิบ (RAW)</text>
                        <text x="85" y="212" textAnchor="middle" fontSize="8.5" fill="#6B7280">รับสินค้า GR · นับสต็อค</text>
                        <line x1="160" y1="184" x2="220" y2="184" stroke="#7C3AED" strokeWidth="1.5" markerEnd="url(#parrowP)"/>
                        <text x="190" y="178" textAnchor="middle" fontSize="7.5" fill="#7C3AED">เพิ่มสต็อค</text>
                        <rect x="220" y="155" width="130" height="58" rx="10" fill="#F5F3FF" stroke="#7C3AED" strokeWidth="1.5"/>
                        <text x="285" y="175" textAnchor="middle" fontSize="13">🏪</text>
                        <text x="285" y="191" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#7C3AED">คลังวัตถุดิบ</text>
                        <text x="285" y="205" textAnchor="middle" fontSize="8" fill="#6B7280">Inventory Stock Level</text>
                        {/* ผู้จัดการเมนู */}
                        <rect x="430" y="20" width="150" height="72" rx="10" fill="#FFFBEB" stroke="#D97706" strokeWidth="1.5"/>
                        <text x="505" y="40" textAnchor="middle" fontSize="16">🍽️</text>
                        <text x="505" y="57" textAnchor="middle" fontSize="10" fontWeight="700" fill="#D97706">ผู้จัดการเมนู</text>
                        <text x="505" y="71" textAnchor="middle" fontSize="8.5" fill="#6B7280">สร้างเมนูอาหาร</text>
                        <text x="505" y="84" textAnchor="middle" fontSize="8.5" fill="#6B7280">ตั้งสูตร BOM Recipe</text>
                        <line x1="505" y1="92" x2="505" y2="148" stroke="#D97706" strokeWidth="1.5" markerEnd="url(#parrowO)"/>
                        <text x="518" y="125" fontSize="7.5" fill="#D97706">กำหนดสูตร</text>
                        <rect x="430" y="148" width="150" height="72" rx="10" fill="#FEF9EC" stroke="#D97706" strokeWidth="1.5"/>
                        <text x="505" y="168" textAnchor="middle" fontSize="13">📋</text>
                        <text x="505" y="184" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#D97706">สูตร BOM Recipe</text>
                        <text x="505" y="198" textAnchor="middle" fontSize="8" fill="#6B7280">เมนู → วัตถุดิบที่ใช้</text>
                        <text x="505" y="211" textAnchor="middle" fontSize="8" fill="#6B7280">ข้าวขาหมู = หมู+ข้าว+ไข่</text>
                        {/* POS */}
                        <line x1="350" y1="184" x2="400" y2="260" stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#parrowP)"/>
                        <text x="355" y="230" fontSize="7.5" fill="#7C3AED">สต็อควัตถุดิบ</text>
                        <line x1="505" y1="220" x2="505" y2="260" stroke="#D97706" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#parrowO)"/>
                        <text x="515" y="248" fontSize="7.5" fill="#D97706">สูตร</text>
                        <rect x="395" y="260" width="160" height="68" rx="10" fill="#ECFDF5" stroke="#059669" strokeWidth="2"/>
                        <text x="475" y="280" textAnchor="middle" fontSize="16">🧾</text>
                        <text x="475" y="296" textAnchor="middle" fontSize="10" fontWeight="700" fill="#059669">แคชเชียร์ / POS</text>
                        <text x="475" y="310" textAnchor="middle" fontSize="8.5" fill="#6B7280">รับออเดอร์ · ชำระเงิน</text>
                        <text x="475" y="323" textAnchor="middle" fontSize="8.5" fill="#6B7280">ส่งครัว (KDS)</text>
                        {/* KDS */}
                        <line x1="555" y1="294" x2="615" y2="294" stroke="#059669" strokeWidth="1.5" markerEnd="url(#parrowG)"/>
                        <text x="585" y="287" textAnchor="middle" fontSize="7.5" fill="#059669">ออเดอร์</text>
                        <rect x="615" y="260" width="130" height="68" rx="10" fill="#FDF2F8" stroke="#DB2777" strokeWidth="1.5"/>
                        <text x="680" y="280" textAnchor="middle" fontSize="14">👨‍🍳</text>
                        <text x="680" y="296" textAnchor="middle" fontSize="10" fontWeight="700" fill="#DB2777">ครัว (KDS)</text>
                        <text x="680" y="310" textAnchor="middle" fontSize="8.5" fill="#6B7280">รับออเดอร์จาก POS</text>
                        <text x="680" y="323" textAnchor="middle" fontSize="8.5" fill="#6B7280">เตรียม → ✅ เสร็จ</text>
                        {/* ตัดสต็อค */}
                        <rect x="615" y="148" width="130" height="68" rx="10" fill="#ECFDF5" stroke="#059669" strokeWidth="1.5"/>
                        <text x="680" y="168" textAnchor="middle" fontSize="13">⚡</text>
                        <text x="680" y="184" textAnchor="middle" fontSize="9" fontWeight="700" fill="#059669">ตัดสต็อคอัตโนมัติ</text>
                        <text x="680" y="198" textAnchor="middle" fontSize="8" fill="#6B7280">หักวัตถุดิบตาม BOM</text>
                        <text x="680" y="211" textAnchor="middle" fontSize="8" fill="#6B7280">อัปเดตคลังทันที</text>
                        <line x1="555" y1="275" x2="610" y2="210" stroke="#059669" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#parrowG)"/>
                        <text x="600" y="250" fontSize="7.5" fill="#059669">ยืนยัน</text>
                        <line x1="615" y1="182" x2="365" y2="182" stroke="#059669" strokeWidth="1.2" strokeDasharray="4,3" markerEnd="url(#parrowG)"/>
                        <text x="490" y="177" textAnchor="middle" fontSize="7.5" fill="#059669">อัปเดตยอดคงเหลือ</text>
                        {/* รายงาน */}
                        <rect x="750" y="20" width="100" height="58" rx="10" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5"/>
                        <text x="800" y="40" textAnchor="middle" fontSize="13">📊</text>
                        <text x="800" y="56" textAnchor="middle" fontSize="9" fontWeight="700" fill="#3B82F6">รายงาน</text>
                        <text x="800" y="70" textAnchor="middle" fontSize="8" fill="#6B7280">Dashboard · ยอดขาย</text>
                        <line x1="745" y1="180" x2="800" y2="78" stroke="#3B82F6" strokeWidth="1.2" strokeDasharray="4,3" markerEnd="url(#parrowB)"/>
                        {/* Legend */}
                        <text x="10" y="320" fontSize="8" fill="#9CA3AF">━━ ขั้นตอนหลัก</text>
                        <text x="100" y="320" fontSize="8" fill="#9CA3AF">- - - ข้อมูลส่งต่อ</text>
                    </svg>
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
