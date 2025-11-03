# Study Item Management Interface Mockup

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  FlightLessons  │  Students  Study Items  Lessons  ACS  │  JD  │
├─────────────────────────────────────────────────────────────────┤
│  Study Items                                     [+ New Area]   │
│                                                                 │
│  Search: [_____________________] Type: [All ▼] [🔍]           │
│                                                                 │
│  ┌───────────────────────┬───────────────────────────────────┐ │
│  │ Study Areas          │ Items in "Preflight Procedures"    │ │
│  │                      │                                     │ │
│  │ ▼ Preflight (12)     │ [+ Add Item] [Import] [Export]    │ │
│  │   • Certificates     │                                     │ │
│  │   • Weather          │ ┌─────────────────────────────────┐ │
│  │   • Weight & Balance │ │ ✈️ Preflight Inspection        │ │
│  │   • Performance      │ │ Type: Both | ACS: PA.II.B      │ │
│  │                      │ │                                 │ │
│  │ ▶ Flight Maneuvers   │ │ Systematic inspection of       │ │
│  │ ▶ Navigation         │ │ aircraft exterior & interior    │ │
│  │ ▶ Emergency Ops      │ │                                 │ │
│  │ ▼ Regulations (8)    │ │ [Edit] [Delete] [Clone]        │ │
│  │   • Part 61          │ └─────────────────────────────────┘ │
│  │   • Part 91          │                                     │ │
│  │                      │ ┌─────────────────────────────────┐ │
│  │ [+ New Area]         │ │ 📚 Weather Briefing            │ │
│  │                      │ │ Type: Ground | ACS: PA.I.C     │ │
│  └───────────────────────┤ │                                 │ │
│                          │ │ Obtaining and interpreting     │ │
│                          │ │ weather reports and forecasts   │ │
│                          │ │                                 │ │
│                          │ │ Ref: AC 00-6B, AIM Ch 7       │ │
│                          │ │ [Edit] [Delete] [Clone]        │ │
│                          │ └─────────────────────────────────┘ │
│                          │                                     │ │
│                          │ ┌─────────────────────────────────┐ │
│                          │ │ 📋 Weight and Balance Calc     │ │
│                          │ │ Type: Ground | ACS: PA.I.F     │ │
│                          │ │                                 │ │
│                          │ │ Computing weight and balance   │ │
│                          │ │ determining CG location         │ │
│                          │ │                                 │ │
│                          │ │ ⚠️ No evaluation criteria set  │ │
│                          │ └─────────────────────────────────┘ │
└───────────────────────┴───────────────────────────────────┘
```

## Edit Item Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Edit Study Item                                        [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Name *                                                      │
│ [Preflight Inspection_____________________________________] │
│                                                             │
│ Type *                                                      │
│ ( ) Ground  ( ) Flight  (•) Both                           │
│                                                             │
│ Description                                                 │
│ [Systematic inspection of aircraft exterior & interior    ] │
│ [including required documents, control movement, and      ] │
│ [fuel/oil quantities_____________________________________] │
│                                                             │
│ Evaluation Criteria                                         │
│ [Student can complete preflight inspection within 15 min  ] │
│ [identifying all required items per POH checklist________] │
│                                                             │
│ ACS Mappings                              [+ Add Mapping]   │
│ ┌─────────────────────────────────────────────[Remove]─┐  │
│ │ PA.II.B - Preflight Assessment                       │  │
│ └───────────────────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────────[Remove]─┐  │
│ │ CA.II.B - Preflight Assessment                       │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ Reference Materials                                         │
│ [POH Section 4_____________] [Attach PDF]                  │
│ [https://... _______________] [+ Add Link]                 │
│                                                             │
│ Notes for CFI                                              │
│ [Emphasize fuel sumping and control continuity checks____] │
│                                                             │
│ [Cancel]                                    [Save Changes]  │
└─────────────────────────────────────────────────────────────┘
```

## ACS Mapping Selector

```
┌─────────────────────────────────────────────────────────────┐
│ Select ACS Elements                                   [X]  │
├─────────────────────────────────────────────────────────────┤
│ Certificate: [Private Pilot ▼]                             │
│                                                             │
│ ▼ I. Preflight Preparation                                 │
│   ▼ A. Pilot Qualifications                               │
│     [ ] PA.I.A.K1 - Certification requirements            │
│     [ ] PA.I.A.K2 - Privileges and limitations            │
│     [✓] PA.I.A.R1 - Proficiency vs currency              │
│   ▶ B. Airworthiness Requirements                         │
│   ▶ C. Weather Information                                │
│                                                             │
│ ▼ II. Preflight Procedures                                 │
│   ▶ A. Preflight Assessment                               │
│   ▼ B. Flight Deck Management                             │
│     [✓] PA.II.B.K1 - Preflight inspection                │
│     [✓] PA.II.B.S1 - Preflight inspection completion     │
│                                                             │
│ Search: [inspection________] [Filter: Knowledge ▼]         │
│                                                             │
│ Selected: 3 elements                    [Cancel] [Add]     │
└─────────────────────────────────────────────────────────────┘
```

## Mobile Adaptation

```
┌─────────────────┐
│ ☰ Study Items   │
├─────────────────┤
│ [Search____][🔍]│
│                 │
│ ▼ Preflight (12)│
│ ▶ Maneuvers (8) │
│ ▶ Navigation(10)│
│ [+ New Area]    │
│                 │
│ Items:          │
│ ┌─────────────┐ │
│ │✈️ Preflight  │ │
│ │PA.II.B      │ │
│ │[Edit] [...]│ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │📚 Weather   │ │
│ │PA.I.C       │ │
│ │[Edit] [...]│ │
│ └─────────────┘ │
└─────────────────┘
```

## Key Features

### Organization
- Drag-and-drop reordering of areas and items
- Collapsible tree structure
- Item count badges on areas

### Item Cards
- Type icon (ground/flight/both)
- ACS codes displayed prominently  
- Warning indicators for incomplete items
- Quick action buttons

### Bulk Operations
- Multi-select with checkboxes
- Bulk delete/move/export
- Import from CSV/JSON

### Search & Filter
- Real-time search across names and descriptions
- Filter by type (ground/flight/both)
- Filter by ACS mapping status
- Filter by completion criteria