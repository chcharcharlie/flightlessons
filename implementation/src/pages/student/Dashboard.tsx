import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  HomeIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  BookOpenIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { StudentDashboardHome } from './StudentDashboardHome'
import { StudentProgress } from './Progress'
import { StudentProgramProgress } from './StudentProgramProgress'
import { StudentLessons } from './StudentLessons'
import { StudentLessonDetail } from './StudentLessonDetail'
import { StudentStudy } from './StudentStudy'

const navigation = [
  { name: 'Dashboard', href: '/student', icon: HomeIcon },
  { name: 'Progress', href: '/student/progress', icon: ChartBarIcon },
  { name: 'Study', href: '/student/study', icon: BookOpenIcon },
]

export const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  FlightLessons
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-sky text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <div className="ml-3 relative flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {user?.displayName}
                </span>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route index element={<StudentDashboardHome />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="programs/:programId/progress" element={<StudentProgramProgress />} />
          <Route path="lessons" element={<StudentLessons />} />
          <Route path="lessons/:lessonId" element={<StudentLessonDetail />} />
          <Route path="study" element={<StudentStudy />} />
        </Routes>
      </main>
    </div>
  )
}