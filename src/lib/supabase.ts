import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Keep app bootable even when env vars are missing so users get a visible setup message.
const fallbackUrl = 'http://localhost:54321'
const fallbackAnonKey = 'public-anon-key'

export const supabase = createClient(
  supabaseUrl || fallbackUrl,
  supabaseAnonKey || fallbackAnonKey
)

// Helper to get current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper to get user profile
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function ensureUserProfile(user: { id: string; email?: string | null }) {
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (selectError) {
    throw selectError
  }

  if (existing) {
    return
  }

  const { error: insertError } = await supabase.from('users').insert({
    id: user.id,
    email: user.email ?? `${user.id}@local.user`,
    school_hours_per_week: 20,
    hourly_rate: 120,
    currency: 'NOK',
  })

  if (insertError) {
    throw insertError
  }
}
