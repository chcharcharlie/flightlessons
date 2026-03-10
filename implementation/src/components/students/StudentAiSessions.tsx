import React, { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { SparklesIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { citationToUrl } from '@/utils/citationLinks'

interface StudentAiSessionsProps {
  studentUid: string
  workspaceId: string
}

interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Timestamp | null
  citations?: string[]
}

interface AiSession {
  id: string
  title: string
  lastMessageAt: Timestamp | null
  messageCount: number
  programCertificate: string
  messages?: AiMessage[]
  expanded?: boolean
  loadingMessages?: boolean
}

const CERT_LABELS: Record<string, string> = {
  PRIVATE: 'PPL',
  INSTRUMENT: 'IR',
  COMMERCIAL: 'CPL',
}

export const StudentAiSessions: React.FC<StudentAiSessionsProps> = ({
  studentUid,
}) => {
  const [sessions, setSessions] = useState<AiSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentUid) return
    setLoading(true)
    const q = query(
      collection(db, 'aiTutorSessions'),
      where('studentUid', '==', studentUid),
      orderBy('lastMessageAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setSessions((prev) => {
        const existingExpanded = new Map(prev.map((s) => [s.id, s.expanded]))
        const existingMessages = new Map(prev.map((s) => [s.id, s.messages]))
        return snap.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || 'Untitled conversation',
          lastMessageAt: doc.data().lastMessageAt,
          messageCount: doc.data().messageCount || 0,
          programCertificate: doc.data().programCertificate || 'PRIVATE',
          expanded: existingExpanded.get(doc.id) || false,
          messages: existingMessages.get(doc.id),
        }))
      })
      setLoading(false)
    })
    return () => unsub()
  }, [studentUid])

  const toggleExpand = async (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s
        return { ...s, expanded: !s.expanded }
      })
    )

    // Load messages if not yet loaded
    const session = sessions.find((s) => s.id === sessionId)
    if (session && !session.messages) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, loadingMessages: true } : s))
      )
      const snap = await getDocs(
        query(
          collection(db, 'aiTutorSessions', sessionId, 'messages'),
          orderBy('timestamp', 'asc')
        )
      )
      const msgs: AiMessage[] = snap.docs.map((doc) => ({
        id: doc.id,
        role: doc.data().role,
        content: doc.data().content,
        timestamp: doc.data().timestamp,
        citations: doc.data().citations,
      }))
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: msgs, loadingMessages: false } : s
        )
      )
    }
  }

  const formatTime = (ts: Timestamp | null) => {
    if (!ts) return ''
    return ts.toDate().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        Loading AI sessions...
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="py-12 text-center">
        <SparklesIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm font-medium">No AI Tutor sessions yet</p>
        <p className="text-gray-400 text-xs mt-1">
          Sessions will appear here when the student uses the AI Tutor
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">
        {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
      </p>
      {sessions.map((session) => (
        <div
          key={session.id}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          {/* Session header */}
          <button
            onClick={() => toggleExpand(session.id)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            {session.expanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-400 shrink-0" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            <SparklesIcon className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{session.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatTime(session.lastMessageAt)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                {CERT_LABELS[session.programCertificate] || session.programCertificate}
              </span>
              <span className="text-xs text-gray-400">{session.messageCount / 2 | 0} exchanges</span>
            </div>
          </button>

          {/* Messages */}
          {session.expanded && (
            <div className="px-4 py-3 bg-white space-y-3 max-h-80 overflow-y-auto">
              {session.loadingMessages ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading messages...</p>
              ) : session.messages && session.messages.length > 0 ? (
                session.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {msg.citations.map((c) => {
                            const url = citationToUrl(c)
                            return url ? (
                              <a
                                key={c}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full border border-current/20 hover:bg-white/30 transition-colors hover:underline underline-offset-2"
                                title={`Open ${c}`}
                              >
                                📖 {c}
                              </a>
                            ) : (
                              <span
                                key={c}
                                className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full border border-current/20"
                              >
                                {c}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">No messages</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
