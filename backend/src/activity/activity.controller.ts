import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityType } from '@generated/client';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { ParseActivityTypePipe } from '@src/common/pipes/activity-type.pipe';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  findByType(@Query('type', ParseActivityTypePipe) type: ActivityType) {
    return this.activity.findByType(type);
  }
}
