import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export const LandingPage: React.FC = () => {
  const { user, firebaseUser } = useAuth()
  const navigate = useNavigate()

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user?.role === 'CFI') navigate('/cfi', { replace: true })
    else if (user?.role === 'STUDENT') navigate('/student', { replace: true })
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-gray-900">FirstSolo ✈️</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
            Log in
          </Link>
          <Link
            to="/register"
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-block bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
            For student pilots & flight instructors
          </div>
          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
            From first lesson<br />to first solo — organized.
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            FirstSolo helps flight instructors manage student training programs, schedule lessons, 
            and track progress — while giving students a smart study companion powered by AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-lg"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-lg"
            >
              Log in
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
              Everything you need to track training from ground to checkride
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">📋</div>
                <h3 className="font-semibold text-gray-900 mb-2">Lesson Management</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Schedule lessons, track what was covered, record scores, and keep pre/post-lesson notes — all in one place.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">📈</div>
                <h3 className="font-semibold text-gray-900 mb-2">Progress Tracking</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  CFIs see exactly where each student stands across every ACS area. Students see their own progress toward certificate.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">✨</div>
                <h3 className="font-semibold text-gray-900 mb-2">AI Study Assistant</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Ask questions about FARs, weather, airspace, and more. Get answers grounded in official FAA sources with citations.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">📅</div>
                <h3 className="font-semibold text-gray-900 mb-2">Calendar Sync</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Connect Google Calendar for instant sync. Lessons appear the moment they're scheduled — no manual entry.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">💬</div>
                <h3 className="font-semibold text-gray-900 mb-2">Student Q&A</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Students submit questions between lessons. CFIs answer asynchronously, building a knowledge base over time.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">📚</div>
                <h3 className="font-semibold text-gray-900 mb-2">Curriculum Builder</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Build structured training programs for PPL, Instrument, and Commercial. Reuse lesson templates across students.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 text-center px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to fly smarter?</h2>
          <p className="text-gray-500 mb-8 text-lg">Free for flight instructors. Students join through their CFI.</p>
          <Link
            to="/register"
            className="bg-blue-600 text-white px-10 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-lg inline-block"
          >
            Create your account
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-6 text-center text-sm text-gray-400">
        <div className="flex justify-center gap-6 mb-2">
          <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          <Link to="/tos" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          <a href="mailto:ccehshmily@gmail.com" className="hover:text-gray-600 transition-colors">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} FirstSolo. All rights reserved.</p>
      </footer>
    </div>
  )
}
