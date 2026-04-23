import { Shift } from './calculations'

/**
 * Export shifts to CSV format
 */
export function shiftsToCSV(shifts: Shift[], hourlyRate: number, currency: string): string {
  const headers = ['Date', 'Hours', 'Status', 'Category', 'Notes', 'Earnings']
  const rows = shifts.map((shift) => {
    const earnings = shift.paid ? shift.hours_worked * hourlyRate : 0
    return [
      new Date(shift.date).toLocaleDateString('nb-NO'),
      shift.hours_worked,
      shift.paid ? 'Paid' : 'Unpaid',
      shift.category || '-',
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

  const doc = new jsPDF()
  doc.setFontSize(24)
  doc.text('TimeplanEz - Earnings Report', 20, 20)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString('nb-NO')}`, 20, 30)
  doc.text(`User: ${userName}`, 20, 40)

  // Add summary
  doc.setFontSize(14)
  doc.text('Summary', 20, 55)
  doc.setFontSize(10)
  const totalHours = shifts.reduce((sum, s) => sum + s.hours_worked, 0)
  const paidHours = shifts.filter((s) => s.paid).reduce((sum, s) => sum + s.hours_worked, 0)

  doc.text(`Total Hours: ${totalHours}`, 20, 65)
  doc.text(`Paid Hours: ${paidHours}`, 20, 75)
  doc.text(`Total Earnings: ${currency} ${totalEarnings.toFixed(2)}`, 20, 85)

  // Add table of shifts
  doc.setFontSize(12)
  doc.text('Shifts', 20, 100)

  let yPosition = 110
  shifts.slice(0, 20).forEach((shift) => {
    const earnings = shift.paid ? shift.hours_worked * (totalEarnings / paidHours || 0) : 0
    const line = `${new Date(shift.date).toLocaleDateString('nb-NO')} - ${shift.hours_worked}h (${shift.paid ? 'Paid' : 'Unpaid'}) - ${currency} ${earnings.toFixed(2)}`
    doc.setFontSize(9)
    doc.text(line, 20, yPosition)
    yPosition += 8

    if (yPosition > 270) {
      doc.addPage()
      yPosition = 20
    }
  })

  doc.save(`timeplanez-report-${new Date().toISOString().split('T')[0]}.pdf`)
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
      throw new Error('Failed to send email')
    }

    return await response.json()
  } catch (error) {
    console.error('Email notification error:', error)
    throw error
  }
}
