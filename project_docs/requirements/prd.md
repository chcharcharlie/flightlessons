# Product Requirements Document

## 1. Product Overview

### Vision
Create the most comprehensive and user-friendly flight instruction management system that empowers CFIs to deliver structured, trackable, and ACS-aligned flight training while providing students with clear visibility into their progress toward certification.

### Scope (MVP)
- Multi-tenant system with isolated CFI workspaces
- Support for Private Pilot, Instrument Rating, and Commercial Pilot training
- Complete ACS mapping and coverage tracking
- Lesson planning and execution tools
- Student progress tracking with historical data
- Mobile-responsive web interface

### Future Phases
- Phase 2: CFI-to-CFI lesson plan sharing marketplace
- Phase 3: Advanced flight planning integration (weather, NOTAMs)
- Phase 4: Electronic logbook integration
- Phase 5: Additional ratings (CFI, ATP, Multi-engine)

## 2. User Personas & Journeys

### Primary Persona: Certified Flight Instructor (CFI)
**Demographics**
- Age: 25-65
- Experience: 500-10,000+ flight hours
- Students: Managing 5-20 active students
- Tech comfort: Moderate to high

**Goals**
- Organize lesson plans efficiently
- Track multiple students' progress simultaneously
- Ensure complete ACS coverage for each student
- Reduce administrative time
- Provide professional instruction

**Journey**
1. Signs up and creates CFI workspace
2. Imports or creates study areas and items
3. Maps items to ACS requirements
4. Creates template lesson plans
5. Enrolls students
6. Conducts lessons and tracks progress
7. Reviews student progress and adjusts training
8. Prepares students for checkrides

### Secondary Persona: Flight Student
**Demographics**
- Age: 18-60
- Background: Diverse (career change, hobby, professional pilot track)
- Time commitment: Part-time to full-time training
- Tech comfort: Moderate to high

**Goals**
- Clear understanding of progress toward certificate
- Access to study materials and lesson plans
- Preparation for lessons
- Track weak areas needing improvement
- Pass checkride efficiently

**Journey**
1. Receives invitation from CFI
2. Creates account and views dashboard
3. Reviews upcoming lesson plans and pre-study materials
4. Completes ground and flight training
5. Reviews post-lesson feedback and scores
6. Studies weak areas identified by system
7. Tracks progress toward ACS completion
8. Achieves certification

## 3. Feature Specifications

### 3.1 Study Item Management

**Description**: Core content management system for organizing training materials

**User Stories**
- As a CFI, I want to create hierarchical study areas and items so I can organize my curriculum
- As a CFI, I want to categorize items as ground, flight, or both so I can plan appropriate lessons
- As a CFI, I want to map items to specific ACS codes so I ensure complete coverage

**Acceptance Criteria**
- CFI can create/edit/delete study areas (top-level categories)
- CFI can create/edit/delete study items within areas
- Each item must have: name, description, type (ground/flight/both), evaluation criteria
- Items can be mapped to multiple ACS codes using searchable interface
- Items can have attached reference materials (PDFs, links, notes)
- System validates ACS code format (e.g., PA.I.A.K1)

**UI/UX Requirements**
- Tree view for area/item hierarchy
- Drag-and-drop reordering
- Bulk import/export capabilities
- Search and filter by name, type, or ACS code
- Visual indicators for items without ACS mapping

**Business Logic**
- Items inherit CFI workspace isolation
- Deleting area prompts to reassign child items
- ACS mappings validate against master ACS database
- Track creation and modification timestamps

**Data Model**
```
StudyArea
- id, cfi_id, name, description, order, created_at, updated_at

StudyItem  
- id, area_id, cfi_id, name, description, type (enum), 
- evaluation_criteria, reference_materials (json), 
- created_at, updated_at

ItemACSMapping
- item_id, acs_code, created_at
```

**Error Handling**
- Prevent duplicate area/item names within CFI workspace
- Validate ACS codes against master list
- Handle orphaned items when area deleted

### 3.2 Progress Tracking System

**Description**: Comprehensive tracking of student performance on each study item

**User Stories**
- As a CFI, I want to score ground items on 3 levels so I can track knowledge retention
- As a CFI, I want to score flight items on a 1-5 scale so I can track skill progression
- As a student, I want to see my progress history so I understand my improvement

**Acceptance Criteria**
- Ground items: Not Taught → Needs Reinforcement → Learned
- Flight items: 1 (Introduction) to 5 (Mastery) scale
- Historical tracking with timestamps for all score changes
- Progress rollup to area and ACS task levels
- Visual progress indicators (charts, progress bars)

**UI/UX Requirements**
- Quick scoring interface during lessons
- Color-coded progress indicators
- Historical timeline view per item
- Progress dashboard with filters
- Trend analysis graphs

**Business Logic**
- Latest score is "current" but history retained
- Calculate area progress as average of items
- Calculate ACS task completion based on all mapped items
- Regression alerts when scores decrease

**Data Model**
```
StudentProgress
- id, student_id, item_id, score, score_type (ground/flight),
- scored_by_cfi_id, lesson_id, notes, created_at

ProgressHistory
- All historical entries preserved for trend analysis
```

**Error Handling**
- Validate score values based on item type
- Prevent scoring items not yet taught
- Handle concurrent scoring updates

### 3.3 Lesson Planning & Execution

**Description**: Tools for creating reusable lesson plans and tracking actual lessons

**User Stories**
- As a CFI, I want to create template lesson plans so I can reuse common lessons
- As a CFI, I want to track what actually happened in each lesson
- As a student, I want to see upcoming lessons so I can prepare

**Acceptance Criteria**
- Create lesson plan templates with ground and flight items
- Generate actual lessons from templates or custom
- Include: title, motivation, objectives, items, pre-study, homework
- Post-lesson: add scores, comments, actual vs planned items
- Basic flight route planning (departure, route, destination)

**UI/UX Requirements**
- Template library with search/filter
- Drag-drop items into lessons
- Side-by-side planned vs actual view
- Quick scoring interface post-lesson
- Calendar view of scheduled lessons

**Business Logic**
- Templates remain unchanged when used
- Actual lessons link to student and date
- Auto-populate items from template
- Calculate lesson completion metrics

**Data Model**
```
LessonPlan (Template)
- id, cfi_id, title, motivation, objectives, 
- pre_study, homework, created_at, updated_at

LessonPlanItem
- lesson_plan_id, item_id, order, notes

ActualLesson
- id, lesson_plan_id, student_id, cfi_id, 
- scheduled_date, completed_date, 
- planned_route, actual_route, 
- weather, aircraft, 
- pre_lesson_notes, post_lesson_notes,
- created_at, updated_at

ActualLessonItem
- lesson_id, item_id, planned, completed, score, notes
```

**Error Handling**
- Prevent scheduling conflicts
- Validate item associations
- Handle partial lesson completion

### 3.4 ACS Coverage Analysis

**Description**: Ensure complete coverage of ACS requirements across curriculum

**User Stories**
- As a CFI, I want to see which ACS elements lack mapped items
- As a CFI, I want to track each student's ACS completion progress
- As a student, I want to see my progress toward ACS requirements

**Acceptance Criteria**
- Import and maintain complete ACS database (PA, IR, CA)
- Gap analysis showing unmapped ACS elements
- Student-specific ACS completion tracking
- Visual coverage maps by area and task
- Completion certificates when all elements covered

**UI/UX Requirements**
- Hierarchical ACS browser (Certificate → Area → Task → Element)
- Coverage heatmap visualization
- Filtering by completion status
- Progress bars at each level
- Printable completion reports

**Business Logic**
- Element marked complete when all mapped items scored satisfactory
- Task complete when all K, R, S elements complete
- Area complete when all tasks complete
- Certificate ready when all areas complete

**Data Model**
```
ACSCertificate
- id, code (PA/IR/CA), name, version

ACSArea
- id, certificate_id, number (I-XIII), name

ACSTask  
- id, area_id, letter, name

ACSElement
- id, task_id, type (K/R/S), number, description, 
- aircraft_class

StudentACSProgress
- student_id, acs_element_id, completed, 
- completed_date, updated_at
```

**Error Handling**
- Handle ACS updates/versions
- Validate completion logic
- Prevent invalid progress marking

### 3.5 Student Management

**Description**: Student account creation, enrollment, and access management

**User Stories**
- As a CFI, I want to invite students to create accounts
- As a student, I want my own login to access my progress
- As a CFI, I want to manage student access and status

**Acceptance Criteria**
- CFI sends email invitations to students
- Students create accounts with secure authentication
- Students only see their CFI's content
- CFI can activate/deactivate students
- Student dashboard shows personal progress

**UI/UX Requirements**
- Simple invitation flow
- Clean student dashboard
- Mobile-optimized student views
- Notification preferences
- Profile management

**Business Logic**
- One student can only have one active CFI
- Students see read-only content
- CFI owns all content and progress data
- Data retention after student deactivation

**Data Model**
```
User
- id, email, name, role (cfi/student), 
- password_hash, created_at, last_login

CFIWorkspace  
- id, user_id, workspace_name, settings (json),
- created_at

StudentEnrollment
- id, student_user_id, cfi_user_id, 
- status, enrolled_date, completed_date
```

**Error Handling**
- Duplicate email prevention
- Invalid invitation links
- Access control violations

## 4. System Architecture

### Components
1. **Web Frontend**: React-based SPA with responsive design
2. **API Backend**: RESTful API with authentication
3. **Database**: PostgreSQL for relational data
4. **File Storage**: Cloud storage for PDFs/materials
5. **Email Service**: Transactional emails for invitations

### Data Flow
1. CFI creates content → Database storage
2. Student accesses → API validates → Returns filtered data
3. Progress updates → Historical tracking → Analytics calculation
4. ACS mapping → Coverage calculation → Progress visualization

### Integrations
- Email service for invitations
- PDF viewer for reference materials
- Future: Flight planning APIs
- Future: Electronic logbook APIs

## 5. Non-Functional Requirements

### Performance
- Page load under 2 seconds on 4G mobile
- API response under 500ms
- Support 100 concurrent users per CFI
- Offline capability for critical features

### Security
- SSL/TLS encryption
- Secure password requirements
- Session management with timeout
- Data isolation between CFI workspaces
- FERPA compliance considerations

### Scalability
- Support 1,000+ CFIs
- 20,000+ total students
- Horizontal scaling capability
- CDN for static assets

## 6. Edge Cases & Error States

### Data Integrity
- Student switches CFIs mid-training
- CFI account deactivation with active students
- Conflicting ACS updates from FAA
- Orphaned data from deletions

### User Errors
- Accidental score changes
- Duplicate lesson entries
- Invalid ACS mappings
- Network failures during updates

### System Errors
- Payment failures
- Email delivery failures
- Database connection issues
- File upload failures

## 7. Success Metrics

### Usage Metrics
- Daily active CFIs
- Weekly active students  
- Lessons completed per month
- Average items per lesson

### Quality Metrics
- Student progress velocity
- ACS coverage percentage
- Time to certification
- User satisfaction scores

### Business Metrics
- CFI retention rate
- Student completion rate
- Feature adoption rates
- Support ticket volume