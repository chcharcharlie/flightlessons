# Flight Lessons Project Context

## Project Overview

This is a flight instruction management system built for CFIs (Certified Flight Instructors) and their students to track ground and flight training progress. The system is built with React, TypeScript, Vite, and Firebase.

## Key Architectural Decisions

### Technology Stack
- **Frontend**: React 18 with TypeScript, Vite, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Cloud Functions v2, Storage, Hosting)
- **Database**: Firestore with NoSQL document structure
- **Authentication**: Firebase Auth with role-based access (CFI vs Student)

### Data Architecture
- **Workspace-based isolation**: Each CFI has their own workspace
- **Certificate-based organization**: Content organized by PPL, IR, CPL
- **Training Programs**: CFIs initiate specific rating training for students
- **Lesson Plans**: Certificate-based templates that apply to all students

## Current Implementation Status

### ✅ Completed Features

1. **Authentication & User Management**
   - Firebase Auth integration
   - Role-based access (CFI/Student)
   - Student invitation system via shareable links
   - Cloud Function for student enrollment

2. **Study Items Management**
   - Study areas organized by certificate
   - Study items with ground/flight/both types
   - Progress tracking (Ground: Not Taught/Needs Reinforcement/Learned, Flight: 1-5 scale)

3. **Training Programs**
   - CFIs create programs for specific certificates
   - Program-specific progress tracking
   - Students only see enrolled programs
   - Ability to pause, complete, and reactivate programs

4. **Lesson Planning System**
   - Certificate-based lesson plan templates
   - Structured lessons with:
     - Title, motivation, objectives
     - Study items selection (ground/flight separation)
     - Plan description, reference materials, pre-study homework
     - Estimated duration
   - Two-column UI for easy item selection

5. **Lesson Scheduling**
   - CFIs schedule lessons with students
   - Can use lesson plan templates or create custom lessons
   - Students view their scheduled lessons
   - Detailed lesson view for both CFI and student

### 🚧 Pending Features

1. **ACS Mapping** - To be integrated into study items section
2. **Progress Analytics** - Detailed reporting and charts
3. **File Uploads** - Reference materials and documents
4. **Notifications** - Email/in-app notifications for lessons

## Important Implementation Details

### Firestore Security Rules
- Workspace-based data isolation
- Students can only access their CFI's workspace
- Lesson plans are certificate-based, accessible by all students in workspace

### Key Data Models

```typescript
// Training Program - Links student to certificate
interface TrainingProgram {
  id: string
  studentUid: string
  cfiWorkspaceId: string
  certificate: Certificate // 'PRIVATE' | 'INSTRUMENT' | 'COMMERCIAL'
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  createdAt: Timestamp
}

// Lesson Plan - Certificate-based template
interface LessonPlan {
  id: string
  certificate: Certificate
  cfiWorkspaceId: string
  orderNumber: number
  title: string
  motivation: string
  objectives: string[]
  itemIds: string[]
  planDescription: string
  referenceMaterials: ReferenceMaterial[]
  preStudyHomework: string
  estimatedDuration: { ground: number; flight: number }
}
```

### Recent Architectural Changes
1. **Certificate-based Lesson Plans**: Changed from program-specific to certificate-specific templates
2. **Removed ACS Coverage Page**: Will be integrated into study items section
3. **Program-based Navigation**: All student views are organized by training program

## Context Gathering for New Conversations

When starting a new conversation about this project, provide:

1. **This context document** (`PROJECT_CONTEXT.md`)
2. **The project instructions** (`CLAUDE.md`)
3. **Key files to review**:
   - `/src/types/index.ts` - All TypeScript interfaces
   - `/firestore.rules` - Security rules
   - `/src/pages/cfi/Dashboard.tsx` - CFI navigation structure
   - `/src/pages/student/Dashboard.tsx` - Student navigation structure

4. **Current working directory**: `/Users/charlie/repos/FlightLessons/implementation`

5. **Recent work focus**: Certificate-based lesson plan system with two-column study items selection UI

6. **User preferences**:
   - Avoid debug logs unless troubleshooting
   - Prefer clean, minimal UI without excessive styling
   - Certificate-based organization is critical
   - Each student works on specific programs, not all certificates

7. **Known issues**:
   - Firestore indexes may need time to build after deployment
   - Some queries require composite indexes

## Git Information
- Repository: Local development
- Branch: main
- Firebase Project: flightlessons-8b9bd

## Next Steps
The immediate next features to implement would be:
1. ACS mapping integration within study items
2. Enhanced progress analytics
3. File upload capabilities for reference materials