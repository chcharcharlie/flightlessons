import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  CalendarDaysIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  CheckIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

const CALENDAR_FUNCTION_URL = 'https://us-central1-flightlessons-8b9bd.cloudfunctions.net/calendarFeed'

export const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [copied, setCopied] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [connectingGcal, setConnectingGcal] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const calendarUrl = user?.calendarToken
    ? `${CALENDAR_FUNCTION_URL}?userId=${user.uid}&token=${user.calendarToken}`
    : null

  const gcalConnected = (user as any)?.googleCalendar?.connected === true

  // Handle redirect back from Google OAuth
  useEffect(() => {
    if (searchParams.get('calendarConnected')) {
      refreshUser()
      setStatusMsg({ type: 'success', text: 'Google Calendar connected successfully!' })
      setSearchParams({})
    }
    if (searchParams.get('calendarError')) {
      setStatusMsg({ type: 'error', text: `Connection failed: ${searchParams.get('calendarError')}` })
      setSearchParams({})
    }
  }, [searchParams])

  const handleGenerateToken = async () => {
    setGeneratingToken(true)
    try {
      const generate = httpsCallable(functions, 'generateCalendarToken')
      await generate({})
      await refreshUser()
    } catch (err) {
      console.error('Failed to generate calendar token:', err)
      setStatusMsg({ type: 'error', text: 'Failed to generate link. Please try again.' })
    } finally {
      setGeneratingToken(false)
    }
  }

  const handleCopy = async () => {
    if (!calendarUrl) return
    await navigator.clipboard.writeText(calendarUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnectGcal = async () => {
    setConnectingGcal(true)
    try {
      const getUrl = httpsCallable(functions, 'googleCalendarAuthUrl')
      const result: any = await getUrl({})
      // Open OAuth URL in same tab (redirect flow)
      window.location.href = result.data.url
    } catch (err) {
      console.error('Failed to get auth URL:', err)
      setStatusMsg({ type: 'error', text: 'Failed to connect Google Calendar. Please try again.' })
      setConnectingGcal(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const syncAll = httpsCallable(functions, 'syncAllLessonsToCalendar')
      const result: any = await syncAll({})
      setStatusMsg({ type: 'success', text: `Synced ${result.data.synced} lessons to Google Calendar!` })
    } catch (err) {
      console.error('Sync all failed:', err)
      setStatusMsg({ type: 'error', text: 'Sync failed. Please try again.' })
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnectGcal = async () => {
    if (!confirm('Disconnect Google Calendar? Future lessons won\'t sync automatically.')) return
    setDisconnecting(true)
    try {
      const disconnect = httpsCallable(functions, 'googleCalendarDisconnect')
      await disconnect({})
      await refreshUser()
      setStatusMsg({ type: 'success', text: 'Google Calendar disconnected.' })
    } catch (err) {
      console.error('Failed to disconnect:', err)
      setStatusMsg({ type: 'error', text: 'Failed to disconnect. Please try again.' })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Status message */}
      {statusMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          statusMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {statusMsg.type === 'success'
            ? <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
            : <XCircleIcon className="h-5 w-5 flex-shrink-0" />}
          {statusMsg.text}
          <button type="button" onClick={() => setStatusMsg(null)} className="ml-auto text-lg leading-none opacity-50 hover:opacity-100">×</button>
        </div>
      )}

      {/* Google Calendar — primary (real-time sync) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <img src="https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png"
               alt="Google Calendar" className="h-5 w-5 object-contain" />
          <h2 className="text-lg font-semibold text-gray-900">Google Calendar</h2>
          {gcalConnected && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Connected
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Connect your Google Calendar for <strong>instant sync</strong> — lessons appear immediately when scheduled,
            and update automatically when rescheduled or cancelled. Default duration: 3 hours.
          </p>

          {gcalConnected ? (
            <div className="space-y-3">
              <div className="bg-green-50 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                All lessons are syncing to your Google Calendar automatically.
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={syncing}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync existing lessons now'}
                </button>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={handleDisconnectGcal}
                  disabled={disconnecting}
                  className="text-sm text-gray-400 hover:text-red-600 transition-colors"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGcal}
              disabled={connectingGcal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm disabled:opacity-50"
            >
              <img src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png"
                   alt="" className="h-4 w-4" />
              {connectingGcal ? 'Redirecting to Google...' : 'Connect with Google'}
            </button>
          )}
        </div>
      </div>

      {/* ICS Subscription — fallback for Apple/Outlook */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <CalendarDaysIcon className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Apple / Outlook Calendar</h2>
          <span className="ml-auto text-xs text-gray-400">Updates every ~1 hour</span>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Subscribe via URL for Apple Calendar or Outlook. Updates sync automatically when your calendar app refreshes (hourly).
          </p>

          {calendarUrl ? (
            <div className="space-y-2">
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
                  {copied ? <><CheckIcon className="h-4 w-4" /> Copied!</> : <><ClipboardDocumentIcon className="h-4 w-4" /> Copy URL</>}
                </button>
              </div>
              <button
                type="button"
                onClick={handleGenerateToken}
                disabled={generatingToken}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowPathIcon className={`h-3 w-3 ${generatingToken ? 'animate-spin' : ''}`} />
                {generatingToken ? 'Regenerating...' : 'Regenerate link'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateToken}
              disabled={generatingToken}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <CalendarDaysIcon className="h-4 w-4" />
              {generatingToken ? 'Generating...' : 'Generate Subscription Link'}
            </button>
          )}

          {calendarUrl && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">How to subscribe:</p>
              <details className="group">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 list-none">
                  <span>🍎</span><span className="font-medium">Apple Calendar</span>
                  <span className="ml-auto text-xs text-gray-400 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-400 hidden group-open:block">▲</span>
                </summary>
                <ol className="mt-2 ml-6 text-xs text-gray-500 space-y-1 list-decimal">
                  <li>File → <strong>New Calendar Subscription</strong></li>
                  <li>Paste the URL → Subscribe</li>
                  <li>Set Auto-refresh to <strong>Every Hour</strong></li>
                </ol>
              </details>
              <details className="group">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 list-none">
                  <span>📨</span><span className="font-medium">Outlook</span>
                  <span className="ml-auto text-xs text-gray-400 group-open:hidden">▼</span>
                  <span className="ml-auto text-xs text-gray-400 hidden group-open:block">▲</span>
                </summary>
                <ol className="mt-2 ml-6 text-xs text-gray-500 space-y-1 list-decimal">
                  <li>Calendar → Add calendar → <strong>Subscribe from web</strong></li>
                  <li>Paste the URL → Import</li>
                </ol>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
