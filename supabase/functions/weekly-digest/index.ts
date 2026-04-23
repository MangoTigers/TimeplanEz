// Email digest function
// Send weekly email summary of hours and earnings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface WeeklyEmailData {
  user_id: string
  email: string
  total_hours: number
  paid_hours: number
  unpaid_hours: number
  earnings: number
  currency: string
  hourly_rate: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Get all users with email digest enabled
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('email_digest_enabled', true)

    if (usersError) throw usersError

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)) // Start of week (Monday)

    for (const user of users || []) {
      // Get shifts for this week
      const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart.toISOString().split('T')[0])

      if (shiftsError) continue

      const totalHours = (shifts || []).reduce((sum: number, s: any) => sum + s.hours_worked, 0)
      const paidHours = (shifts || [])
        .filter((s: any) => s.paid === true)
        .reduce((sum: number, s: any) => sum + s.hours_worked, 0)
      const earnings = paidHours * user.hourly_rate

      // Send email (integrate with SendGrid or similar)
      console.log(`Weekly digest for ${user.email}: ${paidHours}h paid, ${earnings} ${user.currency}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Weekly digests sent' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
