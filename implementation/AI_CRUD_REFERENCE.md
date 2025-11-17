# AI Assistant CRUD Operations Reference

## Complete List of Supported Operations

### CREATE Operations

#### Create Study Area
```json
{
  "action": "CREATE",
  "type": "study_area",
  "data": {
    "name": "Navigation Systems",
    "orderNumber": 1
  }
}
```

#### Create Study Item
```json
{
  "action": "CREATE", 
  "type": "study_item",
  "data": {
    "name": "VOR Navigation",
    "areaId": "area_id_here",
    "type": "GROUND", // or "FLIGHT" or "BOTH"
    "description": "Understanding VOR navigation principles",
    "evaluationCriteria": "Student can explain VOR principles and tune/identify VORs",
    "orderNumber": 1
  }
}
```

#### Create Lesson Plan
```json
{
  "action": "CREATE",
  "type": "lesson_plan",
  "data": {
    "title": "Introduction to IFR Navigation",
    "motivation": "Essential for instrument flying",
    "objectives": ["Understand VOR", "Practice holds"],
    "itemIds": ["item1", "item2"],
    "planDescription": "Detailed lesson plan here",
    "preStudyHomework": "Read Chapter 5",
    "estimatedDuration": {"ground": 90, "flight": 1.5},
    "orderNumber": 1
  }
}
```

### DELETE Operations

#### Delete All (Everything for a certificate)
```json
{
  "action": "DELETE",
  "type": "all",
  "certificate": "INSTRUMENT"
}
```

#### Delete by Type
```json
{
  "action": "DELETE",
  "type": "study_areas", // or "study_items" or "lesson_plans"
  "certificate": "INSTRUMENT"
}
```

#### Delete by ID
```json
{
  "action": "DELETE",
  "type": "study_area", // or "study_item" or "lesson_plan"
  "id": "specific_item_id"
}
```

#### Delete by Filter (name contains text)
```json
{
  "action": "DELETE",
  "type": "study_areas",
  "certificate": "INSTRUMENT",
  "filter": "test" // deletes all areas with "test" in name
}
```

### LIST Operations

#### List Study Areas
```json
{
  "action": "LIST",
  "type": "study_areas",
  "certificate": "INSTRUMENT"
}
```

#### List Study Items
```json
{
  "action": "LIST",
  "type": "study_items",
  "certificate": "INSTRUMENT"
}
```

#### List Lesson Plans
```json
{
  "action": "LIST",
  "type": "lesson_plans", 
  "certificate": "INSTRUMENT"
}
```

### UPDATE Operations
*Not yet implemented - coming soon*

## How the AI Uses These

1. **Context Aware**: The AI knows which certificate tab you're on from sessionStorage
2. **Natural Language**: You can say things like:
   - "Delete all study areas with 'test' in the name"
   - "Create a study area for navigation"
   - "List all my lesson plans"
   - "Delete the Weather Theory study area"

3. **Automatic Execution**: The AI will:
   - Parse your request
   - Generate the appropriate JSON action
   - Execute it immediately
   - Hide the JSON from you
   - Show only the result
   - Auto-refresh the page content

## Testing Examples

Try these prompts with the AI:

1. "Create a study area called Navigation Systems"
2. "List all study areas"
3. "Delete study areas containing the word test"
4. "Create a lesson plan for basic instrument navigation"
5. "Delete everything and let's start fresh"
6. "Show me all lesson plans"

## Notes

- When deleting study areas, all associated study items are also deleted
- The page automatically refreshes after CREATE/DELETE operations
- The chat window stays open and preserves history
- All operations respect the current certificate context