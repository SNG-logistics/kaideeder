import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// Location type values from Prisma enum
type LocType = 'MAIN_WAREHOUSE' | 'FRESH_STORAGE' | 'DRINK_WAREHOUSE' | 'DISPLAY_FREEZER' | 'KITCHEN_STOCK' | 'BAR_STOCK'

interface LocDef {
    code: string
    name: string
    nameLao: string
    type: LocType
    sortOrder: number
}

const TEMPLATES: Record<string, LocDef[]> = {
    small: [
        { code: 'WH_MAIN', name: 'คลังหลัก', nameLao: 'ຄັງຫຼັກ', type: 'MAIN_WAREHOUSE', sortOrder: 1 },
    ],
    restaurant: [
        { code: 'WH_MAIN',  name: 'คลังใหญ่',    nameLao: 'ຄັງໃຫຍ່',        type: 'MAIN_WAREHOUSE',  sortOrder: 1 },
        { code: 'WH_FRESH', name: 'คลังของสด',   nameLao: 'ຄັງຂອງສົດ',      type: 'FRESH_STORAGE',   sortOrder: 2 },
        { code: 'KIT_STOCK',name: 'สต็อคครัว',   nameLao: 'ສະຕ໋ອກເຄື່ອງຄົວ', type: 'KITCHEN_STOCK',   sortOrder: 3 },
    ],
    restaurant_bar: [
        { code: 'WH_MAIN',       name: 'คลังใหญ่',          nameLao: 'ຄັງໃຫຍ່',             type: 'MAIN_WAREHOUSE',  sortOrder: 1 },
        { code: 'WH_FRESH',      name: 'คลังของสด',         nameLao: 'ຄັງຂອງສົດ',           type: 'FRESH_STORAGE',   sortOrder: 2 },
        { code: 'KIT_STOCK',     name: 'สต็อคครัว',         nameLao: 'ສະຕ໋ອກເຄື່ອງຄົວ',     type: 'KITCHEN_STOCK',   sortOrder: 3 },
        { code: 'BAR_STOCK',     name: 'สต็อคบาร์',         nameLao: 'ສະຕ໋ອກບາ',            type: 'BAR_STOCK',       sortOrder: 4 },
        { code: 'FR_FREEZER',    name: 'ตู้แช่หน้าร้าน',   nameLao: 'ຕູ້ແຊ່ໜ້າຮ້ານ',       type: 'DISPLAY_FREEZER', sortOrder: 5 },
    ],
    full: [
        { code: 'WH_MAIN',       name: 'คลังใหญ่',          nameLao: 'ຄັງໃຫຍ່',             type: 'MAIN_WAREHOUSE',  sortOrder: 1 },
        { code: 'WH_FRESH',      name: 'คลังของสด',         nameLao: 'ຄັງຂອງສົດ',           type: 'FRESH_STORAGE',   sortOrder: 2 },
        { code: 'WH_DRINKbar1',  name: 'คลังเครื่องดื่ม 1', nameLao: 'ຄັງເຄື່ອງດື່ມ 1',     type: 'DRINK_WAREHOUSE', sortOrder: 3 },
        { code: 'WH_DRINKbar2',  name: 'คลังเครื่องดื่ม 2', nameLao: 'ຄັງເຄື່ອງດື່ມ 2',     type: 'DRINK_WAREHOUSE', sortOrder: 4 },
        { code: 'FR_FREEZER',    name: 'ตู้แช่หน้าร้าน',   nameLao: 'ຕູ້ແຊ່ໜ້າຮ້ານ',       type: 'DISPLAY_FREEZER', sortOrder: 5 },
        { code: 'KIT_STOCK',     name: 'สต็อคครัว',         nameLao: 'ສະຕ໋ອກເຄື່ອງຄົວ',     type: 'KITCHEN_STOCK',   sortOrder: 6 },
        { code: 'BAR_STOCK',     name: 'สต็อคบาร์',         nameLao: 'ສະຕ໋ອກບາ',            type: 'BAR_STOCK',       sortOrder: 7 },
    ],
}

// POST /api/locations/seed?template=restaurant_bar
export const POST = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const url = new URL(req.url)
    const template = url.searchParams.get('template') || 'restaurant'

    const defs = TEMPLATES[template]
    if (!defs) return err(`ไม่พบ template "${template}". ใช้: small | restaurant | restaurant_bar | full`, 400)

    const created: string[] = []
    const skipped: string[] = []

    for (const loc of defs) {
        const existing = await prisma.location.findFirst({
            where: { tenantId, code: loc.code },
        })
        if (existing) {
            // Reactivate if deactivated
            if (!(existing as any).isActive) {
                await prisma.location.update({ where: { id: existing.id }, data: { isActive: true } })
                created.push(loc.code + ' (reactivated)')
            } else {
                skipped.push(loc.code)
            }
            continue
        }
        await prisma.location.create({
            data: { tenantId, ...loc, isActive: true },
        })
        created.push(loc.code)
    }

    return ok({
        template,
        created,
        skipped,
        message: `สร้างคลัง ${created.length} รายการ, ข้าม ${skipped.length} รายการ (มีอยู่แล้ว)`,
    })
}, ['owner', 'manager'])
