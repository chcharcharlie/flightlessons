import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import {
  collection, doc, getDocs, query, where, setDoc, addDoc, Timestamp, orderBy
} from 'firebase/firestore'
import type { StudyArea, StudyItem, Question, CfiNote } from '@/types'
import {
  ChevronRightIcon,
  ChatBubbleLeftEllipsisIcon,
  LightBulbIcon,
  PencilSquareIcon,
  PlusIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline'

type TabType = 'instructor' | 'questions' | 'notes'

interface StudentNoteEntry {
  studyItemId: string
  content: string
  updatedAt: any
}

interface TrainingProgram {
  id: string
  certificate: string
  status: string
  name?: string
}

const CERT_LABELS: Record<string, string> = {
  PRIVATE: 'Private Pilot (PPL)',
  INSTRUMENT: 'Instrument Rating (IR)',
  COMMERCIAL: 'Commercial Pilot (CPL)',
}

export const StudentStudy: React.FC = () => {
  const { user } = useAuth()

  // Programs
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null)
  const [loadingPrograms, setLoadingPrograms] = useState(true)

  // Structure
  const [studyAreas, setStudyAreas] = useState<StudyArea[]>([])
  const [studyItems, setStudyItems] = useState<StudyItem[]>([])
  const [loadingStructure, setLoadingStructure] = useState(false)

  // Selection & navigation
  const [selectedArea, setSelectedArea] = useState<StudyArea | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('instructor')

  // Content data
  const [questions, setQuestions] = useState<Question[]>([])
  const [studentNotes, setStudentNotes] = useState<StudentNoteEntry[]>([])
  const [cfiNotes, setCfiNotes] = useState<CfiNote[]>([])

  // Ask form
  const [showAskForm, setShowAskForm] = useState(false)
  const [askText, setAskText] = useState('')
  const [askItemId, setAskItemId] = useState('')
  const [submittingQ, setSubmittingQ] = useState(false)

  // Q expand
  const [expandedQId, setExpandedQId] = useState<string | null>(null)

  // Note editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteSaveStatus, setNoteSaveStatus] = useState<'saved' | 'saving' | ''>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load all training programs ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return
    setLoadingPrograms(true)
    getDocs(query(collection(db, 'trainingPrograms'), where('studentUid', '==', user.uid)))
      .then(snap => {
        const progs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingProgram))
        // Sort: active first, then by certificate order
        const certOrder = ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL']
        progs.sort((a, b) => {
          if (a.status === 'active' && b.status !== 'active') return -1
          if (a.status !== 'active' && b.status === 'active') return 1
          return certOrder.indexOf(a.certificate) - certOrder.indexOf(b.certificate)
        })
        setPrograms(progs)
        // Default: first active, or first overall
        const defaultProg = progs.find(p => p.status === 'active') || progs[0] || null
        setSelectedProgram(defaultProg)
      })
      .catch(() => setPrograms([]))
      .finally(() => setLoadingPrograms(false))
  }, [user?.uid])

  // ── Load study areas & items (filtered by selected program certificate) ───
  useEffect(() => {
    if (!user?.cfiWorkspaceId || !selectedProgram) return
    const wsRef = doc(db, 'workspaces', user.cfiWorkspaceId)
    setLoadingStructure(true)
    setSelectedArea(null) // reset area when program changes
    Promise.all([
      getDocs(query(collection(wsRef, 'studyAreas'), orderBy('orderNumber', 'asc'))),
      getDocs(collection(wsRef, 'studyItems')),
    ]).then(([areasSnap, itemsSnap]) => {
      const areas = areasSnap.docs
        .map(d => { const data = d.data(); return { id: d.id, ...data, order: data.orderNumber || 0 } as StudyArea })
        .filter(a => a.certificate === selectedProgram.certificate)
      const items = itemsSnap.docs.map(d => {
        const data = d.data()
        return { id: d.id, ...data, areaId: data.studyAreaId, order: data.orderNumber || 0 } as StudyItem
      })
      setStudyAreas(areas)
      setStudyItems(items)
    }).catch(err => console.error('StudentStudy: structure error', err))
    .finally(() => setLoadingStructure(false))
  }, [user?.cfiWorkspaceId, selectedProgram])

  // ── Load student's own questions ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return
    getDocs(query(collection(db, 'questions'), where('studentUid', '==', user.uid)))
      .then(snap => setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Question))))
      .catch(err => console.error('StudentStudy: questions error', err))
  }, [user?.uid])

  // ── Load student notes ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return
    getDocs(query(collection(db, 'studentNotes'), where('studentUid', '==', user.uid)))
      .then(snap => setStudentNotes(snap.docs.map(d => ({
        studyItemId: d.data().studyItemId,
        content: d.data().content,
        updatedAt: d.data().updatedAt,
      }))))
      .catch(err => console.error('StudentStudy: studentNotes error', err))
  }, [user?.uid])

  // ── Load CFI notes (two equality queries to satisfy Firestore rules) ───────
  useEffect(() => {
    if (!user?.cfiWorkspaceId || !user?.uid) return
    Promise.all([
      getDocs(query(collection(db, 'cfiNotes'),
        where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
        where('targetStudentUid', '==', 'all'))),
      getDocs(query(collection(db, 'cfiNotes'),
        where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
        where('targetStudentUid', '==', user.uid))),
    ]).then(([allSnap, mineSnap]) => {
      const notes = [
        ...allSnap.docs.map(d => ({ id: d.id, ...d.data() } as CfiNote)),
        ...mineSnap.docs.map(d => ({ id: d.id, ...d.data() } as CfiNote)),
      ].sort((a, b) => ((b.createdAt as any)?.toMillis?.() ?? 0) - ((a.createdAt as any)?.toMillis?.() ?? 0))
      setCfiNotes(notes)
    }).catch(err => console.error('StudentStudy: cfiNotes error', err))
  }, [user?.cfiWorkspaceId, user?.uid])

  // ── Derived: items in selected area ──────────────────────────────────────
  const areaItems: StudyItem[] = selectedArea
    ? studyItems.filter(i => i.areaId === selectedArea.id)
    : studyItems

  const areaItemIds = new Set(areaItems.map(i => i.id))

  // ── Derived: filtered content ─────────────────────────────────────────────
  // Questions: when area selected → only questions linked to items in area
  //            when no area → all questions (including general with no studyItemId)
  const filteredQuestions = selectedArea
    ? questions.filter(q => q.studyItemId && areaItemIds.has(q.studyItemId))
    : questions

  // Notes: when area selected → notes for items in that area
  //        when no area → all notes that have content
  const filteredNotes = selectedArea
    ? studentNotes.filter(n => areaItemIds.has(n.studyItemId))
    : studentNotes

  // CFI notes: filter by selected program's certificate
  const filteredCfiNotes = selectedProgram
    ? cfiNotes.filter(n => !n.certificate || n.certificate === selectedProgram.certificate)
    : cfiNotes

  // ── Handlers ─────────────────────────────────────────────────────────────
  const submitQuestion = async () => {
    if (!askText.trim() || !user?.uid || !user?.cfiWorkspaceId) return
    setSubmittingQ(true)
    try {
      const linkedItem = studyItems.find(i => i.id === askItemId)
      const docRef = await addDoc(collection(db, 'questions'), {
        studentUid: user.uid,
        studentName: (user as any).displayName || 'Student',
        cfiWorkspaceId: user.cfiWorkspaceId,
        studyItemId: askItemId || null,
        studyItemName: linkedItem?.name || '',
        question: askText.trim(),
        status: 'open',
        createdAt: Timestamp.now(),
      })
      setQuestions(prev => [
        ...prev,
        {
          id: docRef.id,
          studentUid: user.uid,
          studentName: (user as any).displayName || 'Student',
          cfiWorkspaceId: user.cfiWorkspaceId!,
          studyItemId: askItemId || undefined,
          studyItemName: linkedItem?.name,
          question: askText.trim(),
          status: 'open',
          createdAt: Timestamp.now(),
        } as Question,
      ])
      setAskText('')
      setAskItemId('')
      setShowAskForm(false)
    } finally {
      setSubmittingQ(false)
    }
  }

  const handleNoteChange = (itemId: string, value: string) => {
    setNoteText(value)
    setNoteSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!user?.uid) return
      try {
        const noteRef = doc(db, 'studentNotes', `${user.uid}_${itemId}`)
        await setDoc(noteRef, {
          studentUid: user.uid,
          studyItemId: itemId,
          content: value,
          updatedAt: Timestamp.now(),
        }, { merge: true })
        setStudentNotes(prev => {
          const idx = prev.findIndex(n => n.studyItemId === itemId)
          if (idx >= 0) return prev.map((n, i) => i === idx ? { ...n, content: value } : n)
          return [...prev, { studyItemId: itemId, content: value, updatedAt: Timestamp.now() }]
        })
        setNoteSaveStatus('saved')
      } catch (err) {
        console.error('StudentStudy: note save error', err)
        setNoteSaveStatus('')
      }
    }, 1000)
  }

  const startEditNote = (itemId: string) => {
    const existing = studentNotes.find(n => n.studyItemId === itemId)
    setEditingItemId(itemId)
    setNoteText(existing?.content || '')
    setNoteSaveStatus('saved')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingPrograms) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500" />
      </div>
    )
  }

  if (programs.length === 0) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Study</h2>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-16 text-center">
          <BookOpenIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No training programs yet</p>
          <p className="text-gray-400 text-xs mt-1">Ask your instructor to enroll you in a program</p>
        </div>
      </div>
    )
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'instructor', label: '💡 Instructor Notes' },
    { key: 'questions', label: '❓ Questions' },
    { key: 'notes', label: '📝 My Notes' },
  ]

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Study</h2>
          <p className="mt-1 text-sm text-gray-500">
            Browse study materials, take notes, and ask your instructor questions
          </p>
        </div>
        {/* Program selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="program-select" className="text-sm text-gray-500 whitespace-nowrap">Program:</label>
          <select
            id="program-select"
            value={selectedProgram?.id ?? ''}
            onChange={e => {
              const prog = programs.find(p => p.id === e.target.value) || null
              setSelectedProgram(prog)
            }}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 min-w-[200px]"
          >
            {programs.map(p => (
              <option key={p.id} value={p.id}>
                {CERT_LABELS[p.certificate] ?? p.certificate}
                {p.status === 'active' ? ' ✓' : ' (completed)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-5">
        {/* ── Left: Study Areas ───────────────────────────────────────────── */}
        <div className="w-52 shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden sticky top-4">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Study Areas</span>
            </div>
            {studyAreas.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400">No study materials yet</p>
            ) : (
              <ul>
                {/* "All Areas" option */}
                <li>
                  <button
                    type="button"
                    onClick={() => setSelectedArea(null)}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors
                      ${!selectedArea
                        ? 'bg-sky-50 text-sky-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                  >
                    All Areas
                    {!selectedArea && <ChevronRightIcon className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                </li>
                {/* Individual areas */}
                {studyAreas.map(area => {
                  const isSelected = selectedArea?.id === area.id
                  const itemCount = studyItems.filter(i => i.areaId === area.id).length
                  return (
                    <li key={area.id} className="border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setSelectedArea(isSelected ? null : area)}
                        className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors
                          ${isSelected
                            ? 'bg-sky-50 text-sky-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                      >
                        <span className="truncate">{area.name}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-gray-400">{itemCount}</span>
                          {isSelected && <ChevronRightIcon className="w-3 h-3" />}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Right: Tabbed content ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="border-b border-gray-200 mb-5">
            <nav className="-mb-px flex space-x-1">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === key
                      ? 'border-sky-500 text-sky-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── Tab: Instructor Notes ──────────────────────────────────────── */}
          {activeTab === 'instructor' && (
            <div>
              {selectedArea && (
                <p className="mb-3 text-xs text-gray-400">
                  Showing all instructor notes (notes are not filtered by study area)
                </p>
              )}
              {filteredCfiNotes.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-16 text-center">
                  <LightBulbIcon className="w-9 h-9 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No instructor notes yet</p>
                  <p className="text-gray-400 text-xs mt-1">Your instructor will post notes here when available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCfiNotes.map(note => (
                    <div key={note.id} className="bg-white rounded-lg shadow-sm border border-amber-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                          <LightBulbIcon className="w-4 h-4 text-amber-500 shrink-0" />
                          {note.title}
                        </h4>
                        <span className="text-xs text-gray-400 shrink-0">
                          {(note.createdAt as any)?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Questions ────────────────────────────────────────────── */}
          {activeTab === 'questions' && (
            <div>
              {/* Ask form */}
              <div className="mb-4">
                {!showAskForm ? (
                  <button
                    type="button"
                    onClick={() => { setShowAskForm(true); setAskItemId('') }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-md text-sm font-medium hover:bg-sky-600"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Ask a Question
                  </button>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3">Ask your instructor</h4>
                    <select
                      value={askItemId}
                      onChange={e => setAskItemId(e.target.value)}
                      className="w-full mb-3 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">General question (not linked to a specific topic)</option>
                      {areaItems.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <textarea
                      value={askText}
                      onChange={e => setAskText(e.target.value)}
                      placeholder="What would you like to know?"
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => { setShowAskForm(false); setAskText(''); setAskItemId('') }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitQuestion}
                        disabled={!askText.trim() || submittingQ}
                        className="px-4 py-1.5 bg-sky-500 text-white rounded-md text-sm font-medium hover:bg-sky-600 disabled:opacity-50"
                      >
                        {submittingQ ? 'Sending…' : 'Send Question'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-16 text-center">
                  <ChatBubbleLeftEllipsisIcon className="w-9 h-9 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">
                    {selectedArea ? `No questions for "${selectedArea.name}"` : 'No questions yet'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">Ask your instructor anything — they'll answer here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredQuestions
                    .sort((a, b) => ((b.createdAt as any)?.toMillis?.() ?? 0) - ((a.createdAt as any)?.toMillis?.() ?? 0))
                    .map(q => (
                    <div key={q.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {q.studyItemName && (
                            <span className="inline-block text-xs text-sky-600 font-medium bg-sky-50 px-2 py-0.5 rounded mb-1.5">
                              re: {q.studyItemName}
                            </span>
                          )}
                          <p className="text-sm text-gray-900">{q.question}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {(q.createdAt as any)?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                          ${q.status === 'answered'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'}`}>
                          {q.status === 'answered' ? '✓ Answered' : 'Pending'}
                        </span>
                      </div>
                      {q.status === 'answered' && q.answer && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setExpandedQId(expandedQId === q.id ? null : q.id)}
                            className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                          >
                            {expandedQId === q.id ? '▲ Hide answer' : '▼ View answer'}
                          </button>
                          {expandedQId === q.id && (
                            <div className="mt-2 bg-green-50 border border-green-200 rounded-md p-3">
                              <p className="text-xs font-semibold text-green-800 mb-1">Instructor's answer:</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{q.answer}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: My Notes ─────────────────────────────────────────────── */}
          {activeTab === 'notes' && (
            <div>
              {/* When area is selected: show all items in that area (prompt to take notes) */}
              {/* When no area: show only items that have existing notes */}
              {selectedArea ? (
                areaItems.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-16 text-center">
                    <BookOpenIcon className="w-9 h-9 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No study items in this area yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {areaItems.map(item => {
                      const existingNote = studentNotes.find(n => n.studyItemId === item.id)
                      const isEditing = editingItemId === item.id
                      return (
                        <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                          <div className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                              {existingNote && !isEditing && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{existingNote.content}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingItemId(null)
                                } else {
                                  startEditNote(item.id)
                                }
                              }}
                              className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 shrink-0"
                            >
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                              {isEditing ? 'Done' : existingNote ? 'Edit' : 'Add note'}
                            </button>
                          </div>
                          {isEditing && (
                            <div className="px-4 pb-4 border-t border-gray-100">
                              <textarea
                                value={noteText}
                                onChange={e => handleNoteChange(item.id, e.target.value)}
                                placeholder="Type your private notes here…"
                                rows={4}
                                className="w-full mt-3 px-3 py-2 text-sm border border-gray-200 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-sky-400"
                              />
                              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                🔒 Private — only you can see these
                                <span className="ml-auto">
                                  {noteSaveStatus === 'saving' ? 'Saving…' : noteSaveStatus === 'saved' ? 'Saved' : ''}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                /* No area selected: show only items with existing notes */
                filteredNotes.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-16 text-center">
                    <PencilSquareIcon className="w-9 h-9 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm font-medium">No notes yet</p>
                    <p className="text-gray-400 text-xs mt-1">Select a study area to start taking notes</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotes.map(n => {
                      const item = studyItems.find(i => i.id === n.studyItemId)
                      if (!item) return null
                      const area = studyAreas.find(a => a.id === item.areaId)
                      const isEditing = editingItemId === item.id
                      return (
                        <div key={n.studyItemId} className="bg-white rounded-lg shadow-sm border border-gray-200">
                          <div className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{item.name}</p>
                              {area && <p className="text-xs text-gray-400">{area.name}</p>}
                              {!isEditing && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.content}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingItemId(null)
                                } else {
                                  startEditNote(item.id)
                                }
                              }}
                              className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 shrink-0"
                            >
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                              {isEditing ? 'Done' : 'Edit'}
                            </button>
                          </div>
                          {isEditing && (
                            <div className="px-4 pb-4 border-t border-gray-100">
                              <textarea
                                value={noteText}
                                onChange={e => handleNoteChange(item.id, e.target.value)}
                                placeholder="Type your private notes here…"
                                rows={4}
                                className="w-full mt-3 px-3 py-2 text-sm border border-gray-200 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-sky-400"
                              />
                              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                🔒 Private — only you can see these
                                <span className="ml-auto">
                                  {noteSaveStatus === 'saving' ? 'Saving…' : noteSaveStatus === 'saved' ? 'Saved' : ''}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentStudy
