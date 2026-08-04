import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { FilterActivityLogsDto } from './dto/activity-log.dto';
import type { AuthenticatedRequest } from '@src/common/types';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  findLogs(
    @Req() req: AuthenticatedRequest,
    @Query() dto: FilterActivityLogsDto,
  ) {
    return this.activity.findLogs(req.user.id, dto);
  }
}
