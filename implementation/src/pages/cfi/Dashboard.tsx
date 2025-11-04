import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  HomeIcon,
  UserGroupIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ClipboardDocumentListIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { StudyItems } from './StudyItems'
import { Students } from './Students'
import { TrainingPrograms } from './TrainingPrograms'
import { ProgramProgress } from './ProgramProgress'
import { Lessons } from './Lessons'
import { LessonDetail } from './LessonDetail'
import { LessonPlans } from './LessonPlans'
import { LessonPlanDetail } from './LessonPlanDetail'

const navigation = [
  { name: 'Dashboard', href: '/cfi', icon: HomeIcon },
  { name: 'Students', href: '/cfi/students', icon: UserGroupIcon },
  { name: 'Programs', href: '/cfi/programs', icon: AcademicCapIcon },
  { name: 'Study Items', href: '/cfi/study-items', icon: BookOpenIcon },
  { name: 'Lesson Plans', href: '/cfi/lesson-plans', icon: BookOpenIcon },
  { name: 'Lessons', href: '/cfi/lessons', icon: ClipboardDocumentListIcon },
]

export const CFIDashboard: React.FC = () => {
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
          <Route index element={<CFIDashboardHome />} />
          <Route path="students" element={<Students />} />
          <Route path="programs" element={<TrainingPrograms />} />
          <Route path="programs/:programId/progress" element={<ProgramProgress />} />
          <Route path="study-items" element={<StudyItems />} />
          <Route path="lesson-plans" element={<LessonPlans />} />
          <Route path="lesson-plans/:certificate/:planId" element={<LessonPlanDetail />} />
          <Route path="lesson-plans/:certificate/:planId/edit" element={<LessonPlanDetail />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="lessons/:lessonId" element={<LessonDetail />} />
        </Routes>
      </main>
    </div>
  )
}

const CFIDashboardHome: React.FC = () => {
  const { user } = useAuth()

  return (
    <div className="px-4 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900">
        Welcome back, {user?.displayName}
      </h2>
      <p className="mt-2 text-gray-600">
        You have 3 lessons scheduled today
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Students */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Students
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    12
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AcademicCapIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    This Week
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    15
                  </dd>
                  <dd className="text-sm text-gray-500">lessons</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* ACS Coverage */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClipboardDocumentListIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    ACS Coverage
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    87%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Average Progress */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpenIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Avg Progress
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    68%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900">Today's Schedule</h3>
        <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            <li className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-sm font-medium text-gray-900">
                      9:00 AM
                    </span>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      Sarah Chen
                    </div>
                    <div className="text-sm text-gray-500">
                      Lesson 5: Pattern Work • KPAO - Local
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">PA Progress: 45%</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}