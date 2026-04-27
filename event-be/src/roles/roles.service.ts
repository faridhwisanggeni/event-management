import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active roles, ordered for UI dropdowns. */
  list(): Promise<Role[]> {
    return this.prisma.role.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  findByCodes(codes: string[]): Promise<Role[]> {
    if (!codes.length) return Promise.resolve([]);
    return this.prisma.role.findMany({ where: { code: { in: codes } } });
  }
}
