import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  } | null
  setSettings: (settings: any) => void
  updateSettings: (updates: any) => void
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
      },
      setSettings: (settings) => set({ settings }),
      updateSettings: (updates) =>
        set((state) => ({
          settings: state.settings ? { ...state.settings, ...updates } : null,
        })),
    }),
    {
      name: 'settings-storage',
    }
  )
)
