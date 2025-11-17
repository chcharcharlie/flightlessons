import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

// @ts-ignore - db is used in the action handlers below
const db = admin.firestore();

export const aiChat = onCall(
  { 
    timeoutSeconds: 540, // 9 minutes
    memory: '1GiB'
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { message, context, conversationHistory } = request.data;

    if (!message) {
      throw new HttpsError('invalid-argument', 'Message is required');
    }

    // Get user from Firestore
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'CFI') {
      throw new HttpsError('permission-denied', 'Only CFIs can use the AI assistant');
    }

    try {
      // Get API key from environment variable
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) {
        throw new HttpsError('failed-precondition', 'API key not configured');
      }

      const anthropic = new Anthropic({
        apiKey: apiKey
      });

      // Build the conversation with context
      const messages: Anthropic.MessageParam[] = [];
      
      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory)) {
        conversationHistory.forEach((msg: any) => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
              role: msg.role,
              content: msg.content
            });
          }
        });
      }

      // Add current message
      messages.push({
        role: 'user',
        content: message
      });

      // Create system prompt
      const systemPrompt = `You are an experienced Certified Flight Instructor (CFI) assistant helping with curriculum management. You have extensive knowledge of FAA regulations, flight training standards, and educational best practices.

${context ? `Context about the current curriculum:\n${context}\n` : ''}

Your role is to:
1. Help organize and structure flight training curriculum
2. Extract information from uploaded lesson plans and documents
3. Create study areas, study items, and lesson plans based on FAA standards
4. Suggest appropriate reference materials and teaching approaches
5. Optimize curriculum based on student progress patterns
6. Ensure compliance with FAA practical test standards (ACS/PTS)

When helping create curriculum content:
- Study areas should be broad topics (e.g., "Navigation", "Weather", "Aircraft Systems")
- Study items should be specific skills or knowledge points within those areas
- Each item should have clear evaluation criteria
- Consider both ground and flight instruction needs
- Reference appropriate FAR/AIM sections and other materials

Be professional but friendly, and focus on practical, actionable advice.

IMPORTANT: You can perform actions on curriculum content (CREATE, DELETE, LIST, UPDATE). When a user asks you to perform an action:

1. IMMEDIATELY output a JSON code block (\`\`\`json) WITHOUT ANY TEXT BEFORE IT
2. The JSON will be automatically executed and replaced with results
3. After the JSON block, provide a natural response about what will happen

EXTREMELY IMPORTANT - THE USER MUST NEVER SEE THE JSON:
- Do NOT explain what the JSON does
- Do NOT say "I'll execute this" or "Here's the JSON"
- Do NOT show JSON structure to the user
- The JSON is for the SYSTEM ONLY

For listing/viewing content:
\`\`\`json
{"action": "LIST", "type": "study_areas", "certificate": "INSTRUMENT"}
\`\`\`

For deleting with filter:
\`\`\`json
{"action": "DELETE", "type": "study_areas", "filter": "test", "certificate": "INSTRUMENT"}
\`\`\`

For deleting all:
\`\`\`json
{"action": "DELETE", "type": "all", "certificate": "INSTRUMENT"}
\`\`\`

For creating:
\`\`\`json
{"action": "CREATE", "type": "study_area", "data": {"name": "Area Name", "orderNumber": 1}}
\`\`\`

When user asks "what study areas do we have?", your ENTIRE response should be:
\`\`\`json
{"action": "LIST", "type": "study_areas", "certificate": "INSTRUMENT"}
\`\`\`
Here are your current study areas:

The JSON executes automatically and shows results. NEVER mention JSON to users!

When users ask for templates or examples of curriculum content (NOT when performing actions), you can provide these formats:

For Study Areas:
- Name: The topic area
- Order: Display sequence

For Study Items:
- Name: Specific skill/knowledge
- Type: GROUND, FLIGHT, or BOTH
- Description: What students learn
- Evaluation: How to assess mastery
- Study Area: Which area it belongs to

For Lesson Plans:
- Title: Lesson name
- Motivation: Why it matters
- Objectives: Learning goals
- Description: Teaching approach
- Pre-study: Homework before lesson
- Duration: Time estimates
- Items: Related study items

REMEMBER: Only show structure when asked. For actions, use JSON silently!`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages
      });

      // Extract text content from response
      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      // Check if the response contains action JSON
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      let action: any = null;
      if (jsonMatch) {
        try {
          action = JSON.parse(jsonMatch[1]);
          
          // ALWAYS remove the JSON block from the response immediately
          // This ensures users never see the JSON
          const jsonBlockEnd = jsonMatch.index! + jsonMatch[0].length;
          const beforeJson = responseText.substring(0, jsonMatch.index!);
          const afterJson = responseText.substring(jsonBlockEnd);
          
          // If there's nothing before the JSON or only whitespace, remove it
          const cleanBefore = beforeJson.trim();
          responseText = (cleanBefore ? cleanBefore + '\n\n' : '') + afterJson.trim();
          
          const workspaceId = userDoc.data()?.cfiWorkspaceId;
          if (!workspaceId) {
            console.error('No workspace ID found for user');
            responseText = responseText.trim() || '❌ Unable to access your workspace. Please ensure you are logged in as a CFI.';
            return {
              success: true,
              response: responseText,
              usage: response.usage,
              requiresRefresh: false
            };
          }
          
          const currentCertificate = action.certificate || 
            context.match(/viewing the (\w+) certificate/i)?.[1]?.toUpperCase() || 
            'PRIVATE';
            
          console.log('Executing action:', { 
            action: action.action, 
            type: action.type, 
            certificate: currentCertificate,
            workspaceId,
            filter: action.filter
          });

          // Execute the action based on type
          if (action.action === 'DELETE' && action.id) {
            // Delete specific item by ID
            let docRef;
            let itemName = '';
            
            if (action.type === 'study_area') {
              docRef = db.collection('studyAreas').doc(action.id);
              const doc = await docRef.get();
              if (doc.exists) {
                itemName = doc.data()?.name || 'Study Area';
                // Also delete associated items
                const items = await db.collection('studyItems')
                  .where('studyAreaId', '==', action.id)
                  .get();
                const batch = db.batch();
                items.docs.forEach(itemDoc => batch.delete(itemDoc.ref));
                batch.delete(docRef);
                await batch.commit();
              }
            } else if (action.type === 'study_item') {
              docRef = db.collection('studyItems').doc(action.id);
              const doc = await docRef.get();
              if (doc.exists) {
                itemName = doc.data()?.name || 'Study Item';
                await docRef.delete();
              }
            } else if (action.type === 'lesson_plan') {
              docRef = db.collection('lessonPlans').doc(action.id);
              const doc = await docRef.get();
              if (doc.exists) {
                itemName = doc.data()?.title || 'Lesson Plan';
                await docRef.delete();
              }
            }
            
            const result = itemName ? `✅ Deleted "${itemName}"` : `❌ Item with ID ${action.id} not found`;
            responseText = responseText.trim() || result;
          } else if (action.action === 'DELETE') {
            const batch = db.batch();
            let deletedCount = 0;
            
            let lessonPlansCount = 0;
            let studyAreasCount = 0;
            let studyItemsCount = 0;

            // Handle different delete types
            if (action.type === 'all' || action.type === 'lesson_plan' || action.type === 'lesson_plans') {
              // Delete lesson plans
              const lessonPlans = await db
                .collection('lessonPlans')
                .where('cfiWorkspaceId', '==', workspaceId)
                .where('certificate', '==', currentCertificate)
                .get();
              lessonPlans.docs.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
                lessonPlansCount++;
              });
            }

            if (action.type === 'all' || action.type === 'study_area' || action.type === 'study_areas' || action.type === 'study_item' || action.type === 'study_items') {
              // Get study areas
              const studyAreas = await db
                .collection('studyAreas')
                .where('cfiWorkspaceId', '==', workspaceId)
                .where('certificate', '==', currentCertificate)
                .get();
              
              // Delete study items if needed
              if (action.type === 'all' || action.type === 'study_item' || action.type === 'study_items' || action.type === 'study_area' || action.type === 'study_areas') {
                for (const area of studyAreas.docs) {
                  const items = await db
                    .collection('studyItems')
                    .where('cfiWorkspaceId', '==', workspaceId)
                    .where('studyAreaId', '==', area.id)
                    .get();
                  items.docs.forEach(doc => {
                    batch.delete(doc.ref);
                    deletedCount++;
                    studyItemsCount++;
                  });
                }
              }
              
              // Delete study areas if needed
              if (action.type === 'all' || action.type === 'study_area' || action.type === 'study_areas') {
                studyAreas.docs.forEach(doc => {
                  batch.delete(doc.ref);
                  deletedCount++;
                  studyAreasCount++;
                });
              }
            }

            await batch.commit();
            
            // Build result message
            let resultParts = [];
            if (lessonPlansCount > 0) resultParts.push(`${lessonPlansCount} lesson plans`);
            if (studyAreasCount > 0) resultParts.push(`${studyAreasCount} study areas`);
            if (studyItemsCount > 0) resultParts.push(`${studyItemsCount} study items`);
            
            const resultMessage = resultParts.length > 0 
              ? `✅ Deleted ${resultParts.join(', ')} from ${currentCertificate} curriculum`
              : `ℹ️ No items found to delete from ${currentCertificate} curriculum`;
              
            // Add result message
            responseText = responseText.trim() || resultMessage;
          } else if (action.action === 'LIST') {
            if (action.type === 'study_areas') {
              const areas = await db
                .collection('studyAreas')
                .where('cfiWorkspaceId', '==', workspaceId)
                .where('certificate', '==', currentCertificate)
                .orderBy('orderNumber')
                .get();
              
              const areaList = areas.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  name: data.name,
                  ...data
                };
              });
              
              const result = areaList.length > 0
                ? `📋 Study Areas for ${currentCertificate}:\n${areaList.map(a => `- ${a.name} (ID: ${a.id})`).join('\n')}`
                : `ℹ️ No study areas found for ${currentCertificate} certificate`;
              responseText = responseText.trim() || result;
            } else if (action.type === 'study_items') {
              const items = await db
                .collection('studyItems')
                .where('cfiWorkspaceId', '==', workspaceId)
                .get();
              
              // Also get study areas to map names
              const areas = await db
                .collection('studyAreas')
                .where('cfiWorkspaceId', '==', workspaceId)
                .get();
              
              const areaMap = new Map(areas.docs.map(doc => [doc.id, doc.data().name]));
              
              const itemList = items.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  name: data.name,
                  type: data.type,
                  studyAreaId: data.studyAreaId,
                  ...data
                };
              });
              
              const result = itemList.length > 0
                ? `📋 Study Items:\n${itemList.map(i => {
                    const areaName = areaMap.get(i.studyAreaId) || 'Unknown Area';
                    return `- ${i.name} (${i.type}) - ${areaName}`;
                  }).join('\n')}`
                : `ℹ️ No study items found`;
              responseText = responseText.trim() || result;
            } else if (action.type === 'lesson_plans') {
              const plans = await db
                .collection('lessonPlans')
                .where('cfiWorkspaceId', '==', workspaceId)
                .where('certificate', '==', currentCertificate)
                .orderBy('orderNumber')
                .get();
              
              const planList = plans.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  title: data.title,
                  orderNumber: data.orderNumber,
                  ...data
                };
              });
              
              const result = planList.length > 0
                ? `📋 Lesson Plans for ${currentCertificate}:\n${planList.map(p => `- ${p.title} (Order: ${p.orderNumber})`).join('\n')}`
                : `ℹ️ No lesson plans found for ${currentCertificate} certificate`;
              responseText = responseText.trim() || result;
            }
          } else if (action.action === 'CREATE') {
            if (action.type === 'study_area' && action.data) {
              const newArea = {
                cfiWorkspaceId: workspaceId,
                certificate: currentCertificate,
                name: action.data.name,
                orderNumber: action.data.orderNumber || 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              };
              
              const areaRef = await db.collection('studyAreas').add(newArea);
              
              const result = `✅ Created study area "${action.data.name}" (ID: ${areaRef.id})`;
              responseText = responseText.trim() || result;
            } else if (action.type === 'study_item' && action.data) {
              const newItem = {
                cfiWorkspaceId: workspaceId,
                studyAreaId: action.data.areaId || action.data.studyAreaId,
                name: action.data.name,
                type: action.data.itemType || action.data.type || 'GROUND',
                description: action.data.description || '',
                evaluationCriteria: action.data.evaluationCriteria || '',
                orderNumber: action.data.orderNumber || 0,
                acsCodeMappings: action.data.acsCodeMappings || [],
                referenceMaterials: action.data.referenceMaterials || [],
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              };
              
              const itemRef = await db.collection('studyItems').add(newItem);
              
              const result = `✅ Created study item "${action.data.name}" (ID: ${itemRef.id})`;
              responseText = responseText.trim() || result;
            } else if (action.type === 'lesson_plan' && action.data) {
              const newPlan = {
                cfiWorkspaceId: workspaceId,
                certificate: currentCertificate,
                title: action.data.title,
                motivation: action.data.motivation || '',
                objectives: action.data.objectives || [],
                itemIds: action.data.itemIds || [],
                planDescription: action.data.planDescription || '',
                referenceMaterials: action.data.referenceMaterials || [],
                preStudyHomework: action.data.preStudyHomework || '',
                estimatedDuration: action.data.estimatedDuration || { ground: 60, flight: 0 },
                orderNumber: action.data.orderNumber || 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              };
              
              const planRef = await db.collection('lessonPlans').add(newPlan);
              
              const result = `✅ Created lesson plan "${action.data.title}" (ID: ${planRef.id})`;
              responseText = responseText.trim() || result;
            }
          } else if (action.action === 'DELETE' && action.filter) {
            // Handle delete by filter (like "contains test")
            const batch = db.batch();
            let deletedCount = 0;
            let deletedNames: string[] = [];
            
            if (action.type === 'study_area' || action.type === 'study_areas') {
              const areas = await db
                .collection('studyAreas')
                .where('cfiWorkspaceId', '==', workspaceId)
                .where('certificate', '==', currentCertificate)
                .get();
              
              const areasToDelete = areas.docs.filter(doc => {
                const name = doc.data().name.toLowerCase();
                return name.includes(action.filter.toLowerCase());
              });
              
              // Delete associated items first
              for (const area of areasToDelete) {
                const items = await db
                  .collection('studyItems')
                  .where('studyAreaId', '==', area.id)
                  .get();
                
                items.docs.forEach(doc => {
                  batch.delete(doc.ref);
                });
                
                deletedNames.push(area.data().name);
              }
              
              // Delete the areas
              areasToDelete.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
              });
              
              await batch.commit();
              
              const result = deletedCount > 0
                ? `✅ Deleted ${deletedCount} study areas containing "${action.filter}": ${deletedNames.join(', ')}`
                : `ℹ️ No study areas found containing "${action.filter}"`;
                
              responseText = responseText.trim() || result;
            }
          }
        } catch (error) {
          console.error('Error parsing or executing action:', error);
        }
      }

      // Check if any action was executed that requires a refresh
      const requiresRefresh = jsonMatch && (
        action?.action === 'DELETE' || 
        action?.action === 'CREATE' || 
        action?.action === 'UPDATE'
      );

      return {
        success: true,
        response: responseText,
        usage: response.usage,
        requiresRefresh: requiresRefresh || false
      };

    } catch (error: any) {
      console.error('AI chat error:', error);
      
      if (error.status === 401) {
        throw new HttpsError('failed-precondition', 'AI service configuration error');
      } else if (error.status === 429) {
        throw new HttpsError('resource-exhausted', 'Too many requests. Please try again later.');
      } else if (error.status >= 500) {
        throw new HttpsError('unavailable', 'AI service temporarily unavailable');
      }
      
      throw new HttpsError('internal', 'Failed to process AI request');
    }
  }
);