# FlightLessons MCP Server

This MCP (Model Context Protocol) server provides tools for AI agents to interact with the FlightLessons curriculum management system.

## Setup

1. Install dependencies:
   ```bash
   cd mcp-server
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Set up Firebase Admin credentials:
   - Download a service account key from Firebase Console
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to the JSON file

4. Configure Claude Desktop:
   - Copy the contents of `mcp-config.json` to your Claude Desktop settings
   - Update the path to your service account JSON file

## Available Tools

### Study Areas
- `create_study_area` - Create a new study area for a certificate
- `list_study_areas` - List all study areas for a certificate

### Study Items
- `create_study_item` - Create a new study item within a study area
- `list_study_items` - List all study items in a study area

### Lesson Plans
- `create_lesson_plan` - Create a new lesson plan for a certificate
- `list_lesson_plans` - List all lesson plans for a certificate

### Document Import
- `import_lesson_document` - Process and import lesson plan documents (placeholder for future implementation)

## Usage

Once configured, the AI assistant in the FlightLessons app can use these tools to help CFIs:
- Create and organize curriculum structure
- Import existing lesson plans
- Build study areas and items based on FAA standards
- Generate lesson plans from uploaded documents

## Development

To run in development mode with auto-rebuild:
```bash
npm run watch
```

## Future Enhancements

1. **Document Processing**: Implement actual document parsing for PDF/Word imports
2. **Batch Operations**: Add tools for bulk creating study items
3. **Templates**: Pre-built curriculum templates for common certificates
4. **Progress Analysis**: Tools to analyze student progress and suggest curriculum improvements