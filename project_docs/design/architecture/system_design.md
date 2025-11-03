# System Architecture

## Overview
The FlightLessons system follows a serverless architecture using Google Firebase services. This provides a fully managed, scalable solution with minimal operational overhead, perfect for a flight instruction management system.

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: Zustand for global state, React Query for Firebase data
- **UI Framework**: Tailwind CSS with HeadlessUI components
- **Routing**: React Router v6
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library
- **Hosting**: Firebase Hosting

**Rationale**: React provides excellent mobile web performance, while Firebase SDK handles real-time data sync. Zustand is lighter than Redux and works well with Firebase.

### Backend  
- **Functions**: Firebase Cloud Functions (Node.js TypeScript)
- **Authentication**: Firebase Auth
- **Validation**: Zod for request/response validation
- **Admin SDK**: Firebase Admin for privileged operations
- **Testing**: Jest with Firebase emulators

**Rationale**: Cloud Functions provide serverless compute that scales automatically. Firebase Auth handles all authentication complexity.

### Database
- **Primary**: Cloud Firestore (NoSQL)
- **Real-time**: Firestore real-time listeners
- **File Storage**: Firebase Storage for PDFs and materials
- **Offline**: Firestore offline persistence

**Rationale**: Firestore provides real-time sync, offline support, and scales automatically. Perfect for collaborative features and mobile use.

### Infrastructure
- **Hosting**: Firebase Hosting (CDN included)
- **Functions**: Cloud Functions for Firebase
- **Monitoring**: Firebase Performance & Crashlytics
- **Email**: Firebase Extensions (Trigger Email)

## Components

### 1. Web Frontend (React SPA)
**Purpose**: Responsive web interface for CFIs and students

**Responsibilities**:
- User authentication and session management
- Responsive UI adapting to mobile/desktop
- Offline capability for critical features
- Real-time updates via WebSocket

**Dependencies**: Backend API

**Implementation time**: ~45 minutes per major view

### 2. API Gateway
**Purpose**: Central entry point for all client requests

**Responsibilities**:
- Request routing and load balancing
- Authentication/authorization
- Rate limiting
- Request/response logging

**Dependencies**: Auth Service, Core Services

**Implementation time**: ~30 minutes

### 3. Authentication Service
**Purpose**: Handle user authentication and authorization

**Responsibilities**:
- User registration/login
- JWT token generation/validation
- Password reset flows
- Role-based access control (CFI/Student)

**Dependencies**: Database

**Implementation time**: ~35 minutes

### 4. CFI Management Service
**Purpose**: Manage CFI-specific operations

**Responsibilities**:
- Study item CRUD operations
- Lesson plan management
- Student enrollment
- Workspace isolation

**Dependencies**: Database, Auth Service

**Implementation time**: ~40 minutes

### 5. Student Progress Service  
**Purpose**: Track and calculate student progress

**Responsibilities**:
- Score recording and history
- Progress calculations
- ACS coverage tracking
- Trend analysis

**Dependencies**: Database, ACS Service

**Implementation time**: ~35 minutes

### 6. ACS Service
**Purpose**: Manage ACS requirements and mappings

**Responsibilities**:
- ACS data import/updates
- Item-to-ACS mapping
- Coverage calculations
- Gap analysis

**Dependencies**: Database

**Implementation time**: ~30 minutes

### 7. Lesson Service
**Purpose**: Handle lesson planning and execution

**Responsibilities**:
- Lesson template management
- Actual lesson tracking
- Scheduling
- Post-lesson reporting

**Dependencies**: Database, Progress Service

**Implementation time**: ~35 minutes

### 8. Notification Service
**Purpose**: Handle all system notifications

**Responsibilities**:
- Email notifications
- In-app notifications
- Push notifications (future)
- Notification preferences

**Dependencies**: SendGrid, Database

**Implementation time**: ~25 minutes

## Data Architecture

### Firestore Collections Structure
```typescript
// Root collections
interface User {
  uid: string; // Firebase Auth UID
  email: string;
  displayName: string;
  role: 'CFI' | 'STUDENT';
  cfiWorkspaceId?: string; // For students
  createdAt: firebase.firestore.Timestamp;
  settings: UserSettings;
}

interface CFIWorkspace {
  id: string;
  cfiUid: string;
  name: string;
  createdAt: firebase.firestore.Timestamp;
  studentCount: number;
  settings: WorkspaceSettings;
}

// Subcollections under CFIWorkspace
interface StudyArea {
  id: string;
  name: string;
  order: number;
  itemCount: number;
  createdAt: firebase.firestore.Timestamp;
}

interface StudyItem {
  id: string;
  areaId: string;
  name: string;
  type: 'GROUND' | 'FLIGHT' | 'BOTH';
  description: string;
  evaluationCriteria: string;
  acsCodeMappings: string[]; // Array of ACS codes
  referenceMaterials: ReferenceMaterial[];
  createdAt: firebase.firestore.Timestamp;
}

interface LessonTemplate {
  id: string;
  title: string;
  motivation: string;
  objectives: string[];
  itemIds: string[]; // References to study items
  preStudyMaterials: string[];
  estimatedDuration: {
    ground: number; // minutes
    flight: number; // hours
  };
  createdAt: firebase.firestore.Timestamp;
}

interface Student {
  uid: string; // Same as User uid
  enrollmentDate: firebase.firestore.Timestamp;
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
  currentCertificate: 'PRIVATE' | 'INSTRUMENT' | 'COMMERCIAL';
}

// Separate collection for progress (better query performance)
interface Progress {
  id: string;
  studentUid: string;
  cfiWorkspaceId: string;
  itemId: string;
  score: number | 'NOT_TAUGHT' | 'NEEDS_REINFORCEMENT' | 'LEARNED';
  scoreType: 'GROUND' | 'FLIGHT';
  lessonId?: string;
  notes?: string;
  createdAt: firebase.firestore.Timestamp;
  createdBy: string; // CFI uid
}

// Separate collection for lessons
interface Lesson {
  id: string;
  cfiWorkspaceId: string;
  studentUid: string;
  templateId?: string;
  scheduledDate: firebase.firestore.Timestamp;
  completedDate?: firebase.firestore.Timestamp;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  plannedRoute?: string;
  actualRoute?: string;
  weatherNotes?: string;
  aircraft?: string;
  preNotes?: string;
  postNotes?: string;
  items: LessonItem[];
  createdAt: firebase.firestore.Timestamp;
}

interface LessonItem {
  itemId: string;
  planned: boolean;
  completed: boolean;
  score?: number | string;
  notes?: string;
}

// Global ACS collection (shared across all users)
interface ACSElement {
  id: string; // e.g., "PA.I.A.K1"
  certificate: 'PA' | 'IR' | 'CA';
  area: string;
  areaNumber: string;
  task: string;
  taskLetter: string;
  elementType: 'K' | 'R' | 'S';
  elementNumber: number;
  description: string;
  aircraftClass?: string[];
}
```

### Firestore Design Principles
- Denormalize for read performance
- Use subcollections for 1-to-many relationships
- Aggregate counts in parent documents
- Optimize for common query patterns
- Use composite indexes for complex queries

## Cloud Functions Design

### Function Groups
```typescript
// Authentication triggers
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  // Create user document in Firestore
  // Set up initial workspace for CFIs
});

// CFI Operations
export const inviteStudent = functions.https.onCall(async (data, context) => {
  // Send invitation email
  // Create pending enrollment
});

export const createStudyArea = functions.https.onCall(async (data, context) => {
  // Validate CFI ownership
  // Create area with proper ordering
});

// Student Operations
export const acceptInvitation = functions.https.onCall(async (data, context) => {
  // Validate invitation token
  // Create student enrollment
});

// Progress Tracking
export const recordProgress = functions.https.onCall(async (data, context) => {
  // Validate CFI permission
  // Record score with history
  // Update aggregations
});

// Scheduled Functions
export const sendLessonReminders = functions.pubsub
  .schedule('every day 09:00')
  .onRun(async (context) => {
    // Send reminder emails for upcoming lessons
  });

// Firestore Triggers
export const onProgressCreated = functions.firestore
  .document('progress/{progressId}')
  .onCreate(async (snap, context) => {
    // Update student progress aggregations
    // Check for milestone achievements
  });
```

### Direct Firestore Access
Instead of REST endpoints, the frontend will use Firestore SDK for:
- Real-time data subscriptions
- Offline support
- Optimistic updates
- Automatic caching

Example:
```typescript
// Subscribe to student's progress
const unsubscribe = firestore
  .collection('progress')
  .where('studentUid', '==', studentUid)
  .where('cfiWorkspaceId', '==', workspaceId)
  .onSnapshot((snapshot) => {
    // Update UI with real-time changes
  });
```

## Security Architecture

### Firebase Authentication
1. User signs in with email/password
2. Firebase Auth handles token management
3. Custom claims set for role (CFI/STUDENT)
4. Automatic token refresh

### Firestore Security Rules
```javascript
// Example security rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only through Cloud Functions
    }
    
    // CFI workspace access
    match /workspaces/{workspaceId} {
      allow read: if request.auth != null && 
        (resource.data.cfiUid == request.auth.uid ||
         exists(/databases/$(database)/documents/workspaces/$(workspaceId)/students/$(request.auth.uid)));
      
      // Study items subcollection
      match /studyItems/{itemId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && 
          get(/databases/$(database)/documents/workspaces/$(workspaceId)).data.cfiUid == request.auth.uid;
      }
    }
    
    // Progress records
    match /progress/{progressId} {
      allow read: if request.auth != null && 
        (resource.data.studentUid == request.auth.uid ||
         resource.data.createdBy == request.auth.uid);
      allow create: if request.auth != null && 
        request.auth.token.role == 'CFI';
    }
  }
}
```

### Data Protection
- HTTPS enforced by Firebase
- Encryption at rest automatic
- Input validation in Cloud Functions
- Firestore rules prevent unauthorized access

## Performance Optimization

### Frontend
- Code splitting by route
- Lazy loading of components
- Image optimization and CDN delivery
- Service worker for offline capability
- Virtual scrolling for long lists

### Backend
- Database query optimization
- Redis caching for frequent queries
- Connection pooling
- Horizontal scaling ready

### Mobile Optimization
- Progressive Web App (PWA)
- Optimistic UI updates
- Minimal bundle size
- Touch-optimized interactions

## Deployment Architecture

### Development
- Firebase Local Emulator Suite
- Hot reloading with Vite
- Emulated Auth, Firestore, Functions, Storage

### Production
- Frontend: Firebase Hosting (global CDN)
- Functions: Automatic scaling
- Database: Cloud Firestore (multi-region)
- Storage: Firebase Storage with CDN

### CI/CD
```bash
# Deploy everything
firebase deploy

# Deploy specific services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## Monitoring & Observability

### Application Monitoring
- Firebase Performance Monitoring
- Firebase Crashlytics
- Firebase Analytics

### Infrastructure Monitoring
- Firebase Console dashboards
- Cloud Monitoring for Functions
- Firestore usage metrics

## Cost Optimization

### Firebase Pricing Considerations
- **Firestore**: Document reads/writes/deletes
- **Storage**: Storage size and bandwidth
- **Functions**: Invocations and compute time
- **Auth**: Monthly active users

### Optimization Strategies
- Aggregate data to reduce reads
- Use Firestore bundles for static data
- Enable offline persistence
- Implement proper caching
- Use Cloud CDN for Storage files

## Future Scalability

### Regional Expansion
- Multi-region Firestore replication
- Regional Cloud Functions deployment
- Localized content delivery

### Enterprise Features
- Custom domains per flight school
- SAML/SSO integration
- Advanced analytics
- API for third-party integrations