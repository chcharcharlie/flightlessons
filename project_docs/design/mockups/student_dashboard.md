# Student Dashboard Mockup

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  FlightLessons  │  Dashboard  Progress  Lessons  Study  │  SC  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Welcome back, Sarah                          Next Lesson: 2d   │
│  Private Pilot Training with CFI John Doe                       │
│                                                                 │
│  Your Progress Overview                                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Private Pilot Progress                          45%      │  │
│  │ ████████████████████░░░░░░░░░░░░░░░░░░░░░      [View]  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │ Flight Hours    │  │ Ground Progress │  │ Next Goal    │  │
│  │                 │  │                 │  │              │  │
│  │   23.4         │  │     67%         │  │ Solo X-Ctry  │  │
│  │ ↑ 2.3 this mo  │  │ 24/36 complete  │  │ 5 items left │  │
│  └─────────────────┘  └─────────────────┘  └──────────────┘  │
│                                                                 │
│  Upcoming Lessons                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Nov 5  │ Pattern Work                │ Pre-study:      │  │
│  │ 9:00am │ • Normal landings           │ • POH Sec 4     │  │
│  │        │ • Crosswind technique       │ • AIM 4-3-3     │  │
│  │        │                             │ [View Details]  │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Nov 8  │ Navigation Fundamentals     │ Pre-study:      │  │
│  │ 2:00pm │ • Pilotage & dead reckoning │ • PHAK Ch 16    │  │
│  │        │ • VOR navigation            │ • Sectional     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Recent Performance                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Skill Area          │ Current │ Trend │ Notes           │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Normal Landings     │    3    │  ↗    │ Improving!      │  │
│  │ Radio Comms         │    4    │  →    │ Good progress   │  │
│  │ Steep Turns        │    2    │  ↗    │ Practice more   │  │
│  │ Weather Theory     │ Learned │  ✓    │ Ready for test  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Study Resources                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ 📚 Ground   │ │ ✈️ Flight   │ │ 📋 ACS      │            │
│  │ Materials   │ │ Maneuvers   │ │ Progress    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Progress Overview Card
- **Visual**: Large progress bar with percentage
- **Details**: Click to expand ACS area breakdown
- **Colors**: Gradient from blue to green as progress increases

### Metric Cards
- **Flight Hours**: Total logged with monthly increase
- **Ground Progress**: Completed/Total items
- **Next Goal**: Current training milestone

### Upcoming Lessons
- **Timeline**: Date and time prominently displayed
- **Content Preview**: Key items to be covered
- **Pre-study**: Required materials with links
- **Actions**: View full lesson plan

### Performance Table
- **Scores**: Visual pills (1-5 for flight, status for ground)
- **Trends**: Arrow indicators (improving/steady/declining)
- **Notes**: CFI feedback or personal notes
- **Sortable**: By area, score, or trend

### Study Resources
- **Ground Materials**: PDFs, videos, references by topic
- **Flight Maneuvers**: Descriptions, standards, common errors
- **ACS Progress**: Detailed view by area and task

## Mobile Adaptation

```
┌─────────────────┐
│ ☰ FlightLessons │
├─────────────────┤
│ Hi Sarah!       │
│ 45% Complete    │
│ ████████░░░░░░  │
│                 │
│ Next: Nov 5     │
│ Pattern Work    │
│ [Pre-study]     │
│                 │
│ Recent Scores   │
│ ┌─────────────┐ │
│ │Landings: 3 ↗│ │
│ │Radio: 4 →   │ │
│ │Turns: 2 ↗   │ │
│ └─────────────┘ │
│                 │
│ Quick Links     │
│ [📚] [✈️] [📋]  │
└─────────────────┘
[Tab Bar: Home|Progress|Lessons|Study]
```

## Interactions

### Progressive Disclosure
- Progress bar expands to show area breakdown
- Lesson cards expand to show full details
- Performance items link to historical view

### Student Actions
- Mark pre-study as complete
- Add personal notes to items
- View historical progress graphs
- Download/print lesson plans

### Notifications
- Upcoming lesson reminders
- New materials added by CFI
- Progress milestones achieved