'use client'

import ProtectedRoute from '../../../components/ProtectedRoute'
import { RamOrdersAdminPageContent } from '../pending/page'

export default function RamCancelledAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <RamOrdersAdminPageContent status="Cancelled" />
    </ProtectedRoute>
  )
}
