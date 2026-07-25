import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DomainsService } from './domains.service';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';
import { AddDomainDto } from './dto/domain.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Post('environments/:id/domains')
  addDomain(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AddDomainDto,
  ) {
    return this.domains.addCustomDomain(id, dto.hostname, req.user.id);
  }

  @Get('environments/:id/domains')
  listDomains(@Param('id') id: string) {
    return this.domains.findByEnvironment(id);
  }

  @Delete('domains/:id')
  deleteDomain(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.domains.deleteDomain(id, req.user.id);
  }
}
