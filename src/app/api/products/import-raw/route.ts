import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'

// ────────────────────────────────────────────────────────────
// POST /api/products/import-raw
// นำเข้าวัตถุดิบ / บรรจุภัณฑ์ จากไฟล์ Excel
// - productType default: RAW_MATERIAL (ไม่สร้าง inventory — stock คง 0)
// - auto-detect หมวดหมู่จากชื่อ keyword
// ────────────────────────────────────────────────────────────

import { guessCategory, SKU_PREFIX, DRINK_CODES, ENTERTAIN_CODES } from '@/lib/cat-rules'

/** อ่านค่าคอลัมน์จาก Excel row (case-insensitive) */
function col(row: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const found = Object.keys(row).find(r => r.trim().toLowerCase() === k.toLowerCase())
        if (found !== undefined && row[found] !== '') return String(row[found]).trim()
    }
    return ''
}

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

        // ── Batch ID for rollback ──────────────────────────────────
        const batchId = `import-${Date.now()}`

        const results: {
            row: number
            status: 'created' | 'skipped' | 'error'
            name: string
            category?: string
            guessed?: boolean
            reason?: string
        }[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 2

            const name = col(row, 'ชื่อวัตถุดิบ', 'ชื่อสินค้า', 'ชื่อ', 'name', 'item_name')
            const catRaw = col(row, 'หมวดหมู่', 'หมวด', 'category', 'cat')
            const costPriceRaw = col(row, 'ต้นทุน', 'ราคา', 'cost', 'cost_price', 'ราคา/หน่วย')
            const unit = col(row, 'หน่วย', 'unit') || 'กก.'
            const unitAlt = col(row, 'หน่วยรอง', 'unit_alt', 'unitalt')
            const convFactorRaw = col(row, 'อัตราแปลง', 'conv_factor', 'convfactor')
            const typeRaw = col(row, 'ประเภท', 'type', 'producttype', 'product_type')
            const note = col(row, 'หมายเหตุ', 'note')

            if (!name) {
                results.push({ row: rowNum, status: 'skipped', name: '-', reason: 'ไม่มีชื่อ' })
                continue
            }
            if (existingNames.has(name.toLowerCase())) {
                results.push({ row: rowNum, status: 'skipped', name, reason: 'ชื่อซ้ำในระบบ' })
                continue
            }

            // 3-step category resolution
            let category = catRaw ? findCategoryByExact(catRaw) : null
            let guessed = false
            let guessedCode: string | null = null

            if (!category) {
                guessedCode = guessCategory(name)
                if (guessedCode) {
                    // Skip เครื่องดื่ม — ไม่ควร import เป็นวัตถุดิบ
                    if (DRINK_CODES.has(guessedCode)) {
                        results.push({ row: rowNum, status: 'skipped', name, reason: `ข้ามเครื่องดื่ม (${guessedCode}) — import เป็นวัตถุดิบไม่ถูกต้อง` })
                        continue
                    }
                    category = catByCode.get(guessedCode.toLowerCase()) || null
                    if (category) guessed = true
                }
            }
            if (!category) {
                // fallback → OTHER
                category = catByCode.get('other') || dbCategories[0] || null
                if (category) guessed = true
            }
            if (!category) {
                results.push({ row: rowNum, status: 'error', name, reason: 'ไม่สามารถระบุหมวดหมู่ได้' })
                continue
            }

            const costPrice = parseFloat(costPriceRaw.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0
            const convFactor = parseFloat(convFactorRaw.replace(/,/g, '').replace(/[^\d.]/g, '')) || undefined

            // Determine productType
            let productType: 'RAW_MATERIAL' | 'PACKAGING' | 'ENTERTAIN' = 'RAW_MATERIAL'
            if (ENTERTAIN_CODES.has(guessedCode ?? '') || ENTERTAIN_CODES.has(category.code)) {
                productType = 'ENTERTAIN'
            } else if (
                typeRaw.toLowerCase().includes('packaging') ||
                typeRaw.toLowerCase().includes('บรรจุ') ||
                ['BOX_BAG', 'TISSUE_CLEAN', 'DISPOSABLE', 'PACKAGING'].includes(category.code)
            ) {
                productType = 'PACKAGING'
            }

            // Generate unique SKU
            const prefix = SKU_PREFIX[category.code] || 'OT'
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
                        tenantId,
                        sku, name,
                        categoryId: category.id,
                        productType, unit,
                        unitAlt: unitAlt || undefined,
                        convFactor,
                        costPrice,
                        salePrice: 0,
                        note: `[BATCH:${batchId}]${note ? ' ' + note : ''}`,
                    },
                })
                existingSkus.add(sku)
                existingNames.add(name.toLowerCase())
                results.push({ row: rowNum, status: 'created', name, category: category.name, guessed })
            } catch (e: unknown) {
                results.push({ row: rowNum, status: 'error', name, reason: e instanceof Error ? e.message : 'Unknown error' })
            }
        }

        const created = results.filter(r => r.status === 'created').length
        const skipped = results.filter(r => r.status === 'skipped').length
        const errors = results.filter(r => r.status === 'error').length
        const autoMatched = results.filter(r => r.guessed).length

        return NextResponse.json({
            success: true,
            data: { created, skipped, errors, autoMatched, total: rows.length, results },
            batchId,
        })

    } catch (e: unknown) {
        console.error('Import raw error:', e)
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}, ['OWNER', 'MANAGER'])
