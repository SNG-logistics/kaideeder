import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

// Category code → SKU prefix mapping
const SKU_PREFIX: Record<string, string> = {
    BEER: 'B',
    BEER_DRAFT: 'BD',
    WINE: 'W',
    COCKTAIL: 'CK',
    DRINK: 'D',
    WATER: 'WI',
    FOOD_GRILL: 'FG',
    FOOD_FRY: 'FF',
    FOOD_RICE: 'FR',
    FOOD_NOODLE: 'FN',
    FOOD_SEA: 'FS',
    FOOD_VEG: 'FV',
    FOOD_LAAB: 'FL',
    KARAOKE: 'KR',
    SET: 'ST',
    ENTERTAIN: 'EN',
    RAW_MEAT: 'RM',
    RAW_PORK: 'RP',
    RAW_SEA: 'RS',
    RAW_VEG: 'RV',
    DRY_GOODS: 'DG',
    PACKAGING: 'PK',
    OTHER: 'OT',
}

async function generateSKU(tenantId: string, categoryCode: string): Promise<string> {
    const prefix = SKU_PREFIX[categoryCode] || 'XX'

    const existing = await prisma.product.findMany({
        where: { tenantId, sku: { startsWith: prefix } },  // scoped to tenant
        select: { sku: true },
        orderBy: { sku: 'desc' },
    })

    let nextNum = 1
    const exactMatches = existing.filter(p => {
        const rest = p.sku.slice(prefix.length)
        return /^\d+$/.test(rest)
    })

    if (exactMatches.length > 0) {
        const maxNum = Math.max(...exactMatches.map(p => parseInt(p.sku.slice(prefix.length)) || 0))
        nextNum = maxNum + 1
    }

    return `${prefix}${String(nextNum).padStart(2, '0')}`
}


const productSchema = z.object({
    sku: z.string().optional(),
    name: z.string().min(1, 'กรุณากรอกชื่อสินค้า'),
    nameTh: z.string().optional(),
    nameLao: z.string().optional(),
    categoryId: z.string().min(1, 'กรุณาเลือกหมวดหมู่'),
    productType: z.enum(['SALE_ITEM', 'RAW_MATERIAL', 'PACKAGING', 'ENTERTAIN']).default('SALE_ITEM'),
    unit: z.string().min(1, 'กรุณากรอกหน่วยหลัก'),
    unitAlt: z.string().optional(),
    convFactor: z.number().optional(),
    costPrice: z.number().default(0),
    salePrice: z.number().default(0),
    reorderPoint: z.number().default(0),
    minQty: z.number().default(0),
    note: z.string().optional(),
})

// GET /api/products — รายการสินค้า
export const GET = withAuth<any>(async (req: NextRequest, context: any) => {
    const { tenantId } = context
    const url = new URL(req.url)
    const search = url.searchParams.get('search') || ''
    const categoryId = url.searchParams.get('categoryId')
    const productType = url.searchParams.get('productType')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // tenantId is always the first filter — never omit it
    const where: Record<string, unknown> = { tenantId, isActive: true }
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { sku: { contains: search } },
            { nameTh: { contains: search } },
        ]
    }
    if (categoryId) where.categoryId = categoryId
    if (productType) where.productType = productType

    const [rawProducts, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: { category: true, inventory: { include: { location: true } } },
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.product.count({ where }),
    ])

    // Compute imageUrl: prefer DB base64 (works in production), fallback to stored URL
    const products = rawProducts.map(p => {
        const imageUrl = p.imageBase64
            ? `data:image/webp;base64,${p.imageBase64}`
            : p.imageUrl || null
        // Don't leak imageBase64 bytes in list response (it's huge)
        const { imageBase64, ...rest } = p
        return { ...rest, imageUrl }
    })

    return ok({ products, total, page, limit, pages: Math.ceil(total / limit) })
})

// POST /api/products — สร้างสินค้าใหม่
export const POST = withAuth<any>(async (req: NextRequest, context: any) => {
    try {
        const { tenantId } = context
        const body = await req.json()
        const data = productSchema.parse(body)

        // Auto-generate SKU scoped to this tenant
        const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
        if (!category) return err('ไม่พบหมวดหมู่ที่เลือก')

        const sku = data.sku?.trim() || await generateSKU(tenantId, category.code)

        // Check duplicate SKU within this tenant only
        const dupSku = await prisma.product.findFirst({ where: { tenantId, sku } })
        if (dupSku) return err(`SKU "${sku}" ซ้ำกับสินค้า "${dupSku.name}"`)

        const product = await prisma.product.create({
            data: { ...data, sku, tenantId },   // always inject tenantId
            include: { category: true },
        })
        return ok(product)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Create product error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])
