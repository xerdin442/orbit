import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { RequestLog } from '@generated/client';
import { JwtAuthGuard } from '@src/common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';
import { RequestLogsService } from './request-logs.service';
import { FilterRequestLogsDto } from './dto/request-log.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class RequestLogsController {
  constructor(private readonly requestLogs: RequestLogsService) {}

  @Get('environments/:id/requests')
  list(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() filters: FilterRequestLogsDto,
  ) {
    return this.requestLogs.findByEnvironment(id, req.user.id, filters);
  }

  @Sse('environments/:id/requests/stream')
  async stream(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<Observable<{ data: RequestLog }>> {
    const stream = await this.requestLogs.subscribeForUser(id, req.user.id);
    return stream.pipe(map((entry) => ({ data: entry })));
  }
}
