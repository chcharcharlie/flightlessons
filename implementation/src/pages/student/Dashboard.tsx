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

const navigation = [
  { name: 'Dashboard', href: '/student', icon: HomeIcon },
  { name: 'Progress', href: '/student/progress', icon: ChartBarIcon },
  { name: 'Lessons', href: '/student/lessons', icon: CalendarDaysIcon },
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
          <Route path="progress" element={<div>Progress</div>} />
          <Route path="lessons" element={<div>Lessons</div>} />
          <Route path="study" element={<div>Study Materials</div>} />
        </Routes>
      </main>
    </div>
  )
}

const StudentDashboardHome: React.FC = () => {
  const { user } = useAuth()

  return (
    <div className="px-4 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900">
        Welcome back, {user?.displayName}
      </h2>
      <p className="mt-2 text-gray-600">
        Private Pilot Training • Next Lesson: 2 days
      </p>

      {/* Progress Overview */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900">
          Private Pilot Progress
        </h3>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">
              Overall Progress
            </span>
            <span className="text-sm font-medium text-gray-900">45%</span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-sky to-green-500 h-2 rounded-full"
              style={{ width: '45%' }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Flight Hours */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarDaysIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Flight Hours
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    23.4
                  </dd>
                  <dd className="text-sm text-green-600">↑ 2.3 this month</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Ground Progress */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpenIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Ground Progress
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    67%
                  </dd>
                  <dd className="text-sm text-gray-500">24/36 complete</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Next Goal */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Next Goal
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    Solo X-Country
                  </dd>
                  <dd className="text-sm text-gray-500">5 items left</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Lessons */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900">Upcoming Lessons</h3>
        <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            <li className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-sm font-medium text-gray-900">
                        Nov 5
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        9:00 AM
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        Pattern Work
                      </div>
                      <div className="text-sm text-gray-500">
                        • Normal landings • Crosswind technique
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    Pre-study: POH Section 4, AIM 4-3-3
                  </div>
                </div>
                <Link
                  to="/student/lessons/1"
                  className="text-sky hover:text-sky-600 text-sm font-medium"
                >
                  View Details
                </Link>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}