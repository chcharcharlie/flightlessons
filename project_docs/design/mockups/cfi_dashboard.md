# CFI Dashboard Mockup

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  FlightLessons  │  Students  Study Items  Lessons  ACS  │  JD  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Welcome back, John Doe                          Today: Nov 3   │
│  You have 3 lessons scheduled today                             │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ Active Students     │  │ This Week          │             │
│  │                     │  │                     │             │
│  │    12               │  │  15 Lessons        │             │
│  │  ↑ 2 from last mo   │  │  8 Students        │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ ACS Coverage        │  │ Avg Progress       │             │
│  │                     │  │                     │             │
│  │    87%              │  │  Ground: 72%       │             │
│  │  13 items missing   │  │  Flight: 64%       │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                 │
│  Today's Schedule                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 9:00 AM   │ Sarah Chen      │ Lesson 5: Pattern Work    │  │
│  │           │ PA Progress: 45% │ KPAO - Local              │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ 1:00 PM   │ Mike Johnson    │ Lesson 12: Cross Country  │  │
│  │           │ PA Progress: 78% │ KPAO → KHAF → KPAO       │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ 4:00 PM   │ Emma Davis      │ Ground: Airspace          │  │
│  │           │ IR Progress: 23% │ Classroom                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Recent Student Progress                                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Student        │ Last Lesson │ Key Items    │ Trend      │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Sarah Chen     │ Oct 31     │ Landings: 3  │ ↗ Improving│  │
│  │                │            │ Radio: 4     │            │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Mike Johnson   │ Oct 30     │ Nav: 5       │ → Steady   │  │
│  │                │            │ Weather: 3   │            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Quick Actions                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                │
│  │ + Student  │ │ + Lesson   │ │ View ACS   │                │
│  └────────────┘ └────────────┘ └────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Navigation Bar
- **Logo**: FlightLessons with airplane icon
- **Main Nav**: Students | Study Items | Lessons | ACS Coverage
- **User Menu**: Profile picture with dropdown

### Metric Cards
- **Layout**: 2×2 grid on desktop, stack on mobile
- **Content**: Large number, subtitle, trend indicator
- **Colors**: Use success/warning colors for trends

### Today's Schedule
- **Time**: Bold, left-aligned
- **Student Card**: Name, certificate progress, profile pic
- **Lesson Info**: Title and location/type
- **Actions**: Click to view/edit lesson

### Recent Progress Table
- **Sortable**: By name, date, trend
- **Expandable**: Click to see full progress details
- **Visual**: Score pills for item scores

### Quick Actions
- **Primary**: Create new student (blue)
- **Secondary**: Schedule lesson, View ACS gaps

## Mobile Adaptation

```
┌─────────────────┐
│ ☰ FlightLessons │
├─────────────────┤
│ Welcome, John   │
│ 3 lessons today │
│                 │
│ ┌─────────────┐ │
│ │ Students: 12│ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ Lessons: 15 │ │
│ └─────────────┘ │
│                 │
│ Today           │
│ ┌─────────────┐ │
│ │9:00 Sarah C.│ │
│ │Pattern Work │ │
│ └─────────────┘ │
│                 │
│ [+ New Lesson]  │
└─────────────────┘
[Tab Bar: Home|Students|Lessons|More]
```

## Interactions

### Hover States
- Cards: Slight shadow elevation
- Table rows: Light gray background
- Buttons: Darken by 10%

### Click Actions
- Student name → Student detail page
- Lesson card → Lesson detail/scoring page
- Metric cards → Filtered list view

### Data Refresh
- Pull-to-refresh on mobile
- Auto-refresh every 5 minutes
- Loading states for async data