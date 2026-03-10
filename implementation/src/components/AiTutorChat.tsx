import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import {
  SparklesIcon,
  PaperAirplaneIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { citationToUrl } from '@/utils/citationLinks'

interface AiTutorChatProps {
  programCertificate?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Timestamp | null
  citations?: string[]
}

interface Session {
  id: string
  title: string
  lastMessageAt: Timestamp | null
  messageCount: number
  programCertificate: string
}

const CERT_LABELS: Record<string, string> = {
  PRIVATE: 'PPL',
  INSTRUMENT: 'IR',
  COMMERCIAL: 'CPL',
}

export const AiTutorChat: React.FC<AiTutorChatProps> = ({ programCertificate }) => {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load sessions list
  useEffect(() => {
    if (!user) return
    setLoadingSessions(true)
    const q = query(
      collection(db, 'aiTutorSessions'),
      where('studentUid', '==', user.uid),
      orderBy('lastMessageAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const list: Session[] = snap.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title || 'Untitled conversation',
        lastMessageAt: doc.data().lastMessageAt,
        messageCount: doc.data().messageCount || 0,
        programCertificate: doc.data().programCertificate || 'PRIVATE',
      }))
      setSessions(list)
      setLoadingSessions(false)
    })
    return () => unsub()
  }, [user])

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }
    const q = query(
      collection(db, 'aiTutorSessions', activeSessionId, 'messages'),
      orderBy('timestamp', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = snap.docs.map((doc) => ({
        id: doc.id,
        role: doc.data().role,
        content: doc.data().content,
        timestamp: doc.data().timestamp,
        citations: doc.data().citations,
      }))
      setMessages(msgs)
    })
    return () => unsub()
  }, [activeSessionId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)
    try {
      const functions = getFunctions()
      const fn = httpsCallable(functions, 'studentAiTutor')
      const result: any = await fn({
        message: text,
        sessionId: activeSessionId,
        programCertificate: programCertificate || 'PRIVATE',
      })
      if (result.data.sessionId && !activeSessionId) {
        setActiveSessionId(result.data.sessionId)
      }
    } catch (err: any) {
      console.error('AI Tutor error:', err)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (ts: Timestamp | null) => {
    if (!ts) return ''
    const d = ts.toDate()
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex h-full min-h-[500px] border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Sidebar — session list */}
      <div className="w-56 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={() => setActiveSessionId(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loadingSessions ? (
            <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-400 text-center">
              No conversations yet
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                  activeSessionId === s.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                }`}
              >
                <div className="text-xs font-medium text-gray-800 truncate">{s.title}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-gray-400">{formatTime(s.lastMessageAt)}</span>
                  {s.programCertificate && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">
                      {CERT_LABELS[s.programCertificate] || s.programCertificate}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
          <SparklesIcon className="w-5 h-5 text-blue-500" />
          <span className="font-medium text-gray-800 text-sm">AI Tutor</span>
          <span className="text-xs text-gray-400 ml-1">
            Powered by Claude · Answers based on FAR/AIM
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!activeSessionId && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Ask anything about aviation</p>
              <p className="text-gray-400 text-sm mt-1">
                FAR/AIM, procedures, weather, systems — your AI tutor is here
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {[
                  'What is VFR minimum visibility?',
                  'Explain the 4 forces of flight',
                  'What are personal minimums?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {msg.citations.map((c) => {
                      const url = citationToUrl(c)
                      return url ? (
                        <a
                          key={c}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] bg-white/20 text-current px-1.5 py-0.5 rounded-full border border-current/20 hover:bg-white/30 transition-colors underline-offset-2 hover:underline"
                          title={`Open ${c} in official source`}
                        >
                          📖 {c}
                        </a>
                      ) : (
                        <span
                          key={c}
                          className="text-[10px] bg-white/20 text-current px-1.5 py-0.5 rounded-full border border-current/20"
                        >
                          {c}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-sm px-4 py-3 text-sm flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 animate-pulse text-blue-400" />
                Thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Disclaimer */}
        <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-700">
          ⚠️ For study reference only. Always verify with your CFI and the official FAR/AIM.
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about aviation..."
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
            style={{ maxHeight: 120, overflowY: 'auto' }}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
