import React from 'react'
import { Layout } from '@/components/Layout'
import { LogHoursForm } from '@/components/shifts/LogHoursForm'
import { useTranslation } from '@/lib/i18n'

export const LogHoursPage: React.FC = () => {
  const { t } = useTranslation()
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('layout.logHours')}</h1>

        <div className="card space-y-6">
          <LogHoursForm />
        </div>
      </div>
    </Layout>
  )
}
