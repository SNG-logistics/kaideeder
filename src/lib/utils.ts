import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Currency formatting is now handled by useCurrency() in TenantContext


/** Format number with commas */
export function formatNumber(n: number, decimals = 2): string {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    }).format(n)
}

/** WAC (Weighted Average Cost) calculation */
export function calcWAC(
    currentQty: number,
    currentCost: number,
    newQty: number,
    newCost: number
): number {
    const totalQty = currentQty + newQty
    if (totalQty === 0) return newCost
    return (currentQty * currentCost + newQty * newCost) / totalQty
}

/** Parse Thai/Lao date string */
export function parseThaiYear(dateStr: string): Date {
    // แปลง พ.ศ. → ค.ศ.
    const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (!match) return new Date(dateStr)
    let year = parseInt(match[3])
    if (year > 2500) year -= 543 // พ.ศ. → ค.ศ.
    return new Date(year, parseInt(match[2]) - 1, parseInt(match[1]))
}
