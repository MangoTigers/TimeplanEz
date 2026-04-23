import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns'

export interface Shift {
  id: string
  user_id: string
  date: string
  hours_worked: number
  paid: boolean | null
  category?: string
  notes?: string
  reflection?: string
  created_at: string
  updated_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  school_hours_per_week: number
  hourly_rate: number
  currency: string
  theme: 'light' | 'dark'
  notifications_enabled: boolean
  email_digest_enabled: boolean
  created_at: string
  updated_at: string
}

export interface WeeklyOverride {
  id: string
  user_id: string
  week_start: string
  school_hours: number
  created_at: string
  updated_at: string
}

/**
 * Calculate if a shift should be paid based on school hours per week
 */
export function calculatePaidStatus(
  shiftsInWeek: Shift[],
  schoolHoursPerWeek: number,
  currentShiftHours: number
): boolean {
  // Sum hours marked as unpaid
  const unpaidHours = shiftsInWeek
    .filter((s) => s.paid === false)
    .reduce((sum, s) => sum + s.hours_worked, 0)

  // If total unpaid + current shift exceeds school hours, it's paid
  if (unpaidHours + currentShiftHours > schoolHoursPerWeek) {
    return true
  }

  return false
}

/**
 * Get all shifts for a specific week
 */
export function getShiftsForWeek(shifts: Shift[], date: Date): Shift[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 })

  return shifts.filter((shift) => {
    const shiftDate = parseISO(shift.date)
    return shiftDate >= weekStart && shiftDate <= weekEnd
  })
}

/**
 * Calculate weekly statistics
 */
export function calculateWeeklyStats(shifts: Shift[], schoolHoursPerWeek: number) {
  const totalHours = shifts.reduce((sum, s) => sum + s.hours_worked, 0)
  const paidHours = shifts
    .filter((s) => s.paid === true || (s.paid === null && !isPaidBasedOnRule(s, shifts, schoolHoursPerWeek)))
    .reduce((sum, s) => sum + s.hours_worked, 0)
  const unpaidHours = totalHours - paidHours

  return {
    totalHours,
    paidHours,
    unpaidHours,
    schoolHoursRemaining: Math.max(0, schoolHoursPerWeek - unpaidHours),
  }
}

/**
 * Helper to determine if a shift is paid based on the rule
 */
function isPaidBasedOnRule(shift: Shift, allShifts: Shift[], schoolHoursPerWeek: number): boolean {
  if (shift.paid !== null) return shift.paid

  const shiftDate = parseISO(shift.date)
  const weekShifts = getShiftsForWeek(allShifts, shiftDate)

  const unpaidBefore = weekShifts
    .filter((s) => parseISO(s.date) <= shiftDate && s.id !== shift.id && s.paid === false)
    .reduce((sum, s) => sum + s.hours_worked, 0)

  return unpaidBefore + shift.hours_worked > schoolHoursPerWeek
}

/**
 * Format currency display
 */
export function formatCurrency(amount: number, currency: string = 'NOK'): string {
  const symbols: Record<string, string> = {
    NOK: 'kr',
    EUR: '€',
    USD: '$',
  }

  const symbol = symbols[currency] || currency

  return `${symbol} ${amount.toLocaleString('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Calculate earnings
 */
export function calculateEarnings(paidHours: number, hourlyRate: number): number {
  return paidHours * hourlyRate
}

/**
 * Get date range labels for charts
 */
export function getDateRangeLabel(startDate: Date, endDate: Date): string {
  return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`
}

/**
 * Convert decimal hours to whole minutes.
 */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60)
}

/**
 * Convert whole minutes to decimal hours.
 */
export function minutesToHours(minutes: number): number {
  return minutes / 60
}

/**
 * Convert decimal hours into hours/minutes parts.
 */
export function hoursToParts(hours: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, hoursToMinutes(hours))
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  }
}

/**
 * Convert hours/minutes parts to decimal hours.
 */
export function partsToHours(hours: number, minutes: number): number {
  const clampedHours = Math.max(0, Math.floor(hours || 0))
  const clampedMinutes = Math.min(59, Math.max(0, Math.floor(minutes || 0)))
  return clampedHours + clampedMinutes / 60
}

/**
 * Format decimal hours as Hh Mm.
 */
export function formatHoursMinutes(hours: number): string {
  const parts = hoursToParts(hours)
  if (parts.minutes === 0) {
    return `${parts.hours}h`
  }
  return `${parts.hours}h ${parts.minutes}m`
}
