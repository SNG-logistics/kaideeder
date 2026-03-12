/**
 * src/lib/i18n.ts
 * Simple bilingual dictionary: Thai (th) / Lao (lo)
 * Usage: const t = useTranslation(); t('save')
 */

export type Lang = 'th' | 'lo' | 'both'

type Dict = Record<string, string>

const th: Dict = {
    // ── Navigation items ──
    nav_pos: 'POS ขายหน้าร้าน',
    nav_kitchen: 'จอครัว (KDS)',
    nav_waiter: 'หน้าเสิร์ฟ',
    nav_home: 'Home',
    nav_menu: 'เมนูร้าน',
    nav_recipes: 'สูตรอาหาร (BOM)',
    nav_products: 'วัตถุดิบ / Stock',
    nav_inventory: 'สต็อคคลัง',
    nav_purchase: 'ซื้อเข้า / GR',
    nav_transfer: 'เบิก / โอนคลัง',
    nav_adjustment: 'ปรับสต็อค',
    nav_sales_import: 'นำเข้ายอดขาย',
    nav_sku_queue: 'SKU Queue',
    nav_reports: 'Reports',
    nav_ai: 'AI Assistant',
    nav_users: 'จัดการผู้ใช้',
    nav_manual: 'คู่มือการใช้งาน',
    nav_tables: 'จัดการโต๊ะและโซน',
    nav_quick_receive: 'รับสินค้าด่วน',
    nav_quick_waste: 'บันทึก Waste',
    nav_qr_sheets: 'พิมพ์ QR Sheet',
    // ── Dividers ──
    div_menu_stock: 'เมนู & สต็อค',
    div_manage: 'จัดการร้าน',
    // ── Roles ──
    role_owner: '👑 เจ้าของ',
    role_manager: '📊 ผู้จัดการ',
    role_purchaser: '🛒 ผู้ซื้อ',
    role_cashier: '💰 แคชเชียร์',
    role_kitchen: '🍳 ครัว',
    role_bar: '🍸 บาร์',
    role_warehouse: '🏭 คลัง',
    role_waiter: '🍽️ เสิร์ฟ',
    role_viewer: '👁 ดูข้อมูล',
    // ── Navigation (old keys kept) ──
    menu: 'เมนู & สต็อค',
    products: 'สินค้า',
    stock: 'คลังสินค้า',
    purchase: 'รับสินค้า',
    transfer: 'โอนย้าย',
    adjustment: 'ปรับสต็อค',
    reports: 'รายงาน',
    settings: 'ตั้งค่า',
    pos: 'POS',
    skuQueue: 'SKU Queue',

    // ── Actions ──
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    delete: 'ลบ',
    edit: 'แก้ไข',
    add: 'เพิ่ม',
    search: 'ค้นหา',
    import: 'นำเข้า',
    export: 'ส่งออก',
    approve: 'อนุมัติ',
    reject: 'ปฏิเสธ',
    confirm: 'ยืนยัน',
    close: 'ปิด',
    print: 'พิมพ์',
    rollback: 'ยกเลิกการนำเข้า',

    // ── Labels ──
    name: 'ชื่อ',
    sku: 'รหัสสินค้า',
    category: 'หมวดหมู่',
    unit: 'หน่วย',
    costPrice: 'ต้นทุน',
    salePrice: 'ราคาขาย',
    stockLabel: 'สต็อค',

    total: 'รวม',
    subtotal: 'ยอดรวม',
    tax: 'ภาษี',
    date: 'วันที่',
    note: 'หมายเหตุ',
    status: 'สถานะ',
    type: 'ประเภท',
    quantity: 'จำนวน',
    price: 'ราคา',
    amount: 'จำนวนเงิน',
    storeName: 'ชื่อร้าน',
    phone: 'เบอร์โทร',
    address: 'ที่อยู่',
    currency: 'สกุลเงิน',
    language: 'ภาษา',
    timezone: 'เขตเวลา',
    receiptHeader: 'หัวใบบิล',

    // ── Categories ──
    PROTEIN_PORK: 'เนื้อหมู',
    PROTEIN_MEAT: 'เนื้อสัตว์/ไก่/เป็ด/วัว',
    SEAFOOD: 'ซีฟู้ด',
    EGG: 'ไข่',
    DAIRY: 'นม/เนย/ชีส',
    VEGHERB: 'ผัก/สมุนไพร',
    MUSHROOM: 'เห็ด',
    DRY_GOODS: 'ของแห้ง/เส้น/เครื่องปรุง',
    FROZEN: 'แช่แข็ง/กึ่งสำเร็จ',
    BOX_BAG: 'กล่อง/ถุง',
    TISSUE_CLEAN: 'ทิชชู่/ผ้า/ล้าง',
    DISPOSABLE: 'อุปกรณ์สิ้นเปลือง',
    BEER: 'เบียร์',
    BEER_DRAFT: 'เบียร์สด/ทาวเวอร์',
    WINE: 'ไวน์/สุรา',
    SOJU: 'โซจู',
    WATER: 'น้ำดื่ม/น้ำแข็ง',
    SOFT_DRINK: 'น้ำอัดลม',
    COFFEE: 'กาแฟ',
    TEA: 'ชา/โกโก้',
    SMOOTHIE: 'ปั่น/น้ำผลไม้',
    FOOD_GRILL: 'ปิ้งย่าง',
    FOOD_FRY: 'ทอด',
    FOOD_BOIL: 'ต้ม/แกง',
    FOOD_SALAD: 'ยำ/ลาบ',
    FOOD_STIR: 'ผัด',
    FOOD_RICE: 'ข้าว',
    FOOD_SEA: 'อาหารทะเล',
    FOOD_SNACK: 'ของทานเล่น',
    ENTERTAIN: 'Entertain/บริการ',
    KARAOKE: 'คาราโอเกะ',
    SET: 'เซ็ต/โปร',

    // ── POS ──
    order: 'ออเดอร์',
    payment: 'ชำระเงิน',
    cash: 'เงินสด',
    change: 'เงินทอน',
    table: 'โต๊ะ',
    receipt: 'ใบเสร็จ',
    orderHistory: 'ประวัติออเดอร์',

    // ── Messages ──
    loading: 'กำลังโหลด...',
    noData: 'ไม่มีข้อมูล',
    success: 'สำเร็จ',
    error: 'เกิดข้อผิดพลาด',
    confirmDelete: 'ยืนยันการลบ?',
}

const lo: Dict = {
    // ── Navigation items (Lao) ──
    nav_pos: 'POS ຂາຍໜ້າຮ້ານ',
    nav_kitchen: 'ຈໍຄົວ (KDS)',
    nav_waiter: 'ໜ້າເສີບ',
    nav_home: 'Home',
    nav_menu: 'ເມນູຮ້ານ',
    nav_recipes: 'ສູດອາຫານ (BOM)',
    nav_products: 'ວັດຖຸດິບ / Stock',
    nav_inventory: 'ສະຕ໋ອກຄັງ',
    nav_purchase: 'ຊື້ເຂົ້າ / GR',
    nav_transfer: 'ເບີກ / ໂອນຄັງ',
    nav_adjustment: 'ປັບສະຕ໋ອກ',
    nav_sales_import: 'ນຳເຂົ້າຍອດຂາຍ',
    nav_sku_queue: 'SKU Queue',
    nav_reports: 'Reports',
    nav_ai: 'AI Assistant',
    nav_users: 'ຈັດການຜູ້ໃຊ້',
    nav_manual: 'ຄູ່ມືການໃຊ້ງານ',
    nav_tables: 'ຈັດການໂຕ໊ະແລະໂຊນ',
    nav_quick_receive: 'ຮັບສິນຄ້າດ່ວນ',
    nav_quick_waste: 'ບັນທຶກ Waste',
    nav_qr_sheets: 'ພິມ QR Sheet',
    // ── Dividers ──
    div_menu_stock: 'ເມນູ & ສະຕ໋ອກ',
    div_manage: 'ຈັດການຮ້ານ',
    // ── Roles ──
    role_owner: '👑 ເຈົ້າຂອງ',
    role_manager: '📊 ຜູ້ຈັດການ',
    role_purchaser: '🛒 ຜູ້ຊື້',
    role_cashier: '💰 ແຄດເຊຍ',
    role_kitchen: '🍳 ຄົວ',
    role_bar: '🍸 ບາ',
    role_warehouse: '🏭 ຄັງ',
    role_waiter: '🍽️ ເສີບ',
    role_viewer: '👁 ເບິ່ງຂໍ້ມູນ',
    // ── Navigation ──
    menu: 'ເມນູ & ສະຕ໋ອກ',
    products: 'ສິນຄ້າ',
    stock: 'ຄັງສິນຄ້າ',
    purchase: 'ຮັບສິນຄ້າ',
    transfer: 'ໂອນຍ້າຍ',
    adjustment: 'ປັບສະຕ໋ອກ',
    reports: 'ລາຍງານ',
    settings: 'ຕັ້ງຄ່າ',
    pos: 'POS',
    skuQueue: 'SKU Queue',

    // ── Actions ──
    save: 'ບັນທຶກ',
    cancel: 'ຍົກເລີກ',
    delete: 'ລຶບ',
    edit: 'ແກ້ໄຂ',
    add: 'ເພີ່ມ',
    search: 'ຄົ້ນຫາ',
    import: 'ນຳເຂົ້າ',
    export: 'ສົ່ງອອກ',
    approve: 'ອະນຸມັດ',
    reject: 'ປະຕິເສດ',
    confirm: 'ຢືນຢັນ',
    close: 'ປິດ',
    print: 'ພິມ',
    rollback: 'ຍົກເລີກການນຳເຂົ້າ',

    // ── Labels ──
    name: 'ຊື່',
    sku: 'ລະຫັດສິນຄ້າ',
    category: 'ໝວດໝູ່',
    unit: 'ໜ່ວຍ',
    costPrice: 'ຕົ້ນທຶນ',
    salePrice: 'ລາຄາຂາຍ',
    stockLabel: 'ສະຕ໋ອກ',

    total: 'ລວມ',
    subtotal: 'ຍອດລວມ',
    tax: 'ພາສີ',
    date: 'ວັນທີ',
    note: 'ໝາຍເຫດ',
    status: 'ສະຖານະ',
    type: 'ປະເພດ',
    quantity: 'ຈຳນວນ',
    price: 'ລາຄາ',
    amount: 'ຈຳນວນເງິນ',
    storeName: 'ຊື່ຮ້ານ',
    phone: 'ເບີໂທ',
    address: 'ທີ່ຢູ່',
    currency: 'ສະກຸນເງິນ',
    language: 'ພາສາ',
    timezone: 'ເຂດເວລາ',
    receiptHeader: 'ຫົວໃບບິນ',

    // ── Categories (แสดงภาษาลาว) ──
    PROTEIN_PORK: 'ຊີ້ນໝູ',
    PROTEIN_MEAT: 'ຊີ້ນສັດ/ໄກ່/ເປັດ/ງົວ',
    SEAFOOD: 'ອາຫານທະເລ',
    EGG: 'ໄຂ່',
    DAIRY: 'ນົມ/ເນີຍ/ຊີສ',
    VEGHERB: 'ຜັກ/ສະໝຸນໄພ',
    MUSHROOM: 'ເຫັດ',
    DRY_GOODS: 'ເຄື່ອງແຫ້ງ/ເສັ້ນ/ເຄື່ອງປຸງ',
    FROZEN: 'ແຊ່ແຂງ',
    BOX_BAG: 'ກ່ອງ/ຖົງ',
    TISSUE_CLEAN: 'ເຈ້ຍ/ຜ້າ/ລ້າງ',
    DISPOSABLE: 'ອຸປະກອນ',
    BEER: 'ເບຍ',
    BEER_DRAFT: 'ເບຍສົດ/ທາວເວີ',
    WINE: 'ໄວ/ເຫຼົ້າ',
    SOJU: 'ໂຊຈູ',
    WATER: 'ນໍ້າດື່ມ/ນໍ້າກ້ອນ',
    SOFT_DRINK: 'ນໍ້າອັດລົມ',
    COFFEE: 'ກາເຟ',
    TEA: 'ຊາ/ໂກໂກ',
    SMOOTHIE: 'ປັ່ນ/ນໍ້າໝາກໄມ້',
    FOOD_GRILL: 'ປີ້ງ/ຍ່າງ',
    FOOD_FRY: 'ທອດ',
    FOOD_BOIL: 'ຕົ້ມ/ແກງ',
    FOOD_SALAD: 'ຍຳ/ລາບ',
    FOOD_STIR: 'ຜັດ',
    FOOD_RICE: 'ເຂົ້າ',
    FOOD_SEA: 'ອາຫານທະເລ',
    FOOD_SNACK: 'ຂອງກິນ',
    ENTERTAIN: 'ບໍລິການ',
    KARAOKE: 'ຄາລາໂອເກະ',
    SET: 'ເຊັດ/ໂປ',

    // ── POS ──
    order: 'ອໍເດີ',
    payment: 'ຊຳລະເງິນ',
    cash: 'ເງິນສົດ',
    change: 'ເງິນທອນ',
    table: 'ໂຕະ',
    receipt: 'ໃບຮັບເງິນ',
    orderHistory: 'ປະຫວັດອໍເດີ',

    // ── Messages ──
    loading: 'ກຳລັງໂຫລດ...',
    noData: 'ບໍ່ມີຂໍ້ມູນ',
    success: 'ສຳເລັດ',
    error: 'ເກີດຂໍ້ຜິດພາດ',
    confirmDelete: 'ຢືນຢັນການລຶບ?',
}

/** คืน translation function สำหรับภาษาที่ระบุ */
export function getDict(lang: Lang): (key: string) => string {
    return (key: string) => {
        if (lang === 'lo') return lo[key] ?? th[key] ?? key
        // 'th' และ 'both' ใช้ไทยเป็นหลัก
        return th[key] ?? key
    }
}

/** คืนชื่อหมวดหมู่ภาษาที่ระบุ */
export function getCategoryName(code: string, lang: Lang): string {
    const t = getDict(lang)
    return t(code)
}

export { th as thDict, lo as loDict }
