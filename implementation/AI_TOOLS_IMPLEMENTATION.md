# AI Assistant Tools Implementation

## Overview

The AI assistant is now properly implemented using Anthropic's native tool use feature, which allows Claude to directly execute curriculum management operations and return formatted results.

## Architecture

### Previous Approach Issues
- The JSON parsing approach was trying to extract and execute JSON from Claude's responses
- MCP server approach wasn't suitable for cloud functions (can't run separate processes)
- Results weren't being properly returned to Claude for formatting

### Current Implementation
1. **Tool-based Approach**: Uses Anthropic's built-in tool use feature
2. **Direct Execution**: Tools are executed server-side in the cloud function
3. **Natural Responses**: Claude receives tool results and formats them naturally

## Available Tools

### Study Areas
- `list_study_areas` - List all study areas for a certificate
- `create_study_area` - Create a new study area
- `delete_study_areas` - Delete areas by filter or all

### Study Items  
- `list_study_items` - List all study items (optionally by area)
- `create_study_item` - Create a new study item
- `delete_study_items` - Delete items by filter or all

### Lesson Plans
- `list_lesson_plans` - List all lesson plans for a certificate
- `create_lesson_plan` - Create a new lesson plan
- `delete_lesson_plans` - Delete plans by filter or all

### Bulk Operations
- `delete_all_curriculum` - Delete everything for a certificate

## How It Works

1. User sends a message to the AI assistant
2. Cloud function passes the message to Claude with available tools
3. Claude analyzes the request and chooses appropriate tool(s)
4. The function executes the tool and returns results to Claude
5. Claude formats a natural language response for the user
6. If data was modified, the page automatically refreshes

## Testing Guide

### Basic Queries
```
"What study areas do we have?"
"Show me all lesson plans"
"List the study items"
```

### Creating Content
```
"Create a study area called Navigation Systems"
"Add a study item for VOR navigation to the Navigation Systems area"
"Create a lesson plan for basic instrument navigation"
```

### Deleting Content
```
"Delete study areas with 'test' in the name"
"Delete all lesson plans"
"Remove all curriculum content for this certificate"
```

### Complex Operations
```
"Create a complete navigation curriculum with areas, items, and lesson plans"
"Show me what's in the Weather Theory study area"
"Delete the old curriculum and create a new structure"
```

## Key Improvements

1. **No JSON Visible**: Users never see implementation details
2. **Natural Conversation**: Claude handles all formatting
3. **Proper Tool Use**: Leverages Anthropic's native capabilities
4. **Error Handling**: Graceful handling of errors with user-friendly messages
5. **Automatic Refresh**: Page updates after modifications
6. **Context Awareness**: Uses sessionStorage to detect current certificate

## Function Details

- **Function Name**: `aiChatWithTools`
- **Location**: `/functions/src/ai-chat-with-tools.ts`
- **Model**: Claude 3.5 Sonnet
- **Timeout**: 9 minutes
- **Memory**: 1GB

## Client Integration

The client uses the function through:
```typescript
import { httpsCallable } from 'firebase/functions'

const aiChat = httpsCallable(functions, 'aiChatWithTools')
const result = await aiChat({
  message,
  conversationHistory,
  context
})
```

## Deployment

```bash
firebase deploy --only functions:aiChatWithTools
```

## Monitoring

Check Cloud Functions logs for:
- Tool execution details
- Error messages
- Performance metrics

```bash
firebase functions:log --only aiChatWithTools
```