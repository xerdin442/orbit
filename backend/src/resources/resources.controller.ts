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
import { CreateResourceDto } from './dto/resource.dto';

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
    @Req() req: AuthenticatedRequest,
    @Param('environmentId') environmentId: string,
    @Body() dto: CreateResourceDto,
  ) {
    return this.resources.create(
      environmentId,
      req.user.id,
      dto.type,
      dto.name,
      dto.credentials,
    );
  }

  @Get('environments/:environmentId/resources')
  findByEnvironment(
    @Req() req: AuthenticatedRequest,
    @Param('environmentId') environmentId: string,
  ) {
    return this.resources.findByEnvironment(environmentId, req.user.id);
  }

  @Get('resources/:id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.resources.findById(id, req.user.id);
  }

  @Post('resources/:id/clear')
  clearData(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.resources.clearData(id, req.user.id);
  }

  @Delete('resources/:id')
  delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.resources.delete(id, req.user.id);
  }
}
