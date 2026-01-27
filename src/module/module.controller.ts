import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ModuleService } from './module.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Modules')
@Controller('courses/:courseId/modules')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new module' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Module created successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Course not found',
  })
  create(
    @Param('courseId') courseId: string,
    @Body() createModuleDto: CreateModuleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.moduleService.createModule(courseId, createModuleDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all modules for a course' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Modules retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Course not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Course is not published',
  })
  findAll(
    @Param('courseId') courseId: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.moduleService.findAllModules(courseId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get module by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Module is not accessible',
  })
  findOne(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return this.moduleService.findModuleById(id, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a module' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module updated successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  update(
    @Param('id') id: string,
    @Body() updateModuleDto: UpdateModuleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.moduleService.updateModule(id, updateModuleDto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a module' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Module deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.moduleService.deleteModule(id, userId);
  }

  @Put('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reorder modules' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Modules reordered successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid module IDs',
  })
  reorder(
    @Param('courseId') courseId: string,
    @Body('moduleIds') moduleIds: string[],
    @CurrentUser('id') userId: string,
  ) {
    return this.moduleService.reorderModules(courseId, moduleIds, userId);
  }
}
