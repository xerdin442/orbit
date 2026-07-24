import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { ParseResourceTypeArrayPipe } from '@src/common/pipes/resource-type-array.pipe';
import type { AuthenticatedRequest } from '@src/common/types';
import { ResourceType } from '@generated/client';

class CreateResourceDto {
  type: ResourceType;
  name: string;
  credentials?: Record<string, string>;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get('resources/defaults')
  getDefaults(
    @Query('type', ParseResourceTypeArrayPipe) types: ResourceType[],
  ) {
    return this.resources.getDefaults(types);
  }

  @Post('environments/:environmentId/resources')
  create(
    @Param('environmentId') environmentId: string,
    @Body() dto: CreateResourceDto,
  ) {
    return this.resources.create(
      environmentId,
      dto.type,
      dto.name,
      dto.credentials,
    );
  }

  @Get('resources/:id')
  findOne(@Param('id') id: string) {
    return this.resources.findById(id);
  }

  @Delete('resources/:id')
  delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.resources.delete(id, req.user.id);
  }
}
