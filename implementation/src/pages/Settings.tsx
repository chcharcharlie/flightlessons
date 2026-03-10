import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  CalendarDaysIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

const CALENDAR_FUNCTION_URL = 'https://us-central1-flightlessons-8b9bd.cloudfunctions.net/calendarFeed'

export const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const calendarUrl = user?.calendarToken
    ? `${CALENDAR_FUNCTION_URL}?userId=${user.uid}&token=${user.calendarToken}`
    : null

  const handleGenerateToken = async () => {
    setGenerating(true)
    try {
      const generate = httpsCallable(functions, 'generateCalendarToken')
      await generate({})
      await refreshUser()
    } catch (err) {
      console.error('Failed to generate calendar token:', err)
      alert('Failed to generate calendar link. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!calendarUrl) return
    await navigator.clipboard.writeText(calendarUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      {/* Calendar Integration */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Calendar Sync</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Subscribe to your lesson calendar so scheduled lessons automatically appear in Google Calendar,
            Apple Calendar, or Outlook. Cancellations and reschedules sync automatically.
          </p>

          {/* Duration note */}
          <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700">
            📅 Each lesson is added as a <strong>3-hour block</strong> by default.
          </div>

          {/* URL section */}
          {calendarUrl ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Your subscription URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={calendarUrl}
                  className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 font-mono truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="h-4 w-4" />
                      Copy URL
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={handleGenerateToken}
                disabled={generating}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowPathIcon className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Regenerating...' : 'Regenerate link (invalidates old link)'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateToken}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <CalendarDaysIcon className="h-4 w-4" />
              {generating ? 'Generating...' : 'Generate Calendar Link'}
            </button>
          )}

          {/* Instructions */}
          {calendarUrl && (
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">How to subscribe:</p>

              <details className="group">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 list-none">
                  <span className="text-lg">📅</span>
                  <span className="font-medium">Google Calendar</span>
                  <span className="ml-auto text-xs text-gray-400 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-400 hidden group-open:block">▲</span>
                </summary>
                <ol className="mt-2 ml-7 text-xs text-gray-500 space-y-1 list-decimal">
                  <li>Open Google Calendar on desktop</li>
                  <li>Click <strong>+</strong> next to "Other calendars" → <strong>"From URL"</strong></li>
                  <li>Paste your subscription URL and click <strong>Add calendar</strong></li>
                  <li>Your lessons will appear within a few minutes</li>
                </ol>
              </details>

              <details className="group">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 list-none">
                  <span className="text-lg">🍎</span>
                  <span className="font-medium">Apple Calendar (Mac/iPhone)</span>
                  <span className="ml-auto text-xs text-gray-400 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-400 hidden group-open:block">▲</span>
                </summary>
                <ol className="mt-2 ml-7 text-xs text-gray-500 space-y-1 list-decimal">
                  <li>Open Calendar app → File → <strong>New Calendar Subscription</strong></li>
                  <li>Paste your URL and click <strong>Subscribe</strong></li>
                  <li>Set Auto-refresh to <strong>Every hour</strong></li>
                  <li>Click OK — lessons will sync automatically</li>
                </ol>
              </details>

              <details className="group">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 list-none">
                  <span className="text-lg">📨</span>
                  <span className="font-medium">Outlook (Microsoft 365)</span>
                  <span className="ml-auto text-xs text-gray-400 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-400 hidden group-open:block">▲</span>
                </summary>
                <ol className="mt-2 ml-7 text-xs text-gray-500 space-y-1 list-decimal">
                  <li>Go to <strong>outlook.com</strong> → Calendar</li>
                  <li>Click <strong>Add calendar</strong> → <strong>Subscribe from web</strong></li>
                  <li>Paste your URL and click <strong>Import</strong></li>
                  <li>Lessons will sync every few hours</li>
                </ol>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
