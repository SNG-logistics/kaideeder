/**
 * Business Day Boundary Utility
 *
 * Supports stores that close after midnight (e.g. 2:00 AM).
 * Orders placed at 01:30 AM on May 16 with closingHour=2
 * still belong to business day "May 15".
 *
 * Business Day "YYYY-MM-DD":
 *   start = YYYY-MM-DD closingHour:00:00 (UTC+7)
 *   end   = YYYY-MM-DD+1 closingHour:00:00 - 1ms (UTC+7)
 */

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7

/**
 * Parse "YYYY-MM-DD" into a Date at local midnight (UTC+7).
 */
function localMidnight(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number)
    // midnight UTC+7 = (day 00:00 UTC+7) = UTC - 7h... wait, UTC+7 means local time is UTC+7
    // So local midnight UTC+7 = UTC 17:00 previous day
    return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0))
}

/**
 * Get the business day date string for a given real datetime.
 *
 * @param date       - The real datetime to classify
 * @param closingHour - Store closing hour (0–23). Orders before this hour belong to previous business day.
 * @returns "YYYY-MM-DD" string of the business day
 */
export function getBusinessDate(date: Date, closingHour: number): string {
    if (closingHour === 0) {
        // No boundary — use calendar date in UTC+7
        const localMs = date.getTime() + TZ_OFFSET_MS
        const d = new Date(localMs)
        return d.toISOString().slice(0, 10)
    }

    // Convert to UTC+7 local time
    const localMs = date.getTime() + TZ_OFFSET_MS
    const local = new Date(localMs)

    const hour = local.getUTCHours()
    const year = local.getUTCFullYear()
    const month = local.getUTCMonth()
    const day = local.getUTCDate()

    // If current local hour < closingHour → still belongs to previous business day
    if (hour < closingHour) {
        const prev = new Date(Date.UTC(year, month, day - 1))
        return prev.toISOString().slice(0, 10)
    }

    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Get the UTC date range for a given business day string.
 *
 * @param businessDate - "YYYY-MM-DD" string (business day)
 * @param closingHour  - Store closing hour (0–23)
 * @returns { start: Date, end: Date } both in UTC
 */
export function getBusinessDayRange(
    businessDate: string,
    closingHour: number
): { start: Date; end: Date } {
    const [y, m, d] = businessDate.split('-').map(Number)

    if (closingHour === 0) {
        // Standard midnight-to-midnight in UTC+7
        const start = new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0))       // 00:00 UTC+7
        const end   = new Date(Date.UTC(y, m - 1, d, 16, 59, 59, 999))    // 23:59:59 UTC+7
        return { start, end }
    }

    // Business day starts at closingHour:00 on businessDate (UTC+7)
    // and ends at closingHour:00 on businessDate+1 - 1ms (UTC+7)
    const startUtcH = closingHour - 7  // convert UTC+7 → UTC
    const start = new Date(Date.UTC(y, m - 1, d,     startUtcH, 0, 0, 0))
    const end   = new Date(Date.UTC(y, m - 1, d + 1, startUtcH, 0, 0, 0) - 1)

    return { start, end }
}

/**
 * Get today's business date string (UTC+7 aware).
 */
export function todayBusinessDate(closingHour: number): string {
    return getBusinessDate(new Date(), closingHour)
}

/**
 * Get the current business day range for "today".
 */
export function todayBusinessDayRange(closingHour: number): { start: Date; end: Date } {
    const today = todayBusinessDate(closingHour)
    return getBusinessDayRange(today, closingHour)
}
