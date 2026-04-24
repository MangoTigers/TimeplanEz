import { Shift } from './calculations'
import { translate } from './i18n'
import { useSettingsStore } from '@/store'

const getLanguage = () => useSettingsStore.getState().settings?.language || 'no'

const getLocale = (language: string) => {
  if (language === 'sv') return 'sv-SE'
  if (language === 'en') return 'en-US'
  return 'nb-NO'
}

/**
 * Export shifts to CSV format
 */
export function shiftsToCSV(shifts: Shift[], hourlyRate: number, currency: string): string {
  const language = getLanguage()
  const locale = getLocale(language)
  const headers = [
    translate(language, 'analytics.headersDate'),
    translate(language, 'analytics.headersTotalHours'),
    translate(language, 'analytics.headersStatus'),
    translate(language, 'analytics.headersCategories'),
    translate(language, 'analytics.headersNotes'),
    translate(language, 'export.totalEarnings'),
  ]
  const rows = shifts.map((shift) => {
    const earnings = shift.paid ? shift.hours_worked * hourlyRate : 0
    return [
      new Date(shift.date).toLocaleDateString(locale),
      shift.hours_worked,
      shift.paid ? translate(language, 'common.paid') : translate(language, 'common.unpaid'),
      shift.category || translate(language, 'common.general'),
      shift.notes || '',
      `${currency} ${earnings.toFixed(2)}`,
    ]
  })

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
        .join(',')
    ),
  ].join('\n')

  return csv
}

/**
 * Generate PDF report
 */
export async function generatePDFReport(
  shifts: Shift[],
  totalEarnings: number,
  currency: string,
  userName: string
) {
  const { jsPDF } = await import('jspdf')
  const language = getLanguage()
  const locale = getLocale(language)

  const doc = new jsPDF()
  doc.setFontSize(24)
  doc.text(translate(language, 'export.reportTitle'), 20, 20)
  doc.setFontSize(10)
  doc.text(`${translate(language, 'export.generated')}: ${new Date().toLocaleDateString(locale)}`, 20, 30)
  doc.text(`${translate(language, 'export.user')}: ${userName}`, 20, 40)

  // Add summary
  doc.setFontSize(14)
  doc.text(translate(language, 'export.summary'), 20, 55)
  doc.setFontSize(10)
  const totalHours = shifts.reduce((sum, s) => sum + s.hours_worked, 0)
  const paidHours = shifts.filter((s) => s.paid).reduce((sum, s) => sum + s.hours_worked, 0)

  doc.text(`${translate(language, 'export.totalHours')}: ${totalHours}`, 20, 65)
  doc.text(`${translate(language, 'export.paidHours')}: ${paidHours}`, 20, 75)
  doc.text(`${translate(language, 'export.totalEarnings')}: ${currency} ${totalEarnings.toFixed(2)}`, 20, 85)

  // Add table of shifts
  doc.setFontSize(12)
  doc.text(translate(language, 'export.shifts'), 20, 100)

  let yPosition = 110
  shifts.slice(0, 20).forEach((shift) => {
    const earnings = shift.paid ? shift.hours_worked * (totalEarnings / paidHours || 0) : 0
    const line = `${new Date(shift.date).toLocaleDateString(locale)} - ${shift.hours_worked}h (${shift.paid ? translate(language, 'common.paid') : translate(language, 'common.unpaid')}) - ${currency} ${earnings.toFixed(2)}`
    doc.setFontSize(9)
    doc.text(line, 20, yPosition)
    yPosition += 8

    if (yPosition > 270) {
      doc.addPage()
      yPosition = 20
    }
  })

  doc.save(`eztimeplan-report-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Send email notification via Supabase
 */
export async function sendEmailNotification(
  email: string,
  subject: string,
  template: string,
  data: any
) {
  try {
    const response = await fetch(
      `${"https://hequhhjhvwbmbkwyjzhj.supabase.co"}/functions/v1/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${"eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlcXVoaGpodndibWJrd3lqemhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzUwMzMsImV4cCI6MjA5MjUxMTAzM30"}`,
        },
        body: JSON.stringify({
          email,
          subject,
          template,
          data,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(translate(getLanguage(), 'export.failedToSendEmail'))
    }

    return await response.json()
  } catch (error) {
    console.error('Email notification error:', error)
    throw error
  }
}
