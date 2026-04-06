import type { InventoryItem, ItemUnitConversion } from '@prisma/client'
import { checkDuplicates } from './duplicate-check'

export interface ValidationIssueInput {
  issueCode: string
  severity: 'INFO' | 'WARNING' | 'ERROR'
  message: string
  detailsJson?: Record<string, unknown>
}

type PartialItem = Pick<
  InventoryItem,
  | 'id'
  | 'tenantId'
  | 'name'
  | 'itemRole'
  | 'itemKind'
  | 'baseUnit'
  | 'purchaseUnit'
  | 'trackStock'
  | 'isSellable'
  | 'status'
>

/** Plate / serving units that should not be used as base units for RAW items */
const PLATE_UNITS = new Set(['จาน', 'ถ้วย', 'bowl', 'plate', 'dish', 'portion'])

/**
 * Run all 8 Phase-1 validation rules against an inventory item.
 * Returns an array of issues to persist (may be empty if item is clean).
 */
export async function validateItem(
  item: PartialItem,
  conversions: Pick<ItemUnitConversion, 'fromUnit' | 'toUnit'>[],
): Promise<ValidationIssueInput[]> {
  const issues: ValidationIssueInput[] = []

  // ── Rule 1: ITEM_ROLE_REQUIRED ─────────────────────────────────
  // Always satisfied because itemRole is a required enum — guard for future nullable migration
  if (!item.itemRole) {
    issues.push({
      issueCode: 'ITEM_ROLE_REQUIRED',
      severity: 'ERROR',
      message: 'กรุณาระบุประเภทรายการ (RAW / PREP / SUPPLY / SERVICE)',
    })
  }

  // ── Rule 2: BASE_UNIT_REQUIRED ─────────────────────────────────
  if (!item.baseUnit || item.baseUnit.trim() === '') {
    issues.push({
      issueCode: 'BASE_UNIT_REQUIRED',
      severity: 'ERROR',
      message: 'กรุณาระบุหน่วยฐาน (เช่น g, ml, ชิ้น)',
    })
  }

  // ── Rule 3: DUPLICATE_NAME_WARNING ───────────────────────────
  const duplicates = await checkDuplicates({
    tenantId: item.tenantId,
    name: item.name,
    excludeId: item.id,
  })
  if (duplicates.length > 0) {
    issues.push({
      issueCode: 'DUPLICATE_NAME_WARNING',
      severity: 'WARNING',
      message: `พบรายการชื่อใกล้เคียง ${duplicates.length} รายการ`,
      detailsJson: { candidates: duplicates.slice(0, 5) },
    })
  }

  // ── Rule 4: CONVERSION_REQUIRED_IF_PURCHASE_UNIT_DIFFERS ──────
  if (
    item.purchaseUnit &&
    item.baseUnit &&
    item.purchaseUnit !== item.baseUnit &&
    conversions.length === 0
  ) {
    issues.push({
      issueCode: 'CONVERSION_REQUIRED_IF_PURCHASE_UNIT_DIFFERS',
      severity: 'WARNING',
      message: `หน่วยซื้อ (${item.purchaseUnit}) ต่างจากหน่วยฐาน (${item.baseUnit}) แต่ยังไม่มีค่าแปลงหน่วย`,
      detailsJson: { purchaseUnit: item.purchaseUnit, baseUnit: item.baseUnit },
    })
  }

  // ── Rule 5: RAW_SHOULD_NOT_USE_PLATE_UNIT ────────────────────
  if (item.itemRole === 'RAW' && PLATE_UNITS.has(item.baseUnit?.toLowerCase() ?? '')) {
    issues.push({
      issueCode: 'RAW_SHOULD_NOT_USE_PLATE_UNIT',
      severity: 'WARNING',
      message: `วัตถุดิบ RAW ไม่ควรใช้หน่วยจาน/ถ้วย เพราะจะทำให้การคำนวณ BOM ผิดพลาด`,
      detailsJson: { baseUnit: item.baseUnit },
    })
  }

  // ── Rule 6: PREP_REQUIRES_TRACK_STOCK_TRUE ───────────────────
  if (item.itemRole === 'PREP' && item.trackStock === false) {
    issues.push({
      issueCode: 'PREP_REQUIRES_TRACK_STOCK_TRUE',
      severity: 'ERROR',
      message: 'รายการประเภท PREP ต้องเปิดการติดตามสต็อก (trackStock = true)',
    })
  }

  // ── Rule 7: SELLABLE_RAW_WARNING ─────────────────────────────
  if (item.itemRole === 'RAW' && item.isSellable) {
    issues.push({
      issueCode: 'SELLABLE_RAW_WARNING',
      severity: 'WARNING',
      message: 'วัตถุดิบ RAW ถูกตั้งค่าเป็น isSellable — กรุณาตรวจสอบว่าตั้งใจ',
    })
  }

  // ── Rule 8: ARCHIVED_ITEM_CANNOT_BE_SELECTED_IN_NEW_FLOWS ────
  if (item.status === 'ARCHIVED') {
    issues.push({
      issueCode: 'ARCHIVED_ITEM_CANNOT_BE_SELECTED_IN_NEW_FLOWS',
      severity: 'INFO',
      message: 'รายการนี้ถูก Archive แล้ว จะไม่สามารถเลือกใช้ในสูตรหรือการรับสินค้าใหม่ได้',
    })
  }

  return issues
}
