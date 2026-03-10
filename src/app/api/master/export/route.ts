import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'

/**
 * GET /api/master/export?type=categories|sku_master|sku_aliases
 *
 * Exports master data as .xlsx (consistent with rest of codebase).
 * Optionally pass ?location=WH_MAIN to include inventory qty in sku_master.
 */
export const GET = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const url = new URL(req.url)
    const type = url.searchParams.get('type') ?? 'sku_master'
    const today = new Date().toISOString().split('T')[0]

    let rows: Record<string, unknown>[] = []
    let sheetName = 'Export'
    let filename = `export-${type}-${today}.xlsx`
    let colWidths: number[] = []

    // ── categories ──────────────────────────────────────────────────────────
    if (type === 'categories') {
        const cats = await prisma.category.findMany({
            where: { tenantId, isActive: true },
            orderBy: { code: 'asc' },
        })
        rows = cats.map(c => ({
            code: c.code,
            name: c.name,
            nameEn: c.nameEn ?? '',
            color: c.color ?? '',
            icon: c.icon ?? '',
        }))
        sheetName = 'Categories'
        colWidths = [20, 30, 25, 10, 6]
    }

    // ── sku_master ───────────────────────────────────────────────────────────
    else if (type === 'sku_master') {
        const locationCode = url.searchParams.get('location') ?? 'WH_MAIN'
        const products = await prisma.product.findMany({
            where: { tenantId, isActive: true },
            include: {
                category: true,
                inventory: { include: { location: true } },
            },
            orderBy: [{ category: { code: 'asc' } }, { sku: 'asc' }],
        })
        rows = products.map(p => {
            const inv = p.inventory.find(iv => iv.location.code === locationCode)
            return {
                sku: p.sku,
                name: p.name,
                category_code: p.category?.code ?? '',
                product_type: p.productType,
                unit: p.unit,
                unit_alt: p.unitAlt ?? '',
                conv_factor: p.convFactor ?? '',
                cost_price: p.costPrice,
                sale_price: p.salePrice,
                reorder_point: p.reorderPoint,
                min_qty: p.minQty,
                stock_qty: inv?.quantity ?? 0,
                note: p.note ?? '',
            }
        })
        sheetName = 'SKU Master'
        colWidths = [10, 32, 18, 14, 8, 8, 8, 12, 12, 10, 8, 10, 24]
    }

    // ── sku_aliases ──────────────────────────────────────────────────────────
    else if (type === 'sku_aliases') {
        const aliases = await prisma.productAlias.findMany({
            where: { tenantId },
            include: { product: { select: { sku: true, name: true } } },
            orderBy: [{ product: { sku: 'asc' } }, { alias: 'asc' }],
        })
        rows = aliases.map(a => ({
            sku: a.product.sku,
            name: a.product.name,
            alias: a.alias,
            source: a.source ?? '',
            created_at: a.createdAt.toISOString().split('T')[0],
        }))
        sheetName = 'SKU Aliases'
        colWidths = [10, 32, 32, 10, 12]
    }

    else {
        return NextResponse.json({ error: `Unknown type "${type}"` }, { status: 400 })
    }

    if (rows.length === 0) {
        return NextResponse.json({ error: 'ไม่มีข้อมูล' }, { status: 404 })
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = colWidths.map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
