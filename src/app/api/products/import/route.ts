import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'
import { guessCategory, SKU_PREFIX } from '@/lib/cat-rules'


// ────────────────────────────────────────────────────────────
// POST /api/products/import
// รับไฟล์ Excel (.xlsx/.xls) แล้ว bulk-create เมนูร้าน
// หมวดหมู่อัตโนมัติ: วิเคราะห์ชื่อเมนูด้วย keyword matching ใน @/lib/cat-rules
// ────────────────────────────────────────────────────────────

/** นอร์มัลไลซ์คอลัมน์จาก Excel row */
function col(row: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const found = Object.keys(row).find(r => r.trim().toLowerCase() === k.toLowerCase())
        if (found !== undefined && row[found] !== '') return String(row[found]).trim()
    }
    return ''
}

// หมวดที่ต้องสร้าง Recipe บอมอัตโนมัติ (อาหาร ไม่รวมเครื่องดื่ม/เหล้า)
const FOOD_CATEGORIES = new Set([
    'FOOD_GRILL', 'FOOD_FRY', 'FOOD_RICE', 'FOOD_NOODLE',
    'FOOD_SEA', 'FOOD_VEG', 'FOOD_LAAB', 'SET',
])

export const POST = withAuth<any>(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId } = ctx
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        if (!file) {
            return NextResponse.json({ success: false, error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 })
        }

        const buf = Buffer.from(await file.arrayBuffer())
        const wb = XLSX.read(buf, { type: 'buffer' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) {
            return NextResponse.json({ success: false, error: 'ไฟล์ไม่มีข้อมูล' }, { status: 400 })
        }

        const dbCategories = await prisma.category.findMany()
        const catByCode = new Map(dbCategories.map(c => [c.code.toLowerCase(), c]))
        const catByName = new Map(dbCategories.map(c => [c.name.toLowerCase(), c]))

        function findCategoryByExact(val: string) {
            const v = val.trim().toLowerCase()
            return catByCode.get(v) || catByName.get(v) || null
        }

        const existing = await prisma.product.findMany({ select: { sku: true, name: true } })
        const existingSkus = new Set(existing.map(p => p.sku))
        const existingNames = new Set(existing.map(p => p.name.toLowerCase()))

        // ── Batch ID — ใช้ tag ใน note field สำหรับ rollback ──────
        const batchId = `import-${Date.now()}`

        const results: {
            row: number
            status: 'created' | 'skipped' | 'error'
            name: string
            category?: string
            guessed?: boolean
            recipeCreated?: boolean
            reason?: string
        }[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 2

            const name = col(row, 'ชื่อเมนู', 'ชื่อสินค้า', 'name', 'menu_name', 'menuname')
            const catRaw = col(row, 'หมวดหมู่', 'หมวด', 'category', 'cat', 'category_code')
            const salePriceRaw = col(row, 'ราคาขาย', 'ราคา', 'sale_price', 'saleprice', 'ราคาขาย (₭)')
            const costPriceRaw = col(row, 'ต้นทุน', 'cost', 'cost_price', 'costprice', 'ต้นทุน (₭)')
            const unit = col(row, 'หน่วย', 'unit', 'base_unit') || 'ชิ้น'
            const typeRaw = col(row, 'ประเภท', 'type', 'producttype', 'product_type')
            const note = col(row, 'หมายเหตุ', 'note')


            if (!name) {
                results.push({ row: rowNum, status: 'skipped', name: '-', reason: 'ไม่มีชื่อเมนู' })
                continue
            }
            if (existingNames.has(name.toLowerCase())) {
                results.push({ row: rowNum, status: 'skipped', name, reason: 'ชื่อซ้ำในระบบ' })
                continue
            }

            // ── 3-step category resolution ──────────────────────
            let category = catRaw ? findCategoryByExact(catRaw) : null
            let guessed = false

            if (!category) {
                // keyword analysis จากชื่อเมนู
                const guessedCode = guessCategory(name)
                if (guessedCode) {
                    category = catByCode.get(guessedCode.toLowerCase()) || null
                    if (category) guessed = true
                }
            }

            if (!category) {
                // fallback → OTHER (ไม่บังคับใส่ FOOD_GRILL ซึ่งผิดสำหรับวัตถุดิบ)
                category = catByCode.get('other') || catByCode.get('food_grill') || dbCategories[0] || null
                if (category) guessed = true
            }

            if (!category) {
                results.push({ row: rowNum, status: 'error', name, reason: 'ไม่สามารถระบุหมวดหมู่ได้' })
                continue
            }

            const salePrice = parseFloat(salePriceRaw.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0
            const costPrice = parseFloat(costPriceRaw.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0

            let productType: 'SALE_ITEM' | 'ENTERTAIN' = 'SALE_ITEM'
            if (typeRaw.toLowerCase().includes('entertain') || ['ENTERTAIN', 'KARAOKE'].includes(category.code)) {
                productType = 'ENTERTAIN'
            }

            // Generate unique SKU
            const prefix = SKU_PREFIX[category.code] || 'XX'
            let nextNum = 1
            const prefixSkus = [...existingSkus].filter(s => {
                const rest = s.slice(prefix.length)
                return s.startsWith(prefix) && /^\d+$/.test(rest)
            })
            if (prefixSkus.length > 0) {
                nextNum = Math.max(...prefixSkus.map(s => parseInt(s.slice(prefix.length)) || 0)) + 1
            }
            let sku = `${prefix}${String(nextNum).padStart(2, '0')}`
            while (existingSkus.has(sku)) { nextNum++; sku = `${prefix}${String(nextNum).padStart(2, '0')}` }

            try {
                await prisma.product.create({
                    data: {
                        tenantId, sku, name, categoryId: category.id, productType, unit,
                        costPrice, salePrice,
                        note: `[BATCH:${batchId}]${note ? ' ' + note : ''}`,
                    },
                })

                existingSkus.add(sku)
                existingNames.add(name.toLowerCase())

                // สร้าง Recipe บอมว่าง สำหรับประเภทอาหาร
                let recipeCreated = false
                if (FOOD_CATEGORIES.has(category.code)) {
                    const recipeExists = await prisma.recipe.findFirst({
                        where: { menuName: name, isActive: true },
                    })
                    if (!recipeExists) {
                        await prisma.recipe.create({
                            data: {
                                tenantId,
                                menuName: name,
                                note: `[Auto] สร้างอัตโนมัติจาก Import — กรุณาเพิ่มส่วนผสมในหน้า Recipe`,
                            },
                        })
                        recipeCreated = true
                    }
                }

                results.push({ row: rowNum, status: 'created', name, category: category.name, guessed, recipeCreated })
            } catch (e: unknown) {
                results.push({ row: rowNum, status: 'error', name, reason: e instanceof Error ? e.message : 'Unknown error' })
            }
        }

        const created = results.filter(r => r.status === 'created').length
        const skipped = results.filter(r => r.status === 'skipped').length
        const errors = results.filter(r => r.status === 'error').length
        const autoMatched = results.filter(r => r.guessed).length
        const recipesCreated = results.filter(r => r.recipeCreated).length

        return NextResponse.json({
            success: true,
            data: { created, skipped, errors, autoMatched, recipesCreated, total: rows.length, results },
            batchId,  // ใช้ลบ/rollback ภายหลัง
        })

    } catch (e: unknown) {
        console.error('Import error:', e)
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}, ['OWNER', 'MANAGER'])
