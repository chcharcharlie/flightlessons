import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireRole?: UserRole
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireRole,
}) => {
  const { user, firebaseUser, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky"></div>
      </div>
    )
  }

  // If no firebaseUser at all, redirect to login
  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If firebaseUser exists but no user document, allow access
  // (App.tsx will handle redirecting to role selection)
  if (!user && !requireRole) {
    return <>{children}</>
  }

  // If a specific role is required but user doesn't exist or has wrong role
  if (requireRole && (!user || user.role !== requireRole)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}