import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  defaultCategories,
  defaultReflectionFields,
  normalizeReflectionFields,
  type ReflectionFieldConfig,
} from '@/lib/reflections'
import type { AppLanguage } from '@/lib/i18n'

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
    use_school_hours_mode: boolean
    hourly_rate: number
    currency: string
    language: AppLanguage
    openai_api_key: string
    theme: 'light' | 'dark'
    notifications_enabled: boolean
    email_digest_enabled: boolean
    custom_categories: string[]
    reflection_fields: ReflectionFieldConfig[]
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
        use_school_hours_mode: true,
        hourly_rate: 120,
        currency: 'NOK',
        language: 'no',
        openai_api_key: '',
        theme: 'light',
        notifications_enabled: true,
        email_digest_enabled: true,
        custom_categories: defaultCategories,
        reflection_fields: defaultReflectionFields,
        quick_templates: defaultQuickTemplates,
      },
      setSettings: (settings) =>
        set((state) => ({
          settings: {
            ...settings,
            school_hours_per_week: settings?.school_hours_per_week ?? 20,
            use_school_hours_mode: settings?.use_school_hours_mode ?? true,
            hourly_rate: settings?.hourly_rate ?? 120,
            currency: settings?.currency ?? 'NOK',
            language: settings?.language ?? state.settings?.language ?? 'no',
            openai_api_key: settings?.openai_api_key ?? '',
            theme: settings?.theme ?? 'light',
            notifications_enabled: settings?.notifications_enabled ?? true,
            email_digest_enabled: settings?.email_digest_enabled ?? true,
            custom_categories: settings?.custom_categories?.length
              ? settings.custom_categories
              : defaultCategories,
            reflection_fields: settings?.reflection_fields?.length
              ? normalizeReflectionFields(settings.reflection_fields)
              : defaultReflectionFields,
            quick_templates: settings?.quick_templates?.length
              ? settings.quick_templates
              : defaultQuickTemplates,
          },
        })),
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
