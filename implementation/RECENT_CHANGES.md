# Recent Changes Log

## Date: 2025-11-16

### AI Assistant Feature Implementation

#### 1. Created Floating Chat Interface
- **Components Added**:
  - `/src/components/ai/FloatingChatButton.tsx` - Floating button with notification badge
  - `/src/components/ai/ChatWindow.tsx` - Full chat interface with file upload support
- **Integration**: Added to CFI Dashboard for easy access

#### 2. Backend API Proxy for Anthropic
- **Cloud Function**: `aiChat` function in `/functions/src/ai-chat.ts`
- **Features**:
  - Secure API key management using Firebase secrets
  - Conversation history support
  - File context handling
  - Error handling for rate limits and service issues
- **Configuration**: Uses Claude 3.5 Sonnet model with CFI-specific system prompt

#### 3. MCP Server for Curriculum CRUD
- **Location**: `/mcp-server/` directory
- **Tools Implemented**:
  - Study area management (create, list)
  - Study item management (create, list) 
  - Lesson plan management (create, list)
  - Document import placeholder for future enhancement
- **Setup**: TypeScript-based server using Firebase Admin SDK

#### 4. Frontend Integration
- **API Client**: `/src/lib/ai-chat.ts` for communication with Cloud Function
- **Error Handling**: User-friendly error messages in chat
- **File Support**: Document upload capability for lesson plan imports

### Pending AI Features
1. **MCP Client Integration**: Connect chat to MCP server for CRUD operations
2. **Document Processing**: Implement actual PDF/Word document parsing
3. **Auto-generation**: AI-powered curriculum creation from uploads
4. **Progress Analysis**: AI suggestions based on student performance

## Date: 2025-11-16

### Reference Materials System Enhancements

#### 1. Fixed Date Parsing Issues
- **Problem**: Lessons were failing to load with "TypeError: lessonData.actualDate.toDate is not a function"
- **Solution**: Added support for raw Firestore timestamp format with `seconds` and `nanoseconds` properties
- **Files Modified**: 
  - `/src/pages/cfi/LessonDetail.tsx`

#### 2. Reference Materials Modal Integration
- **Problem**: Reference materials section in lesson plans wasn't using the modal-based behavior
- **Solution**: Updated curriculum management to use `ReferenceMaterialModal` component
- **Files Modified**:
  - `/src/pages/cfi/LessonPlanDetail.tsx` - Added modal integration, imports, and state management
  - `/src/pages/cfi/LessonPlans.tsx` - Added inline editing support for reference materials

#### 3. Reference Materials Display Improvements
- **Added Notes Display**: Reference material notes now visible in all views (important for specifying relevant pages)
- **Files Modified**:
  - `/src/pages/cfi/LessonPlans.tsx` - Added notes display in both edit and view modes
  - `/src/pages/cfi/ProgramProgress.tsx` - Added reference materials to syllabus section
  - `/src/pages/student/StudentProgramProgress.tsx` - Added reference materials to student's syllabus view

#### 4. Auto-population Fixes
- **Problem**: Reference materials weren't auto-populating when scheduling lessons from lesson plans
- **Solution**: Added reference materials to the form population logic
- **Files Modified**:
  - `/src/pages/cfi/Lessons.tsx` - Added `setReferenceMaterials` in useEffect
  - `/src/pages/cfi/ProgramProgress.tsx` - Fixed reference materials population and save logic

#### 5. UI/UX Improvements
- **Fixed Button Alignment**: Edit/delete buttons now properly aligned in Program Progress tab
- **Removed URL Display**: Fixed layout issues by removing URL display in Lessons tab
- **Added Edit Functionality**: Edit button now properly auto-populates current values
- **Files Modified**:
  - `/src/pages/cfi/ProgramProgress.tsx` - Improved button alignment with flex container
  - `/src/pages/cfi/Lessons.tsx` - Removed URL display, added proper edit button
  - `/src/components/ReferenceMaterialModal.tsx` - Added useEffect to handle initialMaterial changes

#### 6. Student Progress Page Updates
- **Standardized Format**: Updated student's progress page lessons section to match CFI's format
- **Removed Redundant Elements**: Removed unnecessary "SCHEDULED" badges
- **Improved Navigation**: Changed "View all" text to clickable buttons
- **Files Modified**:
  - `/src/pages/student/StudentProgramProgress.tsx`

### Key Features Now Available
1. **Consistent Reference Materials Experience**:
   - Modal-based editing across all interfaces
   - Notes displayed prominently to show relevant pages/sections
   - Auto-population when using lesson plan templates

2. **Improved User Interface**:
   - Hover effects for edit/delete actions
   - Consistent styling across CFI and student views
   - Better visual hierarchy with icons for links vs documents

3. **Better Workflow**:
   - Reference materials properly carry over from lesson plans to lessons
   - Inline editing available with navigation to full editor for complex operations
   - Edit functionality properly loads existing values

### Testing Notes
- Verify reference materials auto-populate when selecting lesson plan templates
- Check that notes display properly in all views
- Confirm edit buttons load existing values correctly
- Test that reference materials save properly when creating lessons

### Known Issues Resolved
- ✅ Date parsing errors for lessons
- ✅ Reference materials not using modal in lesson plans
- ✅ Missing notes display
- ✅ Auto-population failures
- ✅ UI alignment issues
- ✅ Edit button not loading current values