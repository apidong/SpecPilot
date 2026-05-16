import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../../database/entities/user.entity.js';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('api/projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.projectsService.findAll(user.id, Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.projectsService.findOne(id, user.id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.projectsService.remove(id, user.id);
  }

  @Post(':id/clone')
  clone(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const workspaceRoot = this.config.get<string>('WORKSPACE_ROOT', './storage/app/workspaces');
    return this.projectsService.cloneRepository(id, user.id, workspaceRoot);
  }

  @Post(':id/sync')
  sync(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const workspaceRoot = this.config.get<string>('WORKSPACE_ROOT', './storage/app/workspaces');
    return this.projectsService.syncRepository(id, user.id, workspaceRoot);
  }
}
