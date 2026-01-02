# AI Prompt Template for FlightLessons Curriculum Generation

## Overview
Use this template to generate curriculum files compatible with the FlightLessons system. The curriculum must follow the JSON format specified below.

## Master Prompt Template

Copy and paste this entire template into your AI assistant, filling in the bracketed sections:

```
You are an experienced Certified Flight Instructor (CFI) creating a structured curriculum for flight training. Generate a complete curriculum file in JSON format that follows the FlightLessons Curriculum Exchange Format v1.0.

BASIC INFORMATION:
- Certificate Type: [PRIVATE/INSTRUMENT/COMMERCIAL]
- Training Program Type: [e.g., Part 61/Part 141]
- Target Completion Time: [e.g., 3 months, 6 months, self-paced]

=== CUSTOM INSTRUCTIONS SECTION ===
[INSERT YOUR SPECIFIC REQUIREMENTS HERE]

Examples of what to include:
- Training aircraft type (e.g., "Cessna 172 with G1000")
- Special emphasis areas (e.g., "mountain flying", "crosswind landings")
- Student background (e.g., "zero time", "rusty pilot", "military transition")
- Local considerations (e.g., "high density altitude", "complex airspace")
- Training philosophy (e.g., "scenario-based", "traditional", "accelerated")
- Equipment available (e.g., "Redbird simulator", "VR training devices")
- Specific weaknesses to address (e.g., "radio communications", "weather decisions")
- Any unique requirements or constraints
=== END CUSTOM INSTRUCTIONS ===

STANDARD REQUIREMENTS (DO NOT MODIFY):
The curriculum MUST follow these exact specifications:

1. Include 5-10 Study Areas (major topic categories)
2. Include 5-15 Study Items per area (specific learning objectives)
3. Include 15-30 Lesson Plans that group related study items
4. Follow FAA ACS/PTS standards for the certificate level
5. Use logical progression from basic to advanced concepts
6. Include both ground and flight training elements
7. Provide measurable evaluation criteria

FORMAT REQUIREMENTS (CRITICAL - NO DEVIATIONS):
- Output MUST be valid JSON
- IDs MUST follow exact patterns: area_1, area_2, item_1, item_2, plan_1, plan_2
- Study items MUST reference valid area IDs
- Lesson plans MUST reference valid item IDs
- Types MUST be exactly: "GROUND", "FLIGHT", or "BOTH"
- Certificate MUST be exactly: "PRIVATE", "INSTRUMENT", or "COMMERCIAL"
- Time estimates: ground in minutes (integer), flight in decimal hours
- Include ACS codes where applicable (format: "XX.Y.Z.K#" or "XX.Y.Z.S#")

REQUIRED JSON STRUCTURE (USE EXACTLY):
{
  "version": "1.0",
  "metadata": {
    "title": "[Certificate] Pilot Curriculum",
    "description": "Comprehensive training curriculum for [certificate] certificate",
    "author": "AI Generated",
    "createdAt": "[Current ISO date]",
    "certificate": "[PRIVATE|INSTRUMENT|COMMERCIAL]",
    "tags": ["custom", "tags", "here"]
  },
  "studyAreas": [
    {
      "id": "area_1",
      "name": "Area Name",
      "description": "Brief description of this topic area",
      "orderNumber": 1
    }
  ],
  "studyItems": [
    {
      "id": "item_1",
      "studyAreaId": "area_1",
      "name": "Specific skill or knowledge item",
      "type": "[GROUND|FLIGHT|BOTH]",
      "description": "Detailed description of what student will learn",
      "evaluationCriteria": "Specific, measurable criteria for proficiency",
      "orderNumber": 1,
      "acsCodeMappings": ["PA.I.A.K1", "PA.I.A.S1"],
      "referenceMaterials": [
        {
          "type": "link",
          "name": "Reference name",
          "url": "https://example.com",
          "description": "What this reference covers"
        }
      ]
    }
  ],
  "lessonPlans": [
    {
      "id": "plan_1",
      "title": "Lesson Title",
      "orderNumber": 1,
      "motivation": "Why this lesson is important for the student",
      "objectives": [
        "Student will be able to...",
        "Student will demonstrate..."
      ],
      "itemIds": ["item_1", "item_2"],
      "planDescription": "Overview of lesson flow and key activities",
      "preStudyHomework": "What student should prepare before lesson",
      "estimatedDuration": {
        "ground": 60,
        "flight": 1.3
      },
      "referenceMaterials": []
    }
  ]
}

Generate the complete curriculum now, ensuring all cross-references are valid and the JSON is properly formatted.
```

## Quick Templates by Certificate

### Private Pilot Template
```
Certificate Type: PRIVATE
Training Program Type: Part 61
Target Completion Time: 6 months

=== CUSTOM INSTRUCTIONS SECTION ===
- Training in Cessna 172S with steam gauges
- Emphasis on stick and rudder skills
- Local airport has Class D airspace
- Many students struggle with radio communications
- Include night flying preparation
- Focus on practical cross-country planning
=== END CUSTOM INSTRUCTIONS ===

[Include the rest of the standard template above]
```

### Instrument Rating Template
```
Certificate Type: INSTRUMENT
Training Program Type: Part 61
Target Completion Time: 4 months

=== CUSTOM INSTRUCTIONS SECTION ===
- Training in Cessna 172 with G1000
- Student already has 200 hours VFR experience
- Emphasis on single pilot IFR operations
- Include both precision and non-precision approaches
- Focus on real-world weather flying
- Include holds, DME arcs, and GPS approaches
=== END CUSTOM INSTRUCTIONS ===

[Include the rest of the standard template above]
```

### Commercial Certificate Template
```
Certificate Type: COMMERCIAL
Training Program Type: Part 141
Target Completion Time: 3 months

=== CUSTOM INSTRUCTIONS SECTION ===
- Training in Piper Arrow (complex) and Cessna 172
- Student has instrument rating
- Emphasis on commercial maneuvers precision
- Include mountain flying and high DA operations
- Focus on professional pilot skills
- Prepare for CFI transition after commercial
=== END CUSTOM INSTRUCTIONS ===

[Include the rest of the standard template above]
```

## Tips for Best Results

### DO:
- Be specific about your training environment and constraints
- Include any special emphasis areas required by your school
- Mention specific aircraft models and avionics
- Describe your typical student profile
- List any known problem areas to address

### DON'T:
- Don't modify the JSON structure
- Don't change the ID patterns (area_X, item_X, plan_X)
- Don't use different values for type or certificate fields
- Don't skip the orderNumber fields
- Don't create circular references

### VALIDATION CHECKLIST:
After generation, verify:
- [ ] JSON validates without errors
- [ ] All area IDs follow pattern area_1, area_2, etc.
- [ ] All item studyAreaIds reference existing areas
- [ ] All plan itemIds reference existing items
- [ ] Order numbers are sequential and logical
- [ ] Time estimates are realistic
- [ ] ACS codes are properly formatted
- [ ] No duplicate IDs exist

## Using Your Generated Curriculum

1. **Generate**: Use the template with your AI assistant
2. **Copy**: Select and copy the entire JSON output
3. **Validate**: Paste into jsonlint.com to verify format
4. **Save**: Save as `[certificate]_curriculum.json`
5. **Import**: Use FlightLessons Import/Export feature
6. **Review**: Check imported content and adjust as needed
7. **Customize**: Add local procedures and references

## Common Issues and Solutions

### "Invalid JSON" Error
- Ensure the AI output is complete (not truncated)
- Check for missing commas between array items
- Verify all strings are properly quoted
- Remove any trailing commas

### "Invalid Reference" Error
- Check that all studyAreaIds match existing area IDs
- Verify all itemIds in lesson plans exist
- Ensure IDs follow the exact pattern (area_1, not area1)

### "Missing Required Field" Error
- All items must have orderNumber
- All study items need type field
- Lesson plans require both ground and flight duration

## Example Custom Instructions

### For Accelerated Program:
```
- Intensive 3-week private pilot program
- Students fly twice daily
- Maximum efficiency in lesson progression
- Combined ground/flight lessons when possible
- Emphasis on quick skill acquisition
- Include bad weather alternates for every lesson
```

### For Working Professionals:
```
- Weekend and evening availability only
- Flexible scheduling considerations
- Self-study emphasis with online resources
- Efficient use of simulator time
- Include weather windows planning
- Focus on practical flying vs competition standards
```

### For Mountain Flying School:
```
- High altitude airport operations (7000+ MSL)
- Mountain flying techniques essential from day one
- Density altitude considerations in all flights
- Canyon turns and ridge crossing procedures
- Mountain weather patterns
- Emergency procedures for terrain
```