import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface QuickTemplate {
  id: string
  label: string
  minutes: number
}

const defaultQuickTemplates: QuickTemplate[] = [
  { id: 't-2h', label: '2h', minutes: 120 },
  { id: 't-4h', label: '4h', minutes: 240 },
  { id: 't-6h', label: '6h', minutes: 360 },
  { id: 't-8h', label: '8h', minutes: 480 },
]

interface AuthStore {
  user: any | null
  session: any | null
  loading: boolean
  error: string | null
  setUser: (user: any) => void
  setSession: (session: any) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      loading: false,
      error: null,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      logout: () => set({ user: null, session: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
      }),
    }
  )
)

interface ShiftStore {
  shifts: any[]
  loading: boolean
  error: string | null
  setShifts: (shifts: any[]) => void
  addShift: (shift: any) => void
  updateShift: (id: string, shift: any) => void
  deleteShift: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useShiftStore = create<ShiftStore>((set) => ({
  shifts: [],
  loading: false,
  error: null,
  setShifts: (shifts) => set({ shifts }),
  addShift: (shift) =>
    set((state) => ({
      shifts: [shift, ...state.shifts],
    })),
  updateShift: (id, shift) =>
    set((state) => ({
      shifts: state.shifts.map((s) => (s.id === id ? shift : s)),
    })),
  deleteShift: (id) =>
    set((state) => ({
      shifts: state.shifts.filter((s) => s.id !== id),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))

interface UserSettingsStore {
  settings: {
    school_hours_per_week: number
    hourly_rate: number
    currency: string
    theme: 'light' | 'dark'
    notifications_enabled: boolean
    email_digest_enabled: boolean
    quick_templates: QuickTemplate[]
  } | null
  setSettings: (settings: any) => void
  updateSettings: (updates: any) => void
  setQuickTemplates: (templates: QuickTemplate[]) => void
}

export const useSettingsStore = create<UserSettingsStore>()(
  persist(
    (set) => ({
      settings: {
        school_hours_per_week: 20,
        hourly_rate: 120,
        currency: 'NOK',
        theme: 'light',
        notifications_enabled: true,
        email_digest_enabled: true,
        quick_templates: defaultQuickTemplates,
      },
      setSettings: (settings) =>
        set({
          settings: {
            ...settings,
            quick_templates: settings?.quick_templates?.length
              ? settings.quick_templates
              : defaultQuickTemplates,
          },
        }),
      updateSettings: (updates) =>
        set((state) => ({
          settings: state.settings ? { ...state.settings, ...updates } : null,
        })),
      setQuickTemplates: (templates) =>
        set((state) => ({
          settings: state.settings
            ? { ...state.settings, quick_templates: templates }
            : null,
        })),
    }),
    {
      name: 'settings-storage',
    }
  )
)
