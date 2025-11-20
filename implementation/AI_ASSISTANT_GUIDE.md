# AI Assistant Implementation Guide

This guide documents the AI assistant functionality integrated into the FlightLessons application.

## Overview

The AI assistant is a tool-enabled chatbot that helps CFIs (Certified Flight Instructors) manage their curriculum. It uses Anthropic's Claude model with custom tools to perform CRUD operations on study areas, study items, and lesson plans.

## Architecture

### Components

1. **Frontend Components**
   - `FloatingChatButton` - Floating button to open chat
   - `ChatWindow` - Main chat interface with file upload support
   - `AIProgressDisplay` - Real-time progress indicators
   - `ToolExecutionDisplay` - Shows tool execution details

2. **Backend Functions**
   - `aiChatWithTools` - Main Cloud Function handling AI interactions
   - Tool implementations for CRUD operations

3. **Real-time Progress Tracking**
   - Uses Firestore for real-time progress updates
   - Shows users what the AI is doing during long operations

## Available Tools

The AI assistant has access to the following tools:

### Study Areas
- `list_study_areas` - List all study areas for a certificate
- `create_study_area` - Create a new study area
- `delete_study_areas` - Delete study areas by name filter

### Study Items
- `list_study_items` - List study items with optional area filter
- `create_study_item` - Create a single study item
- `delete_study_items` - Delete study items by filter

### Lesson Plans
- `list_lesson_plans` - List all lesson plans
- `create_lesson_plan` - Create a new lesson plan
- `delete_lesson_plans` - Delete lesson plans by name filter

### Utility
- `delete_all_curriculum` - Delete all curriculum content

## Usage Examples

The AI assistant can handle natural language requests like:

- "Create study items for the Navigation Systems area"
- "List all study areas for INSTRUMENT certificate"
- "Delete all items with 'test' in the name"
- "Create a comprehensive lesson plan for VOR navigation"

## Implementation Details

### Multi-turn Conversations
The system supports up to 3 conversation turns, allowing the AI to:
1. Query existing data (e.g., list study areas)
2. Process the results
3. Take action based on findings (e.g., create items for a specific area)

### Progress Tracking
Real-time progress updates show:
- Which tools are being executed
- Parameters being used
- Progress through multiple operations
- Completion status

### Security
- Only authenticated CFIs can use the AI assistant
- All operations are scoped to the user's workspace
- Tool executions are logged for auditing

## Configuration

### Environment Variables
Add to your Cloud Functions environment:
```bash
firebase functions:config:set anthropic.api_key="your-api-key"
```

### Model Configuration
The system uses `claude-sonnet-4-5` model with:
- Max tokens: 4000
- Temperature: 0.7
- Timeout: 9 minutes

## Troubleshooting

1. **Empty Responses**
   - Check if operations completed successfully in the database
   - Review Cloud Function logs for errors

2. **Timeouts**
   - Large operations may timeout in the UI but continue in background
   - Check your curriculum after a moment

3. **Permission Errors**
   - Ensure user has CFI role
   - Check Firestore security rules