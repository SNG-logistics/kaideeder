import { PrismaClient, LocationType, ProductType, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * prisma/seed.ts — re-seeded for multi-tenant schema
 *
 * Creates (or finds) the single "store-001" tenant, then upserts all master
 * data under that tenant using the new composite unique keys:
 *   categories:   [tenantId, code]
 *   locations:    [tenantId, code]
 *   users:        [tenantId, username]
 *   products:     [tenantId, sku]
 *   diningTables: [tenantId, number]
 */
async function main() {
    console.log('🌱 Seeding 43 Garden database (multi-tenant)...')

    // ──────────────────────────────────────────────────────────────────
    // 1. TENANT — find or create
    // ──────────────────────────────────────────────────────────────────
    let tenant = await (prisma as any).tenant.findUnique({ where: { code: 'store-001' } })
    if (!tenant) {
        tenant = await (prisma as any).tenant.create({
            data: { code: 'store-001', name: 'ร้าน 43 Garden', status: 'ACTIVE' },
        })
        console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`)
    } else {
        console.log(`ℹ️  Tenant found: ${tenant.name} (${tenant.id})`)
    }
    const tenantId: string = tenant.id

    // Seed Wallet
    const wallet = await (prisma as any).wallet.findUnique({ where: { tenantId } }).catch(() => null)
    if (!wallet) {
        await (prisma as any).wallet.create({ data: { tenantId, balanceLAK: 0 } })
        console.log('✅ Wallet created')
    }

    // ──────────────────────────────────────────────────────────────────
    // 2. LOCATIONS — composite unique [tenantId, code]
    // ──────────────────────────────────────────────────────────────────
    const locationDefs = [
        { code: 'WH_MAIN', name: 'คลังใหญ่', nameLao: 'ຄັງໃຫຍ່', type: LocationType.MAIN_WAREHOUSE, sortOrder: 1 },
        { code: 'WH_FRESH', name: 'คลังของสด', nameLao: 'ຄັງຂອງສົດ', type: LocationType.FRESH_STORAGE, sortOrder: 2 },
        { code: 'WH_DRINKbar1', name: 'คลังเครื่องดื่ม 1', nameLao: 'ຄັງເຄື່ອງດື່ມ 1', type: LocationType.DRINK_WAREHOUSE, sortOrder: 3 },
        { code: 'WH_DRINKbar2', name: 'คลังเครื่องดื่ม 2', nameLao: 'ຄັງເຄື່ອງດື່ມ 2', type: LocationType.DRINK_WAREHOUSE, sortOrder: 4 },
        { code: 'FR_FREEZER', name: 'ตู้แช่หน้าร้าน', nameLao: 'ຕູ້ແຊ່ໜ້າຮ້ານ', type: LocationType.DISPLAY_FREEZER, sortOrder: 5 },
        { code: 'KIT_STOCK', name: 'สต็อคครัว', nameLao: 'ສະຕ໋ອກເຄື່ອງຄົວ', type: LocationType.KITCHEN_STOCK, sortOrder: 6 },
        { code: 'BAR_STOCK', name: 'สต็อคบาร์', nameLao: 'ສະຕ໋ອກບາ', type: LocationType.BAR_STOCK, sortOrder: 7 },
    ]
    for (const loc of locationDefs) {
        await (prisma as any).location.upsert({
            where: { tenantId_code: { tenantId, code: loc.code } },
            update: {},
            create: { ...loc, tenantId },
        })
    }
    const locations = await (prisma as any).location.findMany({ where: { tenantId } })
    console.log(`✅ Locations: ${locations.length}`)

    // ──────────────────────────────────────────────────────────────────
    // 3. CATEGORIES — composite unique [tenantId, code]
    // ──────────────────────────────────────────────────────────────────
    const categoryDefs = [
        { code: 'BEER', name: 'เบียร์', nameEn: 'Beer', color: '#F59E0B', icon: '🍺' },
        { code: 'BEER_DRAFT', name: 'เบียร์สด/ทาวเวอร์', nameEn: 'Draft Beer', color: '#D97706', icon: '🍻' },
        { code: 'WINE', name: 'ไวน์/วิสกี้', nameEn: 'Wine/Whisky', color: '#7C3AED', icon: '🍷' },
        { code: 'COCKTAIL', name: 'ค็อกเทล', nameEn: 'Cocktail', color: '#EC4899', icon: '🍹' },
        { code: 'DRINK', name: 'เครื่องดื่ม', nameEn: 'Drink', color: '#06B6D4', icon: '🥤' },
        { code: 'WATER', name: 'น้ำดื่ม/น้ำแข็ง', nameEn: 'Water/Ice', color: '#38BDF8', icon: '💧' },
        { code: 'FOOD_GRILL', name: 'อาหารปิ้งย่าง', nameEn: 'Grilled Food', color: '#EF4444', icon: '🍖' },
        { code: 'FOOD_FRY', name: 'อาหารทอด', nameEn: 'Fried Food', color: '#F97316', icon: '🍟' },
        { code: 'FOOD_SEA', name: 'อาหารทะเล', nameEn: 'Seafood', color: '#3B82F6', icon: '🦐' },
        { code: 'FOOD_VEG', name: 'ผัก/ต้ม/แกง', nameEn: 'Veg/Soup', color: '#22C55E', icon: '🥦' },
        { code: 'FOOD_LAAB', name: 'ยำ/ลาบ', nameEn: 'Salad/Laab', color: '#84CC16', icon: '🥗' },
        { code: 'FOOD_RICE', name: 'ข้าว/ข้าวผัด', nameEn: 'Rice', color: '#CA8A04', icon: '🍚' },
        { code: 'FOOD_NOODLE', name: 'ก๋วยเตี๋ยว/เส้น', nameEn: 'Noodle', color: '#A16207', icon: '🍜' },
        { code: 'SET', name: 'โปร/เซ็ต', nameEn: 'Set/Promo', color: '#8B5CF6', icon: '🎯' },
        { code: 'KARAOKE', name: 'ห้องคาราโอเกะ', nameEn: 'Karaoke Room', color: '#EC4899', icon: '🎤' },
        { code: 'ENTERTAIN', name: 'Entertain/PR', nameEn: 'Entertainment', color: '#6B7280', icon: '🎭' },
        { code: 'RAW_MEAT', name: 'เนื้อสัตว์/ไก่', nameEn: 'Meat/Poultry', color: '#DC2626', icon: '🥩' },
        { code: 'RAW_PORK', name: 'เนื้อหมู', nameEn: 'Pork', color: '#F87171', icon: '🐷' },
        { code: 'RAW_SEA', name: 'อาหารทะเลดิบ', nameEn: 'Raw Seafood', color: '#0EA5E9', icon: '🦑' },
        { code: 'RAW_VEG', name: 'ผัก/วัตถุดิบสด', nameEn: 'Vegetables', color: '#16A34A', icon: '🥬' },
        { code: 'DRY_GOODS', name: 'เครื่องปรุง/แห้ง', nameEn: 'Dry Goods', color: '#92400E', icon: '🧂' },
        { code: 'PACKAGING', name: 'บรรจุภัณฑ์', nameEn: 'Packaging', color: '#9CA3AF', icon: '📦' },
        { code: 'EGG', name: 'ไข่ทุกชนิด', nameEn: 'Eggs', color: '#FBBF24', icon: '🥚' },
        { code: 'DAIRY', name: 'นม/ครีม/เนย', nameEn: 'Dairy', color: '#FDE68A', icon: '🥛' },
        { code: 'CHEESE', name: 'ชีสทุกชนิด', nameEn: 'Cheese', color: '#F59E0B', icon: '🧀' },
        { code: 'FLOUR_DOUGH', name: 'แป้ง/โดว์/พิซซ่าเบส', nameEn: 'Flour/Dough', color: '#D6D3D1', icon: '🫓' },
        { code: 'OTHER', name: 'อื่นๆ', nameEn: 'Other', color: '#6B7280', icon: '❓' },
    ]
    for (const cat of categoryDefs) {
        await (prisma as any).category.upsert({
            where: { tenantId_code: { tenantId, code: cat.code } },
            update: {},
            create: { ...cat, tenantId },
        })
    }
    const categories = await (prisma as any).category.findMany({ where: { tenantId } })
    const cat = Object.fromEntries(categories.map((c: any) => [c.code, c.id]))
    console.log(`✅ Categories: ${categories.length}`)

    // ──────────────────────────────────────────────────────────────────
    // 4. USERS — composite unique [tenantId, username]
    // ──────────────────────────────────────────────────────────────────
    const ownerHash = await bcrypt.hash('owner1234', 12)
    const managerHash = await bcrypt.hash('manager1234', 12)
    const staffHash = await bcrypt.hash('staff1234', 12)

    const userDefs = [
        { username: 'owner', passwordHash: ownerHash, name: 'เจ้าของร้าน', role: Role.OWNER },
        { username: 'manager', passwordHash: managerHash, name: 'ผู้จัดการ', role: Role.MANAGER },
        { username: 'warehouse', passwordHash: staffHash, name: 'คลังสินค้า', role: Role.WAREHOUSE },
        { username: 'kitchen', passwordHash: staffHash, name: 'ครัว', role: Role.KITCHEN },
        { username: 'bar', passwordHash: staffHash, name: 'บาร์', role: Role.BAR },
        { username: 'cashier', passwordHash: staffHash, name: 'แคชเชียร์', role: Role.CASHIER },
    ]
    for (const u of userDefs) {
        await (prisma as any).user.upsert({
            where: { tenantId_username: { tenantId, username: u.username } },
            update: {},
            create: { ...u, tenantId },
        })
    }
    console.log('✅ Users: 6')

    // ──────────────────────────────────────────────────────────────────
    // 5. DINING TABLES — composite unique [tenantId, number]
    // ──────────────────────────────────────────────────────────────────
    const tableDefs = [
        { number: 1, name: 'โต๊ะ 1', zone: 'ในร้าน', seats: 4 },
        { number: 2, name: 'โต๊ะ 2', zone: 'ในร้าน', seats: 4 },
        { number: 3, name: 'โต๊ะ 3', zone: 'ในร้าน', seats: 4 },
        { number: 4, name: 'โต๊ะ 4', zone: 'ในร้าน', seats: 6 },
        { number: 5, name: 'โต๊ะ 5', zone: 'ในร้าน', seats: 6 },
        { number: 6, name: 'โต๊ะ 6', zone: 'ในร้าน', seats: 2 },
        { number: 7, name: 'โต๊ะ 7', zone: 'ในร้าน', seats: 2 },
        { number: 8, name: 'โต๊ะ 8', zone: 'ในร้าน', seats: 8 },
        { number: 9, name: 'โต๊ะ 9', zone: 'ระเบียง', seats: 4 },
        { number: 10, name: 'โต๊ะ 10', zone: 'ระเบียง', seats: 4 },
        { number: 11, name: 'โต๊ะ 11', zone: 'ระเบียง', seats: 4 },
        { number: 12, name: 'โต๊ะ 12', zone: 'ระเบียง', seats: 6 },
        { number: 13, name: 'โต๊ะ 13', zone: 'ระเบียง', seats: 6 },
        { number: 14, name: 'โต๊ะ 14', zone: 'ระเบียง', seats: 4 },
        { number: 15, name: 'โต๊ะ 15', zone: 'ระเบียง', seats: 8 },
        { number: 16, name: 'VIP 1', zone: 'VIP', seats: 8 },
        { number: 17, name: 'VIP 2', zone: 'VIP', seats: 10 },
        { number: 18, name: 'VIP 3', zone: 'VIP', seats: 12 },
        { number: 19, name: 'VIP 4', zone: 'VIP', seats: 6 },
        { number: 20, name: 'VIP 5', zone: 'VIP', seats: 8 },
    ]
    for (const t of tableDefs) {
        await (prisma as any).diningTable.upsert({
            where: { tenantId_number: { tenantId, number: t.number } },
            update: { name: t.name, zone: t.zone, seats: t.seats },
            create: { ...t, tenantId, status: 'AVAILABLE' },
        })
    }
    console.log(`✅ Dining Tables: ${tableDefs.length}`)

    // ──────────────────────────────────────────────────────────────────
    // 6. PRODUCTS — composite unique [tenantId, sku]
    // ──────────────────────────────────────────────────────────────────
    const productDefs = [
        // เบียร์ขวด
        { sku: 'B001', name: 'Beer Lao ขวดใหญ่', unit: 'ขวด', salePrice: 30000, costPrice: 18000, reorderPoint: 24, minQty: 12, categoryId: cat['BEER'], productType: ProductType.SALE_ITEM },
        { sku: 'B002', name: 'Beer Lao กระป๋อง', unit: 'กระป๋อง', salePrice: 20000, costPrice: 12000, reorderPoint: 24, minQty: 12, categoryId: cat['BEER'], productType: ProductType.SALE_ITEM },
        { sku: 'B003', name: 'Heineken ขวดใหญ่', unit: 'ขวด', salePrice: 45000, costPrice: 28000, reorderPoint: 24, minQty: 12, categoryId: cat['BEER'], productType: ProductType.SALE_ITEM },
        { sku: 'B004', name: 'Carlsberg ขวดใหญ่', unit: 'ขวด', salePrice: 35000, costPrice: 22000, reorderPoint: 24, minQty: 12, categoryId: cat['BEER'], productType: ProductType.SALE_ITEM },
        { sku: 'B005', name: 'Tiger ขวดใหญ่', unit: 'ขวด', salePrice: 35000, costPrice: 22000, reorderPoint: 12, minQty: 6, categoryId: cat['BEER'], productType: ProductType.SALE_ITEM },
        // เบียร์สด
        { sku: 'BD01', name: 'Heineken สด (ทาวเวอร์)', unit: 'ทาวเวอร์', salePrice: 199000, costPrice: 90000, reorderPoint: 0, minQty: 0, categoryId: cat['BEER_DRAFT'], productType: ProductType.SALE_ITEM },
        { sku: 'BD02', name: 'Beer Lao สด (ทาวเวอร์)', unit: 'ทาวเวอร์', salePrice: 159000, costPrice: 70000, reorderPoint: 0, minQty: 0, categoryId: cat['BEER_DRAFT'], productType: ProductType.SALE_ITEM },
        // ไวน์/วิสกี้
        { sku: 'W001', name: 'Johnnie Walker Black Label', unit: 'ขวด', salePrice: 1299000, costPrice: 700000, reorderPoint: 2, minQty: 1, categoryId: cat['WINE'], productType: ProductType.SALE_ITEM },
        { sku: 'W002', name: 'Johnnie Walker Red Label', unit: 'ขวด', salePrice: 699000, costPrice: 380000, reorderPoint: 2, minQty: 1, categoryId: cat['WINE'], productType: ProductType.SALE_ITEM },
        { sku: 'W003', name: 'Penfolds BIN2 (2020)', unit: 'ขวด', salePrice: 990000, costPrice: 550000, reorderPoint: 2, minQty: 1, categoryId: cat['WINE'], productType: ProductType.SALE_ITEM },
        // เครื่องดื่ม
        { sku: 'D001', name: 'Pepsi ขวดพลาสติก', unit: 'ขวด', salePrice: 30000, costPrice: 8000, reorderPoint: 12, minQty: 6, categoryId: cat['DRINK'], productType: ProductType.SALE_ITEM },
        { sku: 'D002', name: 'Pepsi กระป๋อง', unit: 'กระป๋อง', salePrice: 15000, costPrice: 7000, reorderPoint: 24, minQty: 12, categoryId: cat['DRINK'], productType: ProductType.SALE_ITEM },
        { sku: 'D003', name: 'Coca-Cola กระป๋อง', unit: 'กระป๋อง', salePrice: 15000, costPrice: 7000, reorderPoint: 12, minQty: 6, categoryId: cat['DRINK'], productType: ProductType.SALE_ITEM },
        { sku: 'D004', name: 'Sprite กระป๋อง', unit: 'กระป๋อง', salePrice: 15000, costPrice: 7000, reorderPoint: 12, minQty: 6, categoryId: cat['DRINK'], productType: ProductType.SALE_ITEM },
        { sku: 'D005', name: 'โซดา ขวดแก้ว', unit: 'ขวด', salePrice: 15000, costPrice: 5000, reorderPoint: 24, minQty: 12, categoryId: cat['DRINK'], productType: ProductType.SALE_ITEM },
        // น้ำดื่ม
        { sku: 'WI01', name: 'น้ำดื่ม ขวดเล็ก', unit: 'ขวด', salePrice: 10000, costPrice: 3000, reorderPoint: 24, minQty: 12, categoryId: cat['WATER'], productType: ProductType.SALE_ITEM },
        { sku: 'WI02', name: 'น้ำดื่ม ขวดกลาง', unit: 'ขวด', salePrice: 10000, costPrice: 3000, reorderPoint: 24, minQty: 12, categoryId: cat['WATER'], productType: ProductType.SALE_ITEM },
        { sku: 'WI03', name: 'น้ำดื่ม ขวดใหญ่', unit: 'ขวด', salePrice: 20000, costPrice: 5000, reorderPoint: 24, minQty: 12, categoryId: cat['WATER'], productType: ProductType.SALE_ITEM },
        { sku: 'WI04', name: 'น้ำแข็ง ถังเล็ก', unit: 'ถัง', salePrice: 15000, costPrice: 5000, reorderPoint: 10, minQty: 5, categoryId: cat['WATER'], productType: ProductType.SALE_ITEM },
        { sku: 'WI05', name: 'น้ำแข็ง ถังใหญ่', unit: 'ถัง', salePrice: 25000, costPrice: 8000, reorderPoint: 10, minQty: 5, categoryId: cat['WATER'], productType: ProductType.SALE_ITEM },
        // อาหาร
        { sku: 'FG01', name: 'เสือร้องไห้ย่าง', unit: 'จาน', salePrice: 135000, costPrice: 55000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_GRILL'], productType: ProductType.SALE_ITEM },
        { sku: 'FG02', name: 'หมูย่าง', unit: 'จาน', salePrice: 120000, costPrice: 45000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_GRILL'], productType: ProductType.SALE_ITEM },
        { sku: 'FG03', name: 'ไก่ย่าง (ครึ่งตัว)', unit: 'จาน', salePrice: 119000, costPrice: 50000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_GRILL'], productType: ProductType.SALE_ITEM },
        { sku: 'FG04', name: 'แกะอบ', unit: 'ตัว', salePrice: 890000, costPrice: 500000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_GRILL'], productType: ProductType.SALE_ITEM },
        { sku: 'FF01', name: 'เฟรนช์ฟรายส์', unit: 'จาน', salePrice: 85000, costPrice: 20000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_FRY'], productType: ProductType.SALE_ITEM },
        { sku: 'FF02', name: 'เอ็นไก่ทอดสมุนไพร', unit: 'จาน', salePrice: 95000, costPrice: 35000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_FRY'], productType: ProductType.SALE_ITEM },
        { sku: 'FR01', name: 'ข้าวเหนียว 1 กล่อง', unit: 'กล่อง', salePrice: 15000, costPrice: 5000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_RICE'], productType: ProductType.SALE_ITEM },
        { sku: 'FR02', name: 'ข้าวเจ้า 1 จาน', unit: 'จาน', salePrice: 15000, costPrice: 5000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_RICE'], productType: ProductType.SALE_ITEM },
        { sku: 'FR03', name: 'ข้าวผัด จานเล็ก', unit: 'จาน', salePrice: 79000, costPrice: 25000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_RICE'], productType: ProductType.SALE_ITEM },
        { sku: 'FR04', name: 'ข้าวผัด จานใหญ่', unit: 'จาน', salePrice: 239000, costPrice: 60000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_RICE'], productType: ProductType.SALE_ITEM },
        { sku: 'FR05', name: 'ข้าวพนักงาน', unit: 'จาน', salePrice: 20000, costPrice: 8000, reorderPoint: 0, minQty: 0, categoryId: cat['FOOD_RICE'], productType: ProductType.SALE_ITEM },
        { sku: 'KR01', name: 'Heineken (คาราโอเกะ)', unit: 'ขวด', salePrice: 40000, costPrice: 28000, reorderPoint: 12, minQty: 6, categoryId: cat['KARAOKE'], productType: ProductType.SALE_ITEM },
        // วัตถุดิบ
        { sku: 'RM01', name: 'ไก่ทั้งตัว', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 10, minQty: 5, categoryId: cat['RAW_MEAT'], productType: ProductType.RAW_MATERIAL },
        { sku: 'RM02', name: 'เนื้อวัวสด', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 5, minQty: 2, categoryId: cat['RAW_MEAT'], productType: ProductType.RAW_MATERIAL },
        { sku: 'RP01', name: 'หมูสามชั้น', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 5, minQty: 2, categoryId: cat['RAW_PORK'], productType: ProductType.RAW_MATERIAL },
        { sku: 'RS01', name: 'กุ้งสด', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 3, minQty: 1, categoryId: cat['RAW_SEA'], productType: ProductType.RAW_MATERIAL },
        { sku: 'RS02', name: 'ปลาหมึกสด', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 3, minQty: 1, categoryId: cat['RAW_SEA'], productType: ProductType.RAW_MATERIAL },
        { sku: 'RV01', name: 'มันฝรั่ง', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 5, minQty: 2, categoryId: cat['RAW_VEG'], productType: ProductType.RAW_MATERIAL },
        { sku: 'RV02', name: 'หัวหอมใหญ่', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 5, minQty: 2, categoryId: cat['RAW_VEG'], productType: ProductType.RAW_MATERIAL },
        { sku: 'RV03', name: 'กระเทียม', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 3, minQty: 1, categoryId: cat['RAW_VEG'], productType: ProductType.RAW_MATERIAL },
        { sku: 'DG01', name: 'ข้าวสาร', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 20, minQty: 10, categoryId: cat['DRY_GOODS'], productType: ProductType.RAW_MATERIAL },
        { sku: 'DG02', name: 'ข้าวเหนียว', unit: 'กก.', salePrice: 0, costPrice: 0, reorderPoint: 10, minQty: 5, categoryId: cat['DRY_GOODS'], productType: ProductType.RAW_MATERIAL },
        { sku: 'DG03', name: 'น้ำมันพืช', unit: 'ลิตร', salePrice: 0, costPrice: 0, reorderPoint: 5, minQty: 2, categoryId: cat['DRY_GOODS'], productType: ProductType.RAW_MATERIAL },
        { sku: 'DG04', name: 'ซีอิ๊วขาว', unit: 'ขวด', salePrice: 0, costPrice: 0, reorderPoint: 3, minQty: 1, categoryId: cat['DRY_GOODS'], productType: ProductType.RAW_MATERIAL },
    ]
    let productCount = 0
    for (const p of productDefs) {
        await (prisma as any).product.upsert({
            where: { tenantId_sku: { tenantId, sku: p.sku } },
            update: { name: p.name, salePrice: p.salePrice, costPrice: p.costPrice },
            create: { ...p, tenantId, note: '' },
        })
        productCount++
    }
    console.log(`✅ Products: ${productCount}`)

    console.log('\n🎉 Seed completed!')
    console.log('📋 Login credentials:')
    console.log('   👑 owner     / owner1234')
    console.log('   📊 manager   / manager1234')
    console.log('   🏭 warehouse / staff1234')
    console.log('   🍳 kitchen   / staff1234')
    console.log('   🍸 bar       / staff1234')
    console.log('   💰 cashier   / staff1234')
}

main().catch(console.error).finally(() => prisma.$disconnect())
