'use client'

import ProtectedRoute from '../../../components/ProtectedRoute'
import { FoodOrdersAdminPageContent } from '../pending/page'

export default function FoodCancelledAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <FoodOrdersAdminPageContent status="Cancelled" />
    </ProtectedRoute>
  )
}
