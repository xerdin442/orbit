import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';
import { WorkbenchService } from './workbench.service';
import { ExecuteQueryDto } from './dto/query.dto';
import { BrowseTableDto } from './dto/browse-table.dto';

@Controller('resources/:id')
@UseGuards(JwtAuthGuard)
export class WorkbenchController {
  constructor(private readonly workbench: WorkbenchService) {}

  @Get('schema')
  getSchema(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.workbench.getSchema(id, req.user.id);
  }

  @Get('tables')
  getTables(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.workbench.getTables(id, req.user.id);
  }

  @Get('tables/:name')
  getTableData(
    @Param('id') id: string,
    @Param('name') name: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: BrowseTableDto,
  ) {
    return this.workbench.getTableData(id, req.user.id, name, {
      page: query.page,
      limit: query.limit,
      sort: query.sort ? this.parseSort(query.sort) : undefined,
      filter: query.filter
        ? (JSON.parse(query.filter) as Record<string, unknown>)
        : undefined,
    });
  }

  @Post('query')
  executeQuery(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ExecuteQueryDto,
  ) {
    return this.workbench.executeQuery(id, req.user.id, dto.query);
  }

  private parseSort(
    sort: string,
  ): { column: string; direction: 'asc' | 'desc' }[] {
    return sort.split(',').map((part) => {
      const [column, direction = 'asc'] = part.trim().split(':');
      return {
        column,
        direction: direction.toLowerCase() as 'asc' | 'desc',
      };
    });
  }
}
