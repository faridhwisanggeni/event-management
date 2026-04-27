import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';

import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(): Promise<Role[]> {
    return this.roles.list();
  }
}
