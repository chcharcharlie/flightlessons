import { Timestamp } from 'firebase/firestore'

export type UserRole = 'CFI' | 'STUDENT'

export interface User {
  uid: string
  email: string
  displayName: string
  role: UserRole
  cfiWorkspaceId?: string // For students
  createdAt: Timestamp
  settings?: UserSettings
}

export interface UserSettings {
  notifications: {
    email: boolean
    lessonReminders: boolean
  }
}

export interface CFIWorkspace {
  id: string
  cfiUid: string
  name: string
  createdAt: Timestamp
  studentCount: number
  settings?: WorkspaceSettings
}

export interface WorkspaceSettings {
  defaultLessonDuration: {
    ground: number // minutes
    flight: number // hours
  }
}

export interface StudyArea {
  id: string
  name: string
  certificate: Certificate
  order: number
  itemCount: number
  createdAt: Timestamp
}

export type StudyItemType = 'GROUND' | 'FLIGHT' | 'BOTH'

export interface StudyItem {
  id: string
  areaId: string
  name: string
  type: StudyItemType
  description: string
  evaluationCriteria: string
  acsCodeMappings: string[]
  referenceMaterials: ReferenceMaterial[]
  createdAt: Timestamp
}

export interface ReferenceMaterial {
  type: 'link' | 'file'
  name: string
  url: string
}

export interface LessonTemplate {
  id: string
  title: string
  motivation: string
  objectives: string[]
  itemIds: string[]
  preStudyMaterials: string[]
  estimatedDuration: {
    ground: number // minutes
    flight: number // hours
  }
  createdAt: Timestamp
}

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'COMPLETED'
export type Certificate = 'PRIVATE' | 'INSTRUMENT' | 'COMMERCIAL'

export interface Student {
  uid: string
  enrollmentDate: Timestamp
  status: StudentStatus
}

export type TrainingProgramStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED'

export interface TrainingProgram {
  id: string
  cfiWorkspaceId: string
  studentUid: string
  certificate: Certificate
  status: TrainingProgramStatus
  startDate: Timestamp
  completedDate?: Timestamp
  notes?: string
  createdAt: Timestamp
  createdBy: string
}

export type GroundScore = 'NOT_TAUGHT' | 'NEEDS_REINFORCEMENT' | 'LEARNED'
export type FlightScore = 1 | 2 | 3 | 4 | 5

export interface Progress {
  id: string
  studentUid: string
  cfiWorkspaceId: string
  itemId: string
  score: FlightScore | GroundScore
  scoreType: 'GROUND' | 'FLIGHT'
  lessonId?: string
  notes?: string
  createdAt: Timestamp
  createdBy: string
}

export type LessonStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

export interface Lesson {
  id: string
  cfiWorkspaceId: string
  studentUid: string
  templateId?: string
  scheduledDate: Timestamp
  completedDate?: Timestamp
  status: LessonStatus
  plannedRoute?: string
  actualRoute?: string
  weatherNotes?: string
  aircraft?: string
  preNotes?: string
  postNotes?: string
  items: LessonItem[]
  createdAt: Timestamp
}

export interface LessonItem {
  itemId: string
  planned: boolean
  completed: boolean
  score?: FlightScore | GroundScore
  notes?: string
}

export interface ACSElement {
  id: string // e.g., "PA.I.A.K1"
  certificate: 'PA' | 'IR' | 'CA'
  area: string
  areaNumber: string
  task: string
  taskLetter: string
  elementType: 'K' | 'R' | 'S'
  elementNumber: number
  description: string
  aircraftClass?: string[]
}