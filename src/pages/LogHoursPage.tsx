import React from 'react'
import { Layout } from '@/components/Layout'
import { LogHoursForm } from '@/components/shifts/LogHoursForm'

export const LogHoursPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Log Hours</h1>

        <div className="card space-y-6">
          <LogHoursForm />
        </div>
      </div>
    </Layout>
  )
}
