/**
 * upsert-categories.js — Upsert ALL categories (Phase 0)
 * Groups: INGREDIENT (A), SUPPLY (B), SALE_ITEMS (B), FOOD_MENU (C)
 * รัน: node scripts/upsert-categories.js
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({ log: [] })

// ── กำหนดหมวดใหม่ทั้งหมด ──────────────────────────────────────────────────
const CATEGORIES = [
    // ─── A) INGREDIENT — วัตถุดิบ (RAW_MATERIAL) ───────────────────────────
    { code: 'PROTEIN_PORK', name: 'เนื้อหมู/เครื่องในหมู', nameEn: 'Pork/Offal', color: '#F87171', icon: '🐷', group: 'INGREDIENT' },
    { code: 'PROTEIN_MEAT', name: 'เนื้อวัว/ไก่/เป็ด/เครื่องใน', nameEn: 'Meat/Poultry', color: '#DC2626', icon: '🥩', group: 'INGREDIENT' },
    { code: 'SEAFOOD', name: 'ซีฟู้ด (ปลา/กุ้ง/หมึก/หอย/ปู)', nameEn: 'Seafood', color: '#0EA5E9', icon: '🦐', group: 'INGREDIENT' },
    { code: 'EGG', name: 'ไข่ทุกชนิด', nameEn: 'Eggs', color: '#FCD34D', icon: '🥚', group: 'INGREDIENT' },
    { code: 'DAIRY', name: 'นม/ครีม/เนย/ชีส', nameEn: 'Dairy & Cheese', color: '#FDE68A', icon: '🥛', group: 'INGREDIENT' },
    { code: 'VEGHERB', name: 'ผัก/สมุนไพร', nameEn: 'Vegetables & Herbs', color: '#22C55E', icon: '🥬', group: 'INGREDIENT' },
    { code: 'MUSHROOM', name: 'เห็ดทุกชนิด', nameEn: 'Mushrooms', color: '#A16207', icon: '🍄', group: 'INGREDIENT' },
    { code: 'DRY_GOODS', name: 'ของแห้ง/เส้น/ข้าว/เครื่องปรุง', nameEn: 'Dry Goods & Spices', color: '#92400E', icon: '🧂', group: 'INGREDIENT' },
    { code: 'FROZEN', name: 'แช่แข็ง/กึ่งสำเร็จ', nameEn: 'Frozen & Ready-made', color: '#BAE6FD', icon: '🧊', group: 'INGREDIENT' },

    // ─── B) SUPPLY — ของใช้/บรรจุภัณฑ์ (PACKAGING) ────────────────────────
    { code: 'BOX_BAG', name: 'กล่อง/ถุง/แพ็ค', nameEn: 'Box/Bag/Pack', color: '#9CA3AF', icon: '📦', group: 'SUPPLY' },
    { code: 'TISSUE_CLEAN', name: 'ทิชชู่/ผ้า/ทำความสะอาด', nameEn: 'Tissue & Cleaning', color: '#E5E7EB', icon: '🧻', group: 'SUPPLY' },
    { code: 'DISPOSABLE', name: 'อุปกรณ์สิ้นเปลือง', nameEn: 'Disposable Supplies', color: '#D1D5DB', icon: '🥄', group: 'SUPPLY' },

    // ─── B) SALE ITEMS — แอลกอฮอล์ ─────────────────────────────────────────
    { code: 'BEER', name: 'เบียร์ขวด/กระป๋อง', nameEn: 'Beer (Bottle/Can)', color: '#F59E0B', icon: '🍺', group: 'SALE_ALCOHOL' },
    { code: 'BEER_DRAFT', name: 'เบียร์สด/ทาวเวอร์', nameEn: 'Draft Beer/Tower', color: '#D97706', icon: '🍻', group: 'SALE_ALCOHOL' },
    { code: 'WINE', name: 'ไวน์/สุรา/วิสกี้', nameEn: 'Wine & Spirits', color: '#7C3AED', icon: '🍷', group: 'SALE_ALCOHOL' },
    { code: 'SOJU', name: 'โซจู', nameEn: 'Soju', color: '#A78BFA', icon: '🥃', group: 'SALE_ALCOHOL' },

    // ─── B) SALE ITEMS — ไม่มีแอลกอฮอล์ ────────────────────────────────────
    { code: 'WATER', name: 'น้ำดื่ม/น้ำแข็ง', nameEn: 'Water & Ice', color: '#38BDF8', icon: '💧', group: 'SALE_NON_ALCOHOL' },
    { code: 'SOFT_DRINK', name: 'น้ำอัดลม/มิกเซอร์', nameEn: 'Soft Drink/Mixer', color: '#34D399', icon: '🥤', group: 'SALE_NON_ALCOHOL' },

    // ─── B) SALE ITEMS — กาแฟ/ชา/ปั่น ──────────────────────────────────────
    { code: 'COFFEE', name: 'กาแฟ', nameEn: 'Coffee', color: '#78350F', icon: '☕', group: 'SALE_CAFE' },
    { code: 'TEA', name: 'ชา/โกโก้', nameEn: 'Tea & Cocoa', color: '#16A34A', icon: '🍵', group: 'SALE_CAFE' },
    { code: 'SMOOTHIE', name: 'โซดาผสม/น้ำผลไม้/ปั่น', nameEn: 'Smoothie/Juice/Soda', color: '#F472B6', icon: '🧃', group: 'SALE_CAFE' },

    // ─── C) FOOD MENU — อาหาร (SALE_ITEM + Recipe) ──────────────────────────
    { code: 'FOOD_GRILL', name: 'ปิ้งย่าง/ย่าง', nameEn: 'Grilled Food', color: '#EF4444', icon: '🍖', group: 'FOOD' },
    { code: 'FOOD_FRY', name: 'ทอด', nameEn: 'Fried Food', color: '#F97316', icon: '🍟', group: 'FOOD' },
    { code: 'FOOD_BOIL', name: 'ต้ม/ซุป', nameEn: 'Boiled/Soup', color: '#3B82F6', icon: '🍲', group: 'FOOD' },
    { code: 'FOOD_SALAD', name: 'ยำ/สลัด/ลาบ', nameEn: 'Salad/Laab', color: '#84CC16', icon: '🥗', group: 'FOOD' },
    { code: 'FOOD_STIR', name: 'ผัด', nameEn: 'Stir-fry', color: '#F59E0B', icon: '🍳', group: 'FOOD' },
    { code: 'FOOD_SNACK', name: 'ของทานเล่น', nameEn: 'Snack/Appetizer', color: '#A78BFA', icon: '🥨', group: 'FOOD' },
    { code: 'FOOD_SEA', name: 'อาหารทะเล', nameEn: 'Seafood Menu', color: '#0EA5E9', icon: '🦑', group: 'FOOD' },
    { code: 'FOOD_RICE', name: 'ข้าว/ข้าวผัด', nameEn: 'Rice', color: '#CA8A04', icon: '🍚', group: 'FOOD' },

    // ─── อื่น ๆ ─────────────────────────────────────────────────────────────
    { code: 'SET', name: 'โปร/เซ็ต', nameEn: 'Set/Promo', color: '#8B5CF6', icon: '🎯', group: 'OTHER' },
    { code: 'KARAOKE', name: 'ห้องคาราโอเกะ', nameEn: 'Karaoke Room', color: '#EC4899', icon: '🎤', group: 'OTHER' },
    { code: 'ENTERTAIN', name: 'Entertain/PR', nameEn: 'Entertainment', color: '#6B7280', icon: '🎭', group: 'OTHER' },
    { code: 'OTHER', name: 'อื่นๆ', nameEn: 'Other', color: '#6B7280', icon: '❓', group: 'OTHER' },
]

async function main() {
    // ค้นหา tenant
    const tenants = await p.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true, code: true } })
    if (tenants.length === 0) { console.error('❌ ไม่พบ Tenant'); process.exit(1) }

    console.log(`\n🏷️  Upserting categories for ${tenants.length} tenant(s)...\n`)

    for (const tenant of tenants) {
        console.log(`\n  📦 Tenant: ${tenant.code} (${tenant.id})`)
        let ok = 0, fail = 0

        for (const cat of CATEGORIES) {
            const { group, ...data } = cat
            try {
                const result = await p.category.upsert({
                    where: { tenantId_code: { tenantId: tenant.id, code: data.code } },
                    update: { name: data.name, nameEn: data.nameEn, color: data.color, icon: data.icon },
                    create: { ...data, tenantId: tenant.id },
                })
                console.log(`    ✅ [${result.code}] ${result.icon}  ${result.name}`)
                ok++
            } catch (e) {
                console.error(`    ❌ [${cat.code}] ${e.message}`)
                fail++
            }
        }
        console.log(`\n  📊 ${tenant.code}: ${ok} ok, ${fail} fail`)
    }

    console.log('\n🎉 เสร็จแล้ว! เรียกใช้ recategorize-products.js ต่อได้เลย')
}

main().catch(console.error).finally(() => p.$disconnect())
