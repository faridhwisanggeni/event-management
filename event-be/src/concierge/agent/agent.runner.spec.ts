import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentRunner } from './agent.runner';
import { DraftIntroTool } from './tools/draft-intro.tool';
import { ScoreMatchTool } from './tools/score-match.tool';
import { SearchAttendeesTool } from './tools/search-attendees.tool';

const prismaStub = {
  role: { findMany: jest.fn().mockResolvedValue([]) },
} as unknown as PrismaService;

describe('AgentRunner', () => {
  function makeChoice(content: string | null, toolCalls: unknown[] | null = null) {
    return {
      latencyMs: 10,
      promptTokens: 50,
      completionTokens: 20,
      completion: {
        choices: [
          {
            message: {
              content,
              tool_calls: toolCalls,
            },
          },
        ],
      },
    } as never;
  }

  function buildToolCall(id: string, name: string, args: unknown) {
    return {
      id,
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    };
  }

  it('drives a full search → score → draft → final loop and aggregates matches', async () => {
    const llm = {
      isEnabled: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()

        .mockResolvedValueOnce(
          makeChoice(null, [buildToolCall('c1', 'search_attendees', { query: 'ai cofounder' })]),
        )

        .mockResolvedValueOnce(
          makeChoice(null, [
            buildToolCall('c2', 'score_match', { candidate_id: 'a1', intent: 'cofounder' }),
          ]),
        )

        .mockResolvedValueOnce(
          makeChoice(null, [
            buildToolCall('c3', 'draft_intro_message', {
              candidate_id: 'a1',
              context: 'AI cofounder',
            }),
          ]),
        )

        .mockResolvedValueOnce(makeChoice('Top match: Sarah (92%).')),
    } as unknown as LlmService;

    const search = {
      run: jest.fn().mockResolvedValue({
        mode: 'semantic+keyword',
        candidates: [{ id: 'a1', name: 'Sarah', headline: 'Founder' }],
      }),
    };
    const score = {
      run: jest.fn().mockResolvedValue({
        candidate_id: 'a1',
        score: 92,
        rationale: 'Strong overlap',
        shared_ground: ['B2B SaaS', 'Indonesia'],
        source: 'fallback',
      }),
    };
    const draft = {
      run: jest
        .fn()
        .mockResolvedValue({ candidate_id: 'a1', message: 'Hi Sarah — saw your talk...' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentRunner,
        { provide: ConfigService, useValue: { get: () => '6' } },
        { provide: LlmService, useValue: llm },
        { provide: PrismaService, useValue: prismaStub },
        { provide: SearchAttendeesTool, useValue: search },
        { provide: ScoreMatchTool, useValue: score },
        { provide: DraftIntroTool, useValue: draft },
      ],
    }).compile();

    const runner = moduleRef.get(AgentRunner);

    const result = await runner.run([], 'Find me an AI cofounder', {
      eventId: 'e1',
      askerAttendeeId: 'me',
    });

    expect(llm.chat).toHaveBeenCalledTimes(4);
    expect(search.run).toHaveBeenCalled();
    expect(score.run).toHaveBeenCalled();
    expect(draft.run).toHaveBeenCalled();
    expect(result.finalText).toBe('Top match: Sarah (92%).');
    expect(result.matches).toEqual([
      expect.objectContaining({
        score: 92,
        shared_ground: ['B2B SaaS', 'Indonesia'],
        draft_intro: 'Hi Sarah — saw your talk...',
        candidate: expect.objectContaining({ id: 'a1' }),
      }),
    ]);

    expect(result.newMessages).toHaveLength(7);
  });

  it('returns a budget-exceeded reply when max iterations is reached', async () => {
    const llm = {
      isEnabled: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
        .mockResolvedValue(
          makeChoice(null, [buildToolCall('c', 'search_attendees', { query: 'x' })]),
        ),
    } as unknown as LlmService;

    const search = {
      run: jest.fn().mockResolvedValue({ mode: 'keyword-only', candidates: [] }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentRunner,
        { provide: ConfigService, useValue: { get: () => '2' } },
        { provide: LlmService, useValue: llm },
        { provide: PrismaService, useValue: prismaStub },
        { provide: SearchAttendeesTool, useValue: search },
        { provide: ScoreMatchTool, useValue: { run: jest.fn() } },
        { provide: DraftIntroTool, useValue: { run: jest.fn() } },
      ],
    }).compile();

    const runner = moduleRef.get(AgentRunner);
    const result = await runner.run([], 'q', { eventId: 'e', askerAttendeeId: 'a' });

    expect(llm.chat).toHaveBeenCalledTimes(2);
    expect(result.finalText).toMatch(/reasoning budget/i);
  });
});
