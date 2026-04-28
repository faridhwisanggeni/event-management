import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { LlmService } from '../../../llm/llm.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SearchAttendeesInput {
  query: string;
  roles?: string[];
  skills?: string[];
  limit?: number;
}

export interface SearchAttendeesCandidate {
  id: string;
  name: string;
  headline: string | null;
  company: string | null;
  role: string | null;
  skills: string[];
  lookingFor: string | null;
  similarity: number | null;
}

export interface SearchAttendeesResult {
  candidates: SearchAttendeesCandidate[];
  mode: 'semantic+keyword' | 'semantic-only' | 'keyword-only';


  filtersDropped?: { roles?: boolean; skills?: boolean };
}

@Injectable()
export class SearchAttendeesTool {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async run(
    input: SearchAttendeesInput,
    ctx: { eventId: string; askerAttendeeId: string },
  ): Promise<SearchAttendeesResult> {
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
    const roles = input.roles?.length ? input.roles : null;
    const skills = input.skills?.length ? input.skills : null;

    if (this.llm.isEnabled()) {
      try {
        const queryVec = await this.llm.embed(input.query);


        let rows = await this.semanticQuery(queryVec, ctx, limit, roles, skills);
        if (rows.length > 0) {
          return { mode: 'semantic+keyword', candidates: rows.map(this.toCandidate) };
        }




        if (roles || skills) {
          rows = await this.semanticQuery(queryVec, ctx, limit, null, null);
          if (rows.length > 0) {
            return {
              mode: 'semantic-only',
              candidates: rows.map(this.toCandidate),
              filtersDropped: {
                roles: !!roles,
                skills: !!skills,
              },
            };
          }
        }
      } catch {

      }
    }

    const where: Prisma.AttendeeWhereInput = {
      eventId: ctx.eventId,
      openToChat: true,
      id: { not: ctx.askerAttendeeId },
    };
    if (roles) where.role = { code: { in: roles } };
    if (skills) where.skills = { hasSome: skills };

    const data = await this.prisma.attendee.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      mode: 'keyword-only',
      candidates: data.map((a) => ({
        id: a.id,
        name: a.name,
        headline: a.headline,
        company: a.company,
        role: a.role?.code ?? null,
        skills: a.skills,
        lookingFor: a.lookingFor,
        similarity: null,
      })),
    };
  }


  private async semanticQuery(
    queryVec: number[],
    ctx: { eventId: string; askerAttendeeId: string },
    limit: number,
    roles: string[] | null,
    skills: string[] | null,
  ) {
    const literal = `[${queryVec.join(',')}]`;
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        headline: string | null;
        company: string | null;
        role_code: string | null;
        skills: string[];
        looking_for: string | null;
        distance: number;
      }>
    >(Prisma.sql`
      SELECT a.id, a.name, a.headline, a.company,
             r.code AS role_code, a.skills, a.looking_for,
             (a.embedding <=> ${literal}::vector) AS distance
      FROM attendees a
      LEFT JOIN attendee_roles r ON r.id = a.role_id
      WHERE a.event_id = ${ctx.eventId}::uuid
        AND a.id <> ${ctx.askerAttendeeId}::uuid
        AND a.open_to_chat = TRUE
        AND a.embedding IS NOT NULL
        ${roles ? Prisma.sql`AND r.code = ANY(${roles})` : Prisma.empty}
        ${skills ? Prisma.sql`AND a.skills && ${skills}` : Prisma.empty}
      ORDER BY a.embedding <=> ${literal}::vector ASC
      LIMIT ${limit}
    `);
  }

  private toCandidate = (r: {
    id: string;
    name: string;
    headline: string | null;
    company: string | null;
    role_code: string | null;
    skills: string[];
    looking_for: string | null;
    distance: number;
  }): SearchAttendeesCandidate => ({
    id: r.id,
    name: r.name,
    headline: r.headline,
    company: r.company,
    role: r.role_code,
    skills: r.skills,
    lookingFor: r.looking_for,
    similarity: 1 - Number(r.distance),
  });
}
