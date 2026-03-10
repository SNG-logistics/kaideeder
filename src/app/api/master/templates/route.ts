import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'

/**
 * GET /api/master/templates?type=sku_master|categories|units|sku_aliases|stock_in|menu_recipe
 * ดาวน์โหลด Template Excel ตาม spec ที่ถูกต้อง
 */
export const GET = withAuth(async (req: NextRequest) => {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') ?? 'sku_master'

    const wb = XLSX.utils.book_new()

    switch (type) {

        case 'categories': {
            const rows = [
                { category_group: 'INGREDIENT', category_lv1: 'เนื้อโปรตีน',       category_lv2: 'หมู',                       scope: 'INGREDIENT', category_code: 'PROTEIN_PORK' },
                { category_group: 'INGREDIENT', category_lv1: 'เนื้อโปรตีน',       category_lv2: 'วัว/กบ/ไก่/เป็ด/เครื่องใน', scope: 'INGREDIENT', category_code: 'PROTEIN_MEAT' },
                { category_group: 'INGREDIENT', category_lv1: 'ซีฟู้ด',             category_lv2: 'ปลา/กุ้ง/หมึก/หอย/ปู',     scope: 'INGREDIENT', category_code: 'SEAFOOD' },
                { category_group: 'INGREDIENT', category_lv1: 'ไข่/นม/ชีส',        category_lv2: 'ไข่',                       scope: 'INGREDIENT', category_code: 'EGG' },
                { category_group: 'INGREDIENT', category_lv1: 'ไข่/นม/ชีส',        category_lv2: 'นม/ครีม/เนย/ชีส',          scope: 'INGREDIENT', category_code: 'DAIRY' },
                { category_group: 'INGREDIENT', category_lv1: 'ผัก/สมุนไพร',       category_lv2: 'ผัก/สมุนไพร',              scope: 'INGREDIENT', category_code: 'VEGHERB' },
                { category_group: 'INGREDIENT', category_lv1: 'เห็ด',               category_lv2: 'เห็ดสด/แห้ง',              scope: 'INGREDIENT', category_code: 'MUSHROOM' },
                { category_group: 'INGREDIENT', category_lv1: 'ของแห้ง/เส้น/ข้าว', category_lv2: 'ข้าว/เส้น/แป้ง/เครื่องปรุง/ซอส', scope: 'INGREDIENT', category_code: 'DRY_GOODS' },
                { category_group: 'INGREDIENT', category_lv1: 'แช่แข็ง',            category_lv2: 'ของแช่แข็ง/กึ่งสำเร็จ',    scope: 'INGREDIENT', category_code: 'FROZEN' },
                { category_group: 'SUPPLY',     category_lv1: 'บรรจุภัณฑ์/ของใช้', category_lv2: 'กล่อง/ถุง',               scope: 'SUPPLY',     category_code: 'BOX_BAG' },
                { category_group: 'SUPPLY',     category_lv1: 'บรรจุภัณฑ์/ของใช้', category_lv2: 'ทิชชู่/ผ้า/ทำความสะอาด', scope: 'SUPPLY',     category_code: 'TISSUE_CLEAN' },
                { category_group: 'SUPPLY',     category_lv1: 'บรรจุภัณฑ์/ของใช้', category_lv2: 'อุปกรณ์สิ้นเปลือง',      scope: 'SUPPLY',     category_code: 'DISPOSABLE' },
                { category_group: 'SALE_ITEM',  category_lv1: 'แอลกอฮอล์',         category_lv2: 'เบียร์ขวด/กระป๋อง',      scope: 'SALE_ITEM',  category_code: 'BEER' },
                { category_group: 'SALE_ITEM',  category_lv1: 'แอลกอฮอล์',         category_lv2: 'เบียร์สด/ทาวเวอร์',      scope: 'SALE_ITEM',  category_code: 'BEER_DRAFT' },
                { category_group: 'SALE_ITEM',  category_lv1: 'แอลกอฮอล์',         category_lv2: 'ไวน์',                    scope: 'SALE_ITEM',  category_code: 'WINE' },
                { category_group: 'SALE_ITEM',  category_lv1: 'แอลกอฮอล์',         category_lv2: 'โซจู',                    scope: 'SALE_ITEM',  category_code: 'SOJU' },
                { category_group: 'SALE_ITEM',  category_lv1: 'ไม่มีแอลกอฮอล์',   category_lv2: 'น้ำดื่ม/น้ำแข็ง',        scope: 'SALE_ITEM',  category_code: 'WATER' },
                { category_group: 'SALE_ITEM',  category_lv1: 'ไม่มีแอลกอฮอล์',   category_lv2: 'น้ำอัดลม/มิกเซอร์',      scope: 'SALE_ITEM',  category_code: 'SOFT_DRINK' },
                { category_group: 'SALE_ITEM',  category_lv1: 'กาแฟ/ชา/ปั่น',      category_lv2: 'กาแฟ',                    scope: 'SALE_ITEM',  category_code: 'COFFEE' },
                { category_group: 'SALE_ITEM',  category_lv1: 'กาแฟ/ชา/ปั่น',      category_lv2: 'ชา/โกโก้',               scope: 'SALE_ITEM',  category_code: 'TEA' },
                { category_group: 'SALE_ITEM',  category_lv1: 'กาแฟ/ชา/ปั่น',      category_lv2: 'โซดาผสม/น้ำผลไม้/ปั่น', scope: 'SALE_ITEM',  category_code: 'SMOOTHIE' },
                { category_group: 'MENU_FOOD',  category_lv1: 'อาหาร',              category_lv2: 'ปิ้งย่าง',               scope: 'MENU_ITEM',  category_code: 'FOOD_GRILL' },
                { category_group: 'MENU_FOOD',  category_lv1: 'อาหาร',              category_lv2: 'ทอด',                     scope: 'MENU_ITEM',  category_code: 'FOOD_FRY' },
                { category_group: 'MENU_FOOD',  category_lv1: 'อาหาร',              category_lv2: 'ต้ม/ซุป/แกง',            scope: 'MENU_ITEM',  category_code: 'FOOD_BOIL' },
                { category_group: 'MENU_FOOD',  category_lv1: 'อาหาร',              category_lv2: 'ยำ/สลัด/ลาบ',            scope: 'MENU_ITEM',  category_code: 'FOOD_SALAD' },
                { category_group: 'MENU_FOOD',  category_lv1: 'อาหาร',              category_lv2: 'ผัด',                     scope: 'MENU_ITEM',  category_code: 'FOOD_STIR' },
                { category_group: 'MENU_FOOD',  category_lv1: 'อาหาร',              category_lv2: 'ข้าว',                    scope: 'MENU_ITEM',  category_code: 'FOOD_RICE' },
                { category_group: 'MENU_FOOD',  category_lv1: 'อาหาร',              category_lv2: 'ทะเล',                    scope: 'MENU_ITEM',  category_code: 'FOOD_SEA' },
                { category_group: 'MENU_FOOD',  category_lv1: 'อาหาร',              category_lv2: 'ของทานเล่น',              scope: 'MENU_ITEM',  category_code: 'FOOD_SNACK' },
            ]
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'categories')
            break
        }

        case 'units': {
            const rows = [
                { unit_code: 'piece',   unit_name: 'ชิ้น',    to_base_g_or_ml: '',   note: 'นับจำนวน' },
                { unit_code: 'portion', unit_name: 'จาน/ที่',  to_base_g_or_ml: '',   note: 'สำหรับเมนู' },
                { unit_code: 'kg',      unit_name: 'กก.',      to_base_g_or_ml: 1000, note: 'base = กรัม' },
                { unit_code: 'g',       unit_name: 'กรัม',     to_base_g_or_ml: 1,    note: 'base unit (น้ำหนัก)' },
                { unit_code: 'l',       unit_name: 'ลิตร',     to_base_g_or_ml: 1000, note: 'base = มล.' },
                { unit_code: 'ml',      unit_name: 'มล.',       to_base_g_or_ml: 1,    note: 'base unit (ปริมาตร)' },
                { unit_code: 'bottle',  unit_name: 'ขวด',      to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'can',     unit_name: 'กระป๋อง', to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'pack',    unit_name: 'แพ็ค',     to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'box',     unit_name: 'กล่อง',    to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'bag',     unit_name: 'ถุง',       to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'sheet',   unit_name: 'แผ่น',     to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'block',   unit_name: 'ก้อน',     to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'bunch',   unit_name: 'กำ/ช่อ',  to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'head',    unit_name: 'หัว',      to_base_g_or_ml: '',   note: 'user-defined' },
                { unit_code: 'pcs',     unit_name: 'ฟอง',      to_base_g_or_ml: '',   note: 'ไข่' },
            ]
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'units')
            break
        }

        case 'sku_master': {
            const data = [
                { sku_code: 'PP001', name: 'หมูสามชั้น',             category_code: 'PROTEIN_PORK', base_unit: 'กก.', purchase_unit: 'กก.', purchase_to_base_multiplier: 1,  cost_price: 120,   sale_price: 0,     stock_qty: 5, aliases: 'หมู 3 ชั้น,สามชั้น', barcode: '', note: '' },
                { sku_code: 'VM001', name: 'กระเทียม',                category_code: 'VEGHERB',       base_unit: 'กก.', purchase_unit: 'กก.', purchase_to_base_multiplier: 1,  cost_price: 60,    sale_price: 0,     stock_qty: 2, aliases: 'garlic,กะเทียม',     barcode: '', note: '' },
                { sku_code: 'PM001', name: 'กบ ลอกหนัง',             category_code: 'PROTEIN_MEAT',  base_unit: 'กก.', purchase_unit: 'กก.', purchase_to_base_multiplier: 1,  cost_price: 80,    sale_price: 0,     stock_qty: 0, aliases: '',                    barcode: '', note: '' },
                { sku_code: '',      name: 'ตัวอย่าง: ไม่มี sku_code', category_code: '',             base_unit: 'กก.', purchase_unit: 'กก.', purchase_to_base_multiplier: 1,  cost_price: 0,     sale_price: 0,     stock_qty: 0, aliases: '',                    barcode: '', note: 'ระบบจะ fuzzy-match / สร้าง SKU ให้' },
                { sku_code: 'B001',  name: 'Beer Lao (ขวดใหญ่)',      category_code: 'BEER',          base_unit: 'ขวด', purchase_unit: 'ลัง', purchase_to_base_multiplier: 24, cost_price: 15000, sale_price: 25000, stock_qty: 2, aliases: 'เบียร์ลาว ขวดใหญ่', barcode: '', note: 'ต้นทุนต่อลัง' },
            ]
            const desc = [
                { คอลัมน์: 'sku_code',                       คำอธิบาย: 'รหัสสินค้า (ว่างได้ — ระบบ fuzzy-match/สร้างให้)' },
                { คอลัมน์: 'name',                           คำอธิบาย: 'ชื่อสินค้า (ภาษาไทย/อังกฤษ)' },
                { คอลัมน์: 'category_code',                  คำอธิบาย: 'รหัสหมวดหมู่ (ว่างได้ — ระบบเดาจากชื่อ) ดูได้จาก TEMPLATE_categories' },
                { คอลัมน์: 'base_unit',                      คำอธิบาย: 'หน่วยฐาน ที่ใช้ตัดสต็อก เช่น กก./ชิ้น/ขวด' },
                { คอลัมน์: 'purchase_unit',                  คำอธิบาย: 'หน่วยที่ซื้อมา เช่น ลัง/แพ็ค' },
                { คอลัมน์: 'purchase_to_base_multiplier',    คำอธิบาย: '1 purchase_unit = ? base_unit (เช่น 1 ลัง = 24 ขวด)' },
                { คอลัมน์: 'cost_price',                     คำอธิบาย: 'ต้นทุน (ต่อ purchase_unit)' },
                { คอลัมน์: 'sale_price',                     คำอธิบาย: 'ราคาขาย (0 สำหรับวัตถุดิบ)' },
                { คอลัมน์: 'stock_qty',                      คำอธิบาย: 'สต็อคเริ่มต้น (opening, หน่วย base_unit)' },
                { คอลัมน์: 'aliases',                        คำอธิบาย: 'ชื่อเรียกอื่น คั่นด้วย comma เช่น หมู 3 ชั้น,สามชั้น' },
            ]
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'sku_master')
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(desc), 'คำอธิบาย')
            break
        }

        case 'sku_aliases': {
            const rows = [
                { sku: 'PP001', alias: 'หมู 3 ชั้น', source: 'vendor_text' },
                { sku: 'PP001', alias: 'สามชั้น',     source: 'vendor_text' },
                { sku: 'VM001', alias: 'garlic',       source: 'vendor_text' },
                { sku: 'VM001', alias: 'กะเทียม',     source: 'typo' },
            ]
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'sku_aliases')
            break
        }

        case 'stock_in': {
            const data = [
                { date: '2026-03-11', vendor_name: 'ตลาดเช้า A', sku_code: 'PP001', qty: 2,  unit: 'กก.', unit_price: 120, note: 'ใบเสร็จ 001' },
                { date: '2026-03-11', vendor_name: 'ตลาดเช้า A', sku_code: 'VM001', qty: 1,  unit: 'กก.', unit_price: 60,  note: 'ใบเสร็จ 001' },
                { date: '2026-03-11', vendor_name: 'ร้าน B',     sku_code: '',      qty: 3,  unit: 'กก.', unit_price: 80,  note: 'ถ้าไม่มี sku_code ระบบ fuzzy-match' },
            ]
            const desc = [
                { คอลัมน์: 'date',        คำอธิบาย: 'วันที่รับของ (YYYY-MM-DD)' },
                { คอลัมน์: 'vendor_name', คำอธิบาย: 'ชื่อซัพพลายเออร์ (optional)' },
                { คอลัมน์: 'sku_code',    คำอธิบาย: 'รหัสสินค้า (ว่างได้ — ระบบ fuzzy-match)' },
                { คอลัมน์: 'qty',         คำอธิบาย: 'จำนวน' },
                { คอลัมน์: 'unit',        คำอธิบาย: 'หน่วย (base_unit หรือ purchase_unit)' },
                { คอลัมน์: 'unit_price',  คำอธิบาย: 'ราคาต่อหน่วย (₭)' },
                { คอลัมน์: 'note',        คำอธิบาย: 'หมายเหตุ / เลขใบเสร็จ' },
            ]
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'stock_in')
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(desc), 'คำอธิบาย')
            break
        }

        case 'menu_recipe': {
            const rows = [
                { menu_sku_code: 'FG001', menu_name: 'คอหมูย่าง', ingredient_sku_code: 'PP001', ingredient_name: 'หมูสามชั้น', qty: 200, unit: 'กรัม' },
                { menu_sku_code: 'FG001', menu_name: 'คอหมูย่าง', ingredient_sku_code: 'VM001', ingredient_name: 'กระเทียม',   qty: 5,   unit: 'กรัม' },
                { menu_sku_code: 'FG002', menu_name: 'กบผัดเนย',  ingredient_sku_code: 'PM001', ingredient_name: 'กบ ลอกหนัง', qty: 150, unit: 'กรัม' },
            ]
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'menu_recipe')
            break
        }

        default:
            return new NextResponse(JSON.stringify({ error: `type "${type}" ไม่รองรับ` }), { status: 400 })
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `TEMPLATE_${type}.xlsx`

    return new NextResponse(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        }
    })
}, ['OWNER', 'MANAGER'])
