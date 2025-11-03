# System Architecture

## Overview
The FlightLessons system follows a modern three-tier architecture with a React-based frontend, Node.js/Express backend API, and PostgreSQL database. The system is designed for scalability, maintainability, and optimal performance on mobile devices.

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit for global state, React Query for server state
- **UI Framework**: Tailwind CSS with HeadlessUI components
- **Routing**: React Router v6
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library

**Rationale**: React provides excellent mobile web performance with its virtual DOM, while TypeScript ensures type safety across the large codebase. Tailwind enables rapid, consistent styling.

### Backend  
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js with TypeScript
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod for request/response validation
- **ORM**: Prisma for type-safe database access
- **Testing**: Jest + Supertest

**Rationale**: Node.js allows JavaScript across the stack, Express is battle-tested, and Prisma provides excellent TypeScript integration with PostgreSQL.

### Database
- **Primary**: PostgreSQL 15
- **Caching**: Redis for sessions and frequently accessed data
- **File Storage**: AWS S3 for PDFs and materials

**Rationale**: PostgreSQL handles complex relational data well, supports JSON for flexible fields, and scales reliably.

### Infrastructure
- **Hosting**: AWS (EC2 + RDS + S3)
- **CDN**: CloudFront for static assets
- **Monitoring**: DataDog
- **Email**: SendGrid

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

### Core Entities
```typescript
// Simplified schema
interface User {
  id: string;
  email: string;
  name: string;
  role: 'CFI' | 'STUDENT';
  createdAt: Date;
}

interface StudyArea {
  id: string;
  cfiId: string;
  name: string;
  order: number;
}

interface StudyItem {
  id: string;
  areaId: string;
  name: string;
  type: 'GROUND' | 'FLIGHT' | 'BOTH';
  description: string;
  evaluationCriteria: string;
  acsMapping: ACSMapping[];
}

interface StudentProgress {
  id: string;
  studentId: string;
  itemId: string;
  score: number | GroundStatus;
  lessonId?: string;
  notes: string;
  createdAt: Date;
}

interface Lesson {
  id: string;
  templateId?: string;
  studentId: string;
  cfiId: string;
  scheduledDate: Date;
  completedDate?: Date;
  items: LessonItem[];
}
```

### Database Design Principles
- Normalize to 3NF for consistency
- Use JSON columns for flexible fields
- Index foreign keys and frequently queried fields
- Implement soft deletes for audit trail

## API Design

### RESTful Endpoints
```
Authentication:
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

CFI Operations:
GET    /api/cfi/students
POST   /api/cfi/students/invite
GET    /api/cfi/study-areas
POST   /api/cfi/study-areas
PUT    /api/cfi/study-areas/:id
DELETE /api/cfi/study-areas/:id

Student Operations:  
GET    /api/student/dashboard
GET    /api/student/progress
GET    /api/student/lessons
GET    /api/student/study-items

Lessons:
GET    /api/lessons/templates
POST   /api/lessons/templates
GET    /api/lessons/actual
POST   /api/lessons/actual
PUT    /api/lessons/actual/:id/complete

Progress:
POST   /api/progress/score
GET    /api/progress/history/:itemId
GET    /api/progress/analytics

ACS:
GET    /api/acs/certificates
GET    /api/acs/search
POST   /api/acs/map-item
GET    /api/acs/coverage/:studentId
```

### WebSocket Events
```
// Real-time updates
socket.on('progress:updated', (data) => {})
socket.on('lesson:scheduled', (data) => {})
socket.on('material:added', (data) => {})
```

## Security Architecture

### Authentication Flow
1. User submits credentials
2. Server validates and generates JWT + refresh token
3. JWT stored in httpOnly cookie
4. Refresh token used to generate new JWT when expired

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- CFI workspace isolation
- API rate limiting per user

### Data Protection
- All traffic over HTTPS
- Encryption at rest for sensitive data
- Input validation and sanitization
- SQL injection prevention via parameterized queries

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
- Local Docker Compose setup
- Hot reloading for frontend/backend
- Seeded test data

### Production
- Frontend: S3 + CloudFront
- Backend: EC2 with load balancer
- Database: RDS PostgreSQL
- Auto-scaling groups

## Monitoring & Observability

### Application Monitoring
- DataDog APM for performance
- Sentry for error tracking
- Custom CloudWatch metrics

### Infrastructure Monitoring
- AWS CloudWatch for resources
- Uptime monitoring
- Database performance insights

## Future Scalability

### Microservices Migration Path
- Services already loosely coupled
- Can extract to separate deployments
- Message queue ready (SQS/RabbitMQ)

### Multi-tenancy Enhancements
- Partition by CFI workspace
- Separate database schemas
- Custom domains per flight school