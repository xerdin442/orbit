import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('environments/:id/requests/stream')
  async stream(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('id') id: string,
  ): Promise<void> {
    const stream = await this.requestLogs.subscribeForUser(id, req.user.id);

    res.writeHead(HttpStatus.OK, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(': connected\n\n');

    // Keep the connection alive through long quiet stretches where no log entry is emitted for a while.
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    const sent = new Set<string>();
    const send = (entry: RequestLog) => {
      if (sent.has(entry.id)) return;
      sent.add(entry.id);
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    let replaying = true;
    const pending: RequestLog[] = [];

    const subscription = stream.subscribe({
      next: (entry) => (replaying ? pending.push(entry) : send(entry)),
      complete: () => {
        clearInterval(heartbeat);
        res.end();
      },
    });

    const backlog = await this.requestLogs.getRecent(id);
    for (const entry of backlog) send(entry);

    replaying = false;
    for (const entry of pending) send(entry);

    req.on('close', () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
    });
  }
}
