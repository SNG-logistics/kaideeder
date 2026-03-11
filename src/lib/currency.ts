/**
 * src/lib/currency.ts
 * Currency formatter — อ่าน format จาก tenant settings
 */

export type CurrencyCode = 'LAK' | 'THB'

/**
 * Format number เป็นสกุลเงิน
 * LAK → "25,000 ₭"
 * THB → "฿850.00"
 */
export function formatCurrency(amount: number, currency: CurrencyCode = 'LAK'): string {
    if (currency === 'THB') {
        return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    // LAK — no decimal, space before ₭
    return `${Math.round(amount).toLocaleString('en-US')} ₭`
}

/**
 * คืน symbol ของสกุลเงิน
 */
export function currencySymbol(currency: CurrencyCode = 'LAK'): string {
    return currency === 'THB' ? '฿' : '₭'
}

/**
 * แปลงระหว่างสกุลเงิน (อัตราคร่าว)
 * ควรใช้อัตราจริงจาก API ถ้าต้องการ real-time
 */
export const APPROX_RATE: Record<string, number> = {
    'LAK_TO_THB': 0.0017,  // 1 LAK ≈ 0.0017 THB
    'THB_TO_LAK': 588,      // 1 THB ≈ 588 LAK
}
