import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import * as XLSX from 'xlsx'
import { MovementType } from '@prisma/client'

/**
 * POST /api/sales/import
 * รับไฟล์ Excel จาก POS (format เดียวกับ TOP 10 Bast Selling)
 * → parse → match recipe → ตัดสต็อคอัตโนมัติ
 */
export const POST = withAuth<any>(async (req: NextRequest, ctx) => {
    const { user, tenantId } = ctx
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const saleDateStr = formData.get('saleDate') as string

        if (!file) return err('กรุณาเลือกไฟล์ Excel')
        if (!saleDateStr) return err('กรุณาระบุวันที่ขาย')

        const saleDate = new Date(saleDateStr)
        const forceReimport = formData.get('forceReimport') === 'true'

        // B-01 Fix: ป้องกัน Import ซ้ำวัน (Stock จะถูกตัดซ้ำ 2 เท่า!)
        if (!forceReimport) {
            const saleDateStart = new Date(saleDate)
            saleDateStart.setHours(0, 0, 0, 0)
            const saleDateEnd = new Date(saleDate)
            saleDateEnd.setHours(23, 59, 59, 999)

            const existingImport = await prisma.salesImport.findFirst({
                where: {
                    tenantId,
                    saleDate: { gte: saleDateStart, lte: saleDateEnd },
                    status: { in: ['COMPLETED', 'PROCESSING'] },
                },
            })
            if (existingImport) {
                return err(
                    `วันที่ ${saleDateStr} ถูก Import ไปแล้ว (ID: ${existingImport.id}, ` +
                    `ไฟล์: ${existingImport.fileName}) — ` +
                    `ถ้าต้องการ Import ซ้ำให้ส่ง forceReimport=true (ระวัง: Stock จะถูกตัดซ้ำ!)`
                )
            }
        }

        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        // หาแถว header (มี "ชื่อสินค้า" หรือ Column ที่ 2 เป็นชื่อ)
        let headerRow = -1
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] as string[]
            if (row && row.some(cell => String(cell || '').includes('ราคา') || String(cell || '').includes('จำนวน'))) {
                headerRow = i
                break
            }
        }
        if (headerRow === -1) headerRow = 6 // default จาก format POS

        // ─── Auto-detect format ──────────────────────────────────────────
        // Deltafood format: [No, Product name, Number, Total]  (no unit price, no category)
        // TOP-10 format:    [No, MenuName, UnitPrice, Qty, Category]
        let isDeltafood = false
        if (headerRow >= 0) {
            const hdr = (rows[headerRow] as string[]).map(c => String(c || '').toLowerCase())
            isDeltafood = hdr.some(c => c.includes('number') || c.includes('total'))
                && !hdr.some(c => c.includes('ราคา') || c.includes('price'))
        }

        // Parse รายการขาย
        type SaleRow = { menuName: string; unitPrice: number; quantity: number; totalAmount: number; category: string }
        const saleItems: SaleRow[] = []
        for (let i = headerRow + 1; i < rows.length; i++) {
            const row = rows[i] as (string | number)[]
            if (!row || !row[1]) continue
            const menuName = String(row[1] || '').trim()
            if (!menuName || menuName === 'Total' || menuName === 'รวม') continue

            let unitPrice: number, quantity: number, totalAmount: number, category: string

            if (isDeltafood) {
                // [0]=No, [1]=menuName, [2]=quantity, [3]=total
                quantity = parseFloat(String(row[2] || '0').replace(/,/g, '')) || 0
                totalAmount = parseFloat(String(row[3] || '0').replace(/,/g, '')) || 0
                unitPrice = quantity > 0 ? totalAmount / quantity : 0
                category = ''
            } else {
                // [0]=No, [1]=menuName, [2]=unitPrice, [3]=quantity, [4]=category
                unitPrice = parseFloat(String(row[2] || '0').replace(/,/g, '')) || 0
                quantity = parseFloat(String(row[3] || '0').replace(/,/g, '')) || 0
                totalAmount = unitPrice * quantity
                category = String(row[4] || '').trim()
            }

            if (quantity === 0) continue
            saleItems.push({ menuName, unitPrice, quantity, totalAmount, category })
        }

        if (saleItems.length === 0) return err('ไม่พบรายการขายในไฟล์ กรุณาตรวจสอบรูปแบบไฟล์')

        const totalAmount = saleItems.reduce((s, i) => s + i.totalAmount, 0)

        // สร้าง SalesImport record
        const salesImport = await prisma.salesImport.create({
            data: {
                tenantId,
                fileName: file.name,
                importDate: new Date(),
                saleDate,
                status: 'PROCESSING',
                totalAmount,
                totalItems: saleItems.length,
                importedById: user?.userId,
                items: {
                    create: saleItems.map((item, idx) => ({
                        tenantId,
                        rowNumber: idx + 1,
                        menuName: item.menuName,
                        unitPrice: item.unitPrice,
                        quantity: item.quantity,
                        totalAmount: item.totalAmount,
                        category: item.category,
                    }))
                }
            },
            include: { items: true }
        })

        // ตัดสต็อคอัตโนมัติ
        let deducted = 0
        let unmatched = 0
        const lowStockWarnings: { menuName: string; product: string; needed: number; had: number }[] = []  // B-05

        for (const item of salesImport.items) {
            // หา Recipe ที่ match ชื่อเมนูจาก POS
            const recipe = await prisma.recipe.findFirst({
                where: {
                    tenantId,
                    menuName: { equals: item.menuName },
                    isActive: true,
                },
                include: { bom: { include: { product: true } } }
            })

            if (!recipe || recipe.bom.length === 0) {
                unmatched++
                continue
            }

            // ตัดสต็อคตาม BOM (Atomic transaction)
            try {
                await prisma.$transaction(async (tx) => {
                    for (const bomItem of recipe.bom) {
                        const deductQty = bomItem.quantity * item.quantity

                        // หา inventory ที่ Location
                        const inv = await tx.inventory.findUnique({
                            where: {
                                tenantId_productId_locationId: {
                                    tenantId,
                                    productId: bomItem.productId,
                                    locationId: bomItem.locationId,
                                }
                            }
                        })

                        if (!inv || inv.quantity < deductQty) {
                            // B-05 Fix: บันทึก warning เพื่อแจ้ง user
                            lowStockWarnings.push({
                                menuName: item.menuName,
                                product: bomItem.product.name,
                                needed: deductQty,
                                had: inv?.quantity || 0,
                            })
                            console.warn(`Low stock: ${bomItem.product.name} need ${deductQty} have ${inv?.quantity || 0}`)
                        }

                        const newQty = Math.max(0, (inv?.quantity || 0) - deductQty)

                        await tx.inventory.upsert({
                            where: {
                                tenantId_productId_locationId: {
                                    tenantId,
                                    productId: bomItem.productId,
                                    locationId: bomItem.locationId,
                                }
                            },
                            update: { quantity: newQty },
                            create: {
                                tenantId,
                                productId: bomItem.productId,
                                locationId: bomItem.locationId,
                                quantity: newQty,
                                avgCost: bomItem.product.costPrice,
                            }
                        })

                        // บันทึก stock movement
                        await tx.stockMovement.create({
                            data: {
                                tenantId,
                                productId: bomItem.productId,
                                fromLocationId: bomItem.locationId,
                                quantity: deductQty,
                                unitCost: bomItem.product.costPrice,
                                totalCost: deductQty * bomItem.product.costPrice,
                                type: MovementType.SALE,
                                referenceId: salesImport.id,
                                referenceType: 'SALE_IMPORT',
                                createdById: user?.userId,
                            }
                        })
                    }
                })

                // อัพเดตว่าตัดสต็อคแล้ว
                await prisma.salesImportItem.update({
                    where: { id: item.id },
                    data: { stockDeducted: true, matchedRecipe: recipe.id }
                })
                deducted++
            } catch (txErr) {
                console.error('Stock deduction error:', txErr)
            }
        }

        // อัพเดตสถานะ import
        await prisma.salesImport.update({
            where: { id: salesImport.id },
            data: { status: 'COMPLETED' }
        })

        return ok({
            importId: salesImport.id,
            totalItems: saleItems.length,
            totalAmount,
            deducted,
            unmatched,
            lowStockWarnings,  // B-05: แจ้ง UI ว่ามีสินค้าที่ stock ไม่พอ
            hasWarnings: lowStockWarnings.length > 0,
            message: [
                `นำเข้าสำเร็จ ${saleItems.length} รายการ`,
                `ตัดสต็อค ${deducted} รายการ`,
                unmatched > 0 ? `ไม่พบ recipe ${unmatched} รายการ` : null,
                lowStockWarnings.length > 0 ? `⚠️ สต็อคไม่พอ ${lowStockWarnings.length} รายการ (ตัดเป็น 0)` : null,
            ].filter(Boolean).join(', ')
        })

    } catch (error) {
        console.error('Import error:', error)
        return err('เกิดข้อผิดพลาดในการนำเข้าไฟล์')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])

// GET /api/sales/import — ประวัติการ import
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const includeItems = url.searchParams.get('include') === 'items'

    const [imports, total, amountAgg] = await Promise.all([
        prisma.salesImport.findMany({
            where: { tenantId },
            orderBy: { saleDate: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                _count: { select: { items: true } },
                ...(includeItems ? {
                    items: {
                        select: { menuName: true, quantity: true, totalAmount: true, category: true },
                        orderBy: { totalAmount: 'desc' }
                    }
                } : {})
            }
        }),
        prisma.salesImport.count({ where: { tenantId } }),
        prisma.salesImport.aggregate({
            where: { tenantId, status: 'COMPLETED' },
            _sum: { totalAmount: true }
        })
    ])

    return ok({
        imports,
        total,
        page,
        pages: Math.ceil(total / limit),
        totalAmount: amountAgg._sum.totalAmount || 0
    })
})