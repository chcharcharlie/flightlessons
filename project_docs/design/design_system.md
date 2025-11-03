# Design System

## Visual Direction

### Brand Personality
- Professional and trustworthy
- Clean and modern
- Aviation-inspired without being clichéd
- Accessible and approachable

### Colors

#### Primary Colors
- **Sky Blue**: #0EA5E9 (primary actions, links)
- **Navy**: #1E3A8A (headers, important text)
- **White**: #FFFFFF (backgrounds, cards)

#### Secondary Colors
- **Success Green**: #10B981 (completed items, positive feedback)
- **Warning Amber**: #F59E0B (needs attention, upcoming items)
- **Danger Red**: #EF4444 (errors, critical items)
- **Neutral Gray**: #6B7280 (secondary text, borders)

#### Background Colors
- **Light Gray**: #F9FAFB (page backgrounds)
- **Card Background**: #FFFFFF
- **Subtle Blue**: #EFF6FF (highlighted sections)

### Typography

#### Font Family
- **Primary**: Inter, -apple-system, BlinkMacSystemFont, sans-serif
- **Monospace**: 'SF Mono', Monaco, monospace (for codes, flight plans)

#### Font Sizes
- **Heading 1**: 32px (2rem) - Page titles
- **Heading 2**: 24px (1.5rem) - Section headers
- **Heading 3**: 20px (1.25rem) - Subsections
- **Body**: 16px (1rem) - Regular text
- **Small**: 14px (0.875rem) - Secondary text
- **Tiny**: 12px (0.75rem) - Labels, timestamps

#### Font Weights
- **Regular**: 400 - Body text
- **Medium**: 500 - Emphasized text
- **Semibold**: 600 - Subheadings
- **Bold**: 700 - Headers

### Spacing

#### Base Unit
- 8px grid system

#### Common Spacing
- **xs**: 4px (0.5 unit)
- **sm**: 8px (1 unit)
- **md**: 16px (2 units)
- **lg**: 24px (3 units)
- **xl**: 32px (4 units)
- **2xl**: 48px (6 units)

#### Container Padding
- Mobile: 16px
- Tablet: 24px
- Desktop: 32px

## Components

### Buttons

#### Primary Button
- Background: #0EA5E9
- Text: #FFFFFF
- Padding: 12px 24px
- Border-radius: 8px
- Font-weight: 500
- Hover: darken 10%
- Active: darken 20%

#### Secondary Button
- Background: #FFFFFF
- Border: 1px solid #E5E7EB
- Text: #374151
- Padding: 12px 24px
- Border-radius: 8px
- Hover: background #F9FAFB

#### Icon Button
- Size: 40px × 40px
- Border-radius: 8px
- Padding: 8px

### Forms

#### Input Fields
- Height: 40px
- Border: 1px solid #E5E7EB
- Border-radius: 6px
- Padding: 0 12px
- Font-size: 16px
- Focus: border #0EA5E9, shadow 0 0 0 3px rgba(14, 165, 233, 0.1)

#### Labels
- Font-size: 14px
- Font-weight: 500
- Color: #374151
- Margin-bottom: 4px

#### Select Dropdowns
- Same styling as input fields
- Custom arrow indicator

#### Textarea
- Min-height: 80px
- Padding: 8px 12px
- Same border styling as inputs

### Cards

#### Basic Card
- Background: #FFFFFF
- Border: 1px solid #E5E7EB
- Border-radius: 12px
- Padding: 24px
- Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)

#### Interactive Card
- Basic card styling plus:
- Hover: shadow 0 4px 6px rgba(0, 0, 0, 0.1)
- Cursor: pointer
- Transition: all 0.2s ease

### Navigation

#### Top Navigation
- Height: 64px
- Background: #FFFFFF
- Border-bottom: 1px solid #E5E7EB
- Shadow: 0 1px 3px rgba(0, 0, 0, 0.05)

#### Side Navigation
- Width: 260px (desktop)
- Background: #F9FAFB
- Border-right: 1px solid #E5E7EB

#### Navigation Items
- Height: 40px
- Padding: 0 16px
- Border-radius: 6px
- Hover: background #E5E7EB
- Active: background #EFF6FF, color #0EA5E9

### Progress Indicators

#### Progress Bar
- Height: 8px
- Background: #E5E7EB
- Border-radius: 4px
- Fill: gradient from #0EA5E9 to #10B981

#### Score Pills
- **Flight Scores (1-5)**:
  - 1: #EF4444 (red)
  - 2: #F59E0B (amber)
  - 3: #EAB308 (yellow)
  - 4: #84CC16 (lime)
  - 5: #10B981 (green)
- **Ground Status**:
  - Not Taught: #6B7280 (gray)
  - Needs Reinforcement: #F59E0B (amber)
  - Learned: #10B981 (green)

### Data Tables

#### Table Header
- Background: #F9FAFB
- Font-weight: 600
- Font-size: 14px
- Padding: 12px 16px
- Border-bottom: 2px solid #E5E7EB

#### Table Row
- Padding: 16px
- Border-bottom: 1px solid #E5E7EB
- Hover: background #F9FAFB

### Mobile Adaptations

#### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

#### Mobile Navigation
- Bottom tab bar for main navigation
- Hamburger menu for secondary options
- Full-width cards with 16px margin

## Interaction Patterns

### Navigation
- Breadcrumb navigation for hierarchical content
- Tab navigation for related views
- Sticky headers for long scrolling pages

### Feedback
- Toast notifications (top-right)
- Loading spinners for async operations
- Skeleton screens for data loading
- Success/error states on forms

### Gestures (Mobile)
- Swipe to reveal actions (lessons)
- Pull to refresh on dashboards
- Long press for quick actions

## Icons

### Icon Library
- Heroicons (outline style preferred)
- Size: 20px for inline, 24px for buttons
- Color: inherit from parent

### Common Icons
- Dashboard: squares-2x2
- Students: user-group
- Lessons: academic-cap
- Progress: chart-bar
- Settings: cog-6-tooth
- Calendar: calendar-days
- Aircraft: paper-airplane
- Ground: book-open
- Flight: paper-airplane

## Accessibility

### Color Contrast
- WCAG AA compliant minimum
- 4.5:1 for normal text
- 3:1 for large text

### Focus States
- Visible focus rings
- Keyboard navigation support
- Skip links for main content

### ARIA Labels
- Descriptive labels for icons
- Form validation announcements
- Progress updates for screen readers