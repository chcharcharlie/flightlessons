import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const braveApiKey = defineSecret('BRAVE_API_KEY');
const db = admin.firestore();

// ─── HTML stripping ────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s{3,}/g, '\n\n')
    .trim()
}

// ─── Tool implementations ─────────────────────────────────────────────────

async function searchFar(query: string, limit = 5): Promise<string> {
  try {
    const url = `https://www.ecfr.gov/api/search/v1/results?query=${encodeURIComponent(query)}&per_page=${limit}&title=14`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return `Search failed: HTTP ${res.status}`;
    const data: any = await res.json();
    const results = data.results || [];
    if (results.length === 0) return 'No matching FAR sections found.';
    return results.map((r: any) => {
      const part = r.hierarchy?.part || '?';
      const section = r.hierarchy?.section || '?';
      const title = r.hierarchy_headings?.section || r.headings?.section || '';
      const excerpt = r.full_text_excerpt ? stripHtml(r.full_text_excerpt).slice(0, 200) : '';
      return `§ ${section} — ${title}\n  (Part ${part})\n  ${excerpt}`;
    }).join('\n\n');
  } catch (e: any) {
    return `Search error: ${e.message}`;
  }
}

async function getFarSection(part: number, section: string): Promise<string> {
  try {
    const url = `https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-14?part=${part}&section=${section}`;
    const res = await fetch(url);
    if (!res.ok) return `Could not fetch FAR § ${section}: HTTP ${res.status}`;
    const html = await res.text();
    const text = stripHtml(html);
    // Truncate to ~3000 chars to stay within token budget
    if (text.length > 3000) return text.slice(0, 3000) + '\n[...section truncated for length]';
    return text || `FAR § ${section} not found or empty.`;
  } catch (e: any) {
    return `Fetch error for FAR § ${section}: ${e.message}`;
  }
}

async function searchFaaDocs(query: string, braveKey: string): Promise<string> {
  try {
    // Search site:faa.gov for handbooks, manuals, and guides
    const searchQuery = `${query} site:faa.gov`;
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=5&text_decorations=false`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': braveKey,
      },
    });
    if (!res.ok) return `FAA docs search failed: HTTP ${res.status}`;
    const data: any = await res.json();
    const results = data.web?.results || [];
    if (results.length === 0) return 'No FAA documentation found for this query.';
    return results.map((r: any, i: number) => {
      const snippet = r.description || r.extra_snippets?.[0] || '';
      return `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${snippet.slice(0, 300)}`;
    }).join('\n\n');
  } catch (e: any) {
    return `FAA docs search error: ${e.message}`;
  }
}

async function getAimSection(chapter: number, section: number): Promise<string> {
  try {
    const url = `https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap${chapter}_section_${section}.html`;
    const res = await fetch(url);
    if (!res.ok) return `Could not fetch AIM ${chapter}-${section}: HTTP ${res.status}`;
    const html = await res.text();
    // Extract main content area (between <body> tags)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : html;
    const text = stripHtml(body);
    if (text.length > 4000) return text.slice(0, 4000) + '\n[...section truncated for length]';
    return text || `AIM ${chapter}-${section} not found or empty.`;
  } catch (e: any) {
    return `Fetch error for AIM ${chapter}-${section}: ${e.message}`;
  }
}

// ─── Tool definitions for Claude ─────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_far',
    description: 'Search the Federal Aviation Regulations (14 CFR / FAR) to find relevant sections by keyword. Use this when you need to find which section number covers a specific topic before fetching it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search terms (e.g., "VFR weather minimums Class G", "solo flight requirements student pilot")',
        },
        limit: {
          type: 'number',
          description: 'Max number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_far_section',
    description: 'Fetch the exact, current text of a specific FAR section from the official eCFR database. Always use this when you know the section number — do not rely on memory for exact regulation text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        part: {
          type: 'number',
          description: 'FAR part number (e.g., 91 for general operating rules, 61 for pilot certification)',
        },
        section: {
          type: 'string',
          description: 'Full section number as string (e.g., "91.155", "61.109", "91.119")',
        },
      },
      required: ['part', 'section'],
    },
  },
  {
    name: 'search_faa_docs',
    description: 'Search FAA publications (PHAK, AFH, IFH, AC, etc.) on faa.gov for relevant sections on a topic. Use this when the question relates to aerodynamics, aircraft systems, flight maneuvers, weather theory, or other topics covered in FAA handbooks rather than the FARs or AIM.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search terms (e.g., "PHAK stall aerodynamics Chapter 4", "AFH crosswind landing technique", "IFH partial panel flying")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_aim_section',
    description: 'Fetch the exact, current text of a specific AIM (Aeronautical Information Manual) section from the FAA website. Use this for AIM topics like weather services, airspace procedures, emergency procedures, medical facts, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        chapter: {
          type: 'number',
          description: 'AIM chapter (1=Air Navigation, 2=Lighting, 3=Airspace, 4=ATC, 5=Procedures, 6=Emergency, 7=Safety/Weather, 8=Medical, 9=Charts, 10=Helicopters, 11=UAS)',
        },
        section: {
          type: 'number',
          description: 'Section number within the chapter',
        },
      },
      required: ['chapter', 'section'],
    },
  },
];

// ─── Citation extraction ──────────────────────────────────────────────────

function extractCitations(text: string): string[] {
  const citations: string[] = [];
  const farMatches = text.match(/(?:FAR|14 CFR|§)\s*\d+\.\d+[\w.]*/g) || [];
  const aimMatches = text.match(/AIM\s+\d+-\d+-\d+/g) || [];
  const phakMatches = text.match(/PHAK\s+Chapter\s+\d+/gi) || [];
  const afhMatches = text.match(/AFH\s+Chapter\s+\d+/gi) || [];
  const ifhMatches = text.match(/IFH\s+Chapter\s+\d+/gi) || [];
  const acMatches = text.match(/AC\s+\d{2}-\d+[A-Z]?/g) || [];
  const acsMatches = text.match(/(?:PPL|Instrument|Commercial)\s+ACS/g) || [];
  citations.push(...farMatches, ...aimMatches, ...phakMatches, ...afhMatches, ...ifhMatches, ...acMatches, ...acsMatches);
  return [...new Set(citations)];
}

// ─── Main Function ────────────────────────────────────────────────────────

export const studentAiTutor = onCall(
  {
    timeoutSeconds: 180,
    memory: '512MiB',
    cors: true,
    secrets: [anthropicApiKey, braveApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { message, sessionId, programCertificate } = request.data;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw new HttpsError('invalid-argument', 'Message is required');
    }

    // Verify student role
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'STUDENT') {
      throw new HttpsError('permission-denied', 'Only students can use the AI Tutor');
    }

    const userData = userDoc.data()!;
    const cfiWorkspaceId = userData.cfiWorkspaceId;
    if (!cfiWorkspaceId) {
      throw new HttpsError('failed-precondition', 'Student is not enrolled in any workspace');
    }

    // Get or create session
    let activeSessionId = sessionId;
    let sessionRef: admin.firestore.DocumentReference;

    if (!activeSessionId) {
      sessionRef = await db.collection('aiTutorSessions').add({
        studentUid: request.auth.uid,
        cfiWorkspaceId,
        programCertificate: programCertificate || 'PRIVATE',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        messageCount: 0,
        title: message.slice(0, 50).trim(),
      });
      activeSessionId = sessionRef.id;
    } else {
      sessionRef = db.collection('aiTutorSessions').doc(activeSessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists || sessionDoc.data()?.studentUid !== request.auth.uid) {
        throw new HttpsError('permission-denied', 'Session not found or access denied');
      }
    }

    // Save user message
    const messagesRef = sessionRef.collection('messages');
    await messagesRef.add({
      role: 'user',
      content: message.trim(),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Load conversation history (last 10 messages, exclude current)
    const historySnapshot = await messagesRef
      .orderBy('timestamp', 'desc')
      .limit(11)
      .get();

    const allMsgs = historySnapshot.docs.reverse();
    // Exclude the most recent (current user message we just saved)
    const historyMsgs = allMsgs.slice(0, -1);

    const conversationHistory: Anthropic.MessageParam[] = historyMsgs
      .filter(doc => doc.data().role === 'user' || doc.data().role === 'assistant')
      .map(doc => ({
        role: doc.data().role as 'user' | 'assistant',
        content: doc.data().content,
      }));

    // Add current message
    conversationHistory.push({ role: 'user', content: message.trim() });

    // System prompt
    const certLabel: Record<string, string> = {
      PRIVATE: 'Private Pilot (PPL)',
      INSTRUMENT: 'Instrument Rating (IR)',
      COMMERCIAL: 'Commercial Pilot (CPL)',
    };
    const certName = certLabel[programCertificate || 'PRIVATE'] || 'Private Pilot';

    const systemPrompt = `You are an AI aviation study tutor for student pilots working toward their ${certName} certificate.

You have access to four tools to look up the latest official regulations and guidance:
- search_far: Search FAR sections by keyword
- get_far_section: Fetch the exact current text of a specific FAR section from eCFR
- get_aim_section: Fetch the exact current text of a specific AIM section from FAA
- search_faa_docs: Search FAA handbooks and publications (PHAK, AFH, IFH, ACs, etc.) on faa.gov

## AIM Chapter Reference
1 = Air Navigation (VOR, GPS, ILS, NDB)
2 = Aeronautical Lighting & Airport Visual Aids (VASI, PAPI, runway lights)
3 = Airspace (Class A-G, SUA, MOA, ADIZ, TFR)
4 = Air Traffic Control (services, towers, clearances, phraseology)
5 = Air Traffic Procedures (preflight, departure, en route, arrival, IFR)
6 = Emergency Procedures (signals, ELT, distress, lost comms)
7 = Safety of Flight (weather, turbulence, wind shear, wake turbulence, LAHSO)
8 = Medical Facts (hypoxia, hyperventilation, spatial disorientation, IMSAFE)
9 = Aeronautical Charts (symbols, NOTAMs, chart types)
10 = Helicopter Operations
11 = Unmanned Aircraft Systems

## FAA Handbooks (your native knowledge is reliable for these — cite chapter)
- **PHAK** (Pilot's Handbook of Aeronautical Knowledge): aerodynamics, atmosphere, weather theory, engines, airspace, charts, flight instruments, human factors. Cite as "PHAK Chapter X".
- **AFH** (Airplane Flying Handbook): takeoffs, landings, maneuvers, slow flight, stalls, emergency procedures, performance. Cite as "AFH Chapter X".
- **IFH** (Instrument Flying Handbook): instrument procedures, approaches, partial panel, holding, weather. Cite as "IFH Chapter X".
- **ACS** (Airman Certification Standards): checkride standards, task elements, risk management. Cite as "PPL ACS / Instrument ACS".
- **AC** (Advisory Circulars): guidance on specific topics (e.g., AC 00-6 Aviation Weather, AC 61-65 Certificates). Cite as "AC XX-XXX".

## Rules
1. **FAR/AIM**: ALWAYS use tools to fetch current official text. Never rely on training data for exact regulation wording.
2. **PHAK/AFH/IFH/ACS**: Use your native knowledge — it's comprehensive and reliable. Use search_faa_docs if you need to verify a specific detail or find a source URL.
3. Cite sources clearly: "per FAR 91.155", "per AIM 7-1-2", "PHAK Chapter 4", "AFH Chapter 8".
4. If a tool returns an error, offer your best general knowledge with a caveat.
5. If uncertain which FAR section covers a topic, use search_far first.
6. Keep answers educational and focused. End with a follow-up question or suggestion when helpful.
7. Always respond in the same language the student uses.`;

    // Initialize Anthropic client
    const apiKey = anthropicApiKey.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'AI service not configured');
    const braveKey = braveApiKey.value();
    const anthropic = new Anthropic({ apiKey });

    // Agentic loop with tool use
    let messages: Anthropic.MessageParam[] = [...conversationHistory];
    let responseText = '';

    try {
      let response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      // Tool use loop
      while (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            let result = '';
            const input = block.input as any;

            if (block.name === 'search_far') {
              result = await searchFar(input.query, input.limit);
            } else if (block.name === 'get_far_section') {
              result = await getFarSection(input.part, input.section);
            } else if (block.name === 'get_aim_section') {
              result = await getAimSection(input.chapter, input.section);
            } else if (block.name === 'search_faa_docs') {
              result = await searchFaaDocs(input.query, braveKey);
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        // Append assistant turn + tool results and continue
        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ];

        response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          system: systemPrompt,
          tools: TOOLS,
          messages,
        });
      }

      // Extract final text response
      for (const block of response.content) {
        if (block.type === 'text') responseText += block.text;
      }
    } catch (error: any) {
      console.error('Anthropic API error:', error);
      if (error.status === 429) {
        throw new HttpsError('resource-exhausted', 'Too many requests. Please try again shortly.');
      }
      throw new HttpsError('internal', 'AI service error');
    }

    // Extract citations from response text
    const citations = extractCitations(responseText);

    // Save AI response
    await messagesRef.add({
      role: 'assistant',
      content: responseText,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      citations,
    });

    // Update session metadata
    await sessionRef.update({
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      messageCount: admin.firestore.FieldValue.increment(2),
    });

    return { success: true, response: responseText, sessionId: activeSessionId, citations };
  }
);
