import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const CONCIERGE_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_attendees',
      description:
        'Find attendees at the same event whose profile/intent matches the user query. ' +
        'Combines semantic similarity (pgvector) with keyword/role/skill filters.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural-language description of who to look for.',
          },
          roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional filter on attendee role enum values.',
          },
          skills: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional filter on skills (any-overlap).',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            default: 5,
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'score_match',
      description:
        'Score how well a candidate matches the asking attendee. Returns score 0-100, ' +
        'a short rationale, and shared_ground bullet points.',
      parameters: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string', description: 'Attendee id to score.' },
          intent: { type: 'string', description: 'What the asker is looking for.' },
        },
        required: ['candidate_id', 'intent'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_intro_message',
      description:
        'Draft a short, personalized outreach message the asker can send to a candidate.',
      parameters: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string' },
          context: {
            type: 'string',
            description: 'Why the asker wants to reach out (1-2 sentences).',
          },
        },
        required: ['candidate_id', 'context'],
        additionalProperties: false,
      },
    },
  },
];

export type ConciergeToolName = 'search_attendees' | 'score_match' | 'draft_intro_message';
