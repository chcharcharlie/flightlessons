import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { StudyArea, StudyItem, Question, StudentNote, CfiNote } from '@/types'
import {
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  PaperAirplaneIcon,
  BookOpenIcon,
  ChatBubbleLeftEllipsisIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

type StudyTab = 'notes' | 'questions'

export const StudentStudy: React.FC = () => {
  const { user } = useAuth()

  // Study Areas & Items
  const [studyAreas, setStudyAreas] = useState<StudyArea[]>([])
  const [studyItems, setStudyItems] = useState<Map<string, StudyItem[]>>(new Map()) // areaId -> items
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = useState<StudyItem | null>(null)

  // CFI Notes
  const [cfiNotes, setCfiNotes] = useState<CfiNote[]>([])

  // Per-item state
  const [activeTab, setActiveTab] = useState<StudyTab>('notes')
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [submittingQuestion, setSubmittingQuestion] = useState(false)

  // General question (not tied to item)
  const [generalQuestion, setGeneralQuestion] = useState('')
  const [submittingGeneral, setSubmittingGeneral] = useState(false)
  const [showGeneralQ, setShowGeneralQ] = useState(false)

  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load study areas + items
  useEffect(() => {
    if (!user?.cfiWorkspaceId) return
    const load = async () => {
      setLoading(true)
      try {
        const wsId = user.cfiWorkspaceId
        const workspaceRef = doc(db, 'workspaces', wsId)

        // studyAreas: Firestore field is "orderNumber", mapped to "order" in JS
        const areasSnap = await getDocs(
          query(collection(workspaceRef, 'studyAreas'), orderBy('orderNumber', 'asc'))
        )
        const areas = areasSnap.docs.map(d => {
          const data = d.data()
          return { id: d.id, ...data, order: data.orderNumber || 0 } as StudyArea
        })
        setStudyAreas(areas)

        // studyItems: Firestore uses "studyAreaId" and "orderNumber"; normalize to "areaId"/"order"
        const allItemsSnap = await getDocs(collection(workspaceRef, 'studyItems'))
        const allItems = allItemsSnap.docs.map(d => {
          const data = d.data()
          return { id: d.id, ...data, areaId: data.studyAreaId, order: data.orderNumber || 0 } as StudyItem
        })
        const itemsMap = new Map<string, StudyItem[]>()
        allItems.forEach(item => {
          const list = itemsMap.get(item.areaId) || []
          list.push(item)
          itemsMap.set(item.areaId, list)
        })
        itemsMap.forEach((items, areaId) => {
          itemsMap.set(areaId, items.sort((a, b) => (a.order || 0) - (b.order || 0)))
        })
        setStudyItems(itemsMap)

        // Load CFI notes: use two separate equality queries to satisfy Firestore security rules
        // (rules check targetStudentUid; combined where+orderBy would fail static rule evaluation)
        const [notesAll, notesMine] = await Promise.all([
          getDocs(query(
            collection(db, 'cfiNotes'),
            where('cfiWorkspaceId', '==', wsId),
            where('targetStudentUid', '==', 'all')
          )),
          getDocs(query(
            collection(db, 'cfiNotes'),
            where('cfiWorkspaceId', '==', wsId),
            where('targetStudentUid', '==', user.uid)
          ))
        ])
        const allCfiNotes = [
          ...notesAll.docs.map(d => ({ id: d.id, ...d.data() } as CfiNote)),
          ...notesMine.docs.map(d => ({ id: d.id, ...d.data() } as CfiNote))
        ].sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0
          const tb = b.createdAt?.toMillis?.() ?? 0
          return tb - ta
        })
        setCfiNotes(allCfiNotes)
      } catch (err) {
        console.error('StudentStudy: load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.cfiWorkspaceId])

  // Load note + questions when item changes
  useEffect(() => {
    if (!selectedItem || !user?.uid) return
    setNote('')
    setNoteSaved(true)
    setQuestions([])
    setNewQuestion('')

    const loadItem = async () => {
      // Load note
      const noteRef = doc(db, 'studentNotes', `${user.uid}_${selectedItem.id}`)
      const noteSnap = await getDoc(noteRef)
      if (noteSnap.exists()) setNote(noteSnap.data().content || '')

      // Load questions for this item
      const qSnap = await getDocs(
        query(
          collection(db, 'questions'),
          where('studentUid', '==', user.uid),
          where('studyItemId', '==', selectedItem.id),
          orderBy('createdAt', 'desc')
        )
      )
      setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question)))
    }
    loadItem()
  }, [selectedItem, user?.uid])

  // Auto-save note with debounce
  const handleNoteChange = useCallback((val: string) => {
    setNote(val)
    setNoteSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!selectedItem || !user?.uid) return
      const noteRef = doc(db, 'studentNotes', `${user.uid}_${selectedItem.id}`)
      await setDoc(noteRef, {
        studentUid: user.uid,
        studyItemId: selectedItem.id,
        content: val,
        updatedAt: Timestamp.now(),
      })
      setNoteSaved(true)
    }, 1000)
  }, [selectedItem, user?.uid])

  const submitQuestion = async (itemId: string | null) => {
    const text = itemId ? newQuestion : generalQuestion
    if (!text.trim() || !user?.uid || !user?.cfiWorkspaceId) return
    if (itemId) setSubmittingQuestion(true)
    else setSubmittingGeneral(true)
    try {
      const qData: Omit<Question, 'id'> = {
        studentUid: user.uid,
        studentName: user.displayName,
        cfiWorkspaceId: user.cfiWorkspaceId,
        question: text.trim(),
        status: 'open',
        createdAt: Timestamp.now(),
        ...(itemId && selectedItem ? { studyItemId: itemId, studyItemName: selectedItem.name } : {}),
      }
      const ref = await addDoc(collection(db, 'questions'), qData)
      const newQ: Question = { id: ref.id, ...qData }
      if (itemId) {
        setQuestions(prev => [newQ, ...prev])
        setNewQuestion('')
      } else {
        setGeneralQuestion('')
        setShowGeneralQ(false)
      }
    } finally {
      setSubmittingQuestion(false)
      setSubmittingGeneral(false)
    }
  }

  const toggleArea = (areaId: string) => {
    setExpandedAreas(prev => {
      const next = new Set(prev)
      if (next.has(areaId)) next.delete(areaId)
      else next.add(areaId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500" />
      </div>
    )
  }

  const relevantCfiNotes = cfiNotes.filter(
    n => n.targetStudentUid === 'all' || n.targetStudentUid === user?.uid
  )

  return (
    <div className="px-4 sm:px-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Study</h2>
          <p className="mt-1 text-sm text-gray-500">
            Browse study materials, take notes, and ask your instructor questions
          </p>
        </div>
        <button
          onClick={() => setShowGeneralQ(v => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-md text-sm font-medium hover:bg-sky-600"
        >
          <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
          Ask a Question
        </button>
      </div>

      {/* General Question Box */}
      {showGeneralQ && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">Ask your instructor a general question</p>
          <textarea
            rows={3}
            value={generalQuestion}
            onChange={e => setGeneralQuestion(e.target.value)}
            placeholder="What would you like to ask?"
            className="w-full rounded-md border-gray-300 text-sm focus:ring-sky-500 focus:border-sky-500"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setShowGeneralQ(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              onClick={() => submitQuestion(null)}
              disabled={!generalQuestion.trim() || submittingGeneral}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-500 text-white rounded-md text-sm font-medium disabled:opacity-50 hover:bg-sky-600"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
              {submittingGeneral ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Left: Study Areas Tree */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Study Areas</h3>
            </div>
            {studyAreas.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No study materials yet</p>
            ) : (
              <ul>
                {studyAreas.map(area => (
                  <li key={area.id} className="border-b border-gray-100 last:border-0">
                    <button
                      onClick={() => toggleArea(area.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <span className="text-sm font-medium text-gray-700">{area.name}</span>
                      {expandedAreas.has(area.id)
                        ? <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        : <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      }
                    </button>
                    {expandedAreas.has(area.id) && (
                      <ul className="bg-gray-50">
                        {(studyItems.get(area.id) || []).map(item => (
                          <li key={item.id}>
                            <button
                              onClick={() => setSelectedItem(item)}
                              className={`w-full flex items-center px-6 py-2.5 text-left text-sm hover:bg-blue-50 ${
                                selectedItem?.id === item.id
                                  ? 'bg-blue-50 text-sky-700 font-medium'
                                  : 'text-gray-600'
                              }`}
                            >
                              <BookOpenIcon className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                              {item.name}
                            </button>
                          </li>
                        ))}
                        {(studyItems.get(area.id) || []).length === 0 && (
                          <li className="px-6 py-2 text-xs text-gray-400">No items</li>
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* CFI Notes list in sidebar */}
          {relevantCfiNotes.length > 0 && (
            <div className="mt-4 bg-white rounded-lg shadow-sm border border-amber-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                  <LightBulbIcon className="w-3.5 h-3.5" />
                  Notes from Instructor
                </h3>
              </div>
              <ul>
                {relevantCfiNotes.map(n => (
                  <li key={n.id} className="border-b border-amber-100 last:border-0 px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">{n.title}</p>
                    <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{n.content}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {n.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Item Detail */}
        <div className="flex-1 min-w-0">
          {!selectedItem ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center py-20 text-center">
              <BookOpenIcon className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Select a study item</p>
              <p className="text-sm text-gray-400 mt-1">Choose from the left to view, take notes, or ask questions</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Item header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{selectedItem.name}</h3>
                <div className="mt-1 flex items-center gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    selectedItem.type === 'GROUND' ? 'bg-blue-100 text-blue-700'
                    : selectedItem.type === 'FLIGHT' ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                  }`}>
                    {selectedItem.type}
                  </span>
                  {selectedItem.description && (
                    <p className="text-sm text-gray-500 truncate">{selectedItem.description}</p>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 px-6">
                <nav className="-mb-px flex space-x-6">
                  {(['notes', 'questions'] as StudyTab[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-3 border-b-2 text-sm font-medium capitalize ${
                        activeTab === tab
                          ? 'border-sky-500 text-sky-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab === 'notes' ? 'My Notes' : 'Questions'}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab content */}
              <div className="px-6 py-5">
                {activeTab === 'notes' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">Private notes — only you can see these</p>
                      <span className={`text-xs ${noteSaved ? 'text-gray-400' : 'text-amber-500'}`}>
                        {noteSaved ? 'Saved' : 'Saving…'}
                      </span>
                    </div>
                    <textarea
                      rows={10}
                      value={note}
                      onChange={e => handleNoteChange(e.target.value)}
                      placeholder="Type your notes here…"
                      className="w-full rounded-md border-gray-300 text-sm focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                )}

                {activeTab === 'questions' && (
                  <div>
                    {/* New question input */}
                    <div className="mb-5">
                      <textarea
                        rows={3}
                        value={newQuestion}
                        onChange={e => setNewQuestion(e.target.value)}
                        placeholder={`Ask about "${selectedItem.name}"…`}
                        className="w-full rounded-md border-gray-300 text-sm focus:ring-sky-500 focus:border-sky-500"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => submitQuestion(selectedItem.id)}
                          disabled={!newQuestion.trim() || submittingQuestion}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 text-white rounded-md text-sm font-medium disabled:opacity-50 hover:bg-sky-600"
                        >
                          <PaperAirplaneIcon className="w-4 h-4" />
                          {submittingQuestion ? 'Sending…' : 'Ask Instructor'}
                        </button>
                      </div>
                    </div>

                    {/* Questions list */}
                    {questions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No questions yet for this item</p>
                    ) : (
                      <ul className="space-y-4">
                        {questions.map(q => (
                          <li key={q.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-gray-800 font-medium">{q.question}</p>
                              <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                q.status === 'answered'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {q.status === 'answered' && <CheckCircleIcon className="w-3 h-3" />}
                                {q.status === 'answered' ? 'Answered' : 'Pending'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              {q.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                            {q.answer && (
                              <div className="mt-3 bg-green-50 border border-green-200 rounded p-3">
                                <p className="text-xs font-semibold text-green-700 mb-1">Instructor's Answer</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.answer}</p>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
