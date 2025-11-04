import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { CFIDashboard } from '@/pages/cfi/Dashboard'
import { StudentDashboard } from '@/pages/student/Dashboard'
import { AcceptInvitation } from '@/pages/AcceptInvitation'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      
      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {user?.role === 'CFI' ? (
              <Navigate to="/cfi" replace />
            ) : (
              <Navigate to="/student" replace />
            )}
          </ProtectedRoute>
        }
      />
      
      {/* CFI routes */}
      <Route
        path="/cfi/*"
        element={
          <ProtectedRoute requireRole="CFI">
            <CFIDashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Student routes */}
      <Route
        path="/student/*"
        element={
          <ProtectedRoute requireRole="STUDENT">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App