// src/notifications/notification.controller.ts
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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationService, PaginationMeta } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationFiltersDto } from './dto/notification-filters.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { NotificationMetadata } from './types/notification.types';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.INSTRUCTOR)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a notification',
    description: 'Create a notification for a user (Admins/Instructors only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Notification successfully created',
    type: NotificationResponseDto,
  })
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser('id') userId: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationService.create(userId, createNotificationDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get notifications',
    description: 'Retrieves user notifications with filtering and pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications successfully retrieved',
  })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() filters: NotificationFiltersDto,
  ): Promise<{ data: NotificationResponseDto[]; meta: PaginationMeta }> {
    return this.notificationService.findByUser(userId, filters);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Retrieves the number of unread notifications for the user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Count successfully retrieved',
  })
  async getUnreadCount(
    @CurrentUser('id') userId: string,
  ): Promise<{ count: number }> {
    return this.notificationService.getUnreadCount(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get a single notification',
    description: 'Retrieves a specific notification by ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification successfully retrieved',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to access this notification',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationService.findOne(id, userId);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Marks a specific notification as read',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification marked as read',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Marks all notifications for the current user as read',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All notifications marked as read',
  })
  async markAllAsRead(
    @CurrentUser('id') userId: string,
  ): Promise<{ count: number }> {
    return this.notificationService.markAllAsRead(userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete a notification',
    description: 'Deletes a specific notification',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Notification successfully deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.notificationService.remove(id, userId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete all notifications',
    description: 'Deletes all notifications for the user',
  })
  @ApiQuery({
    name: 'readOnly',
    required: false,
    type: Boolean,
    description: 'Only delete notifications that have been read',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications successfully deleted',
  })
  async removeAll(
    @CurrentUser('id') userId: string,
    @Query('readOnly') readOnly?: boolean,
  ): Promise<{ count: number }> {
    return this.notificationService.removeAll(userId, readOnly);
  }

  @Post('system')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Send system notification',
    description: 'Sends a system notification to multiple users (Admins only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'System notifications successfully sent',
  })
  async sendSystemNotification(
    @Body()
    body: {
      userIds: string[];
      title: string;
      message: string;
      metadata?: NotificationMetadata;
    },
  ): Promise<void> {
    return this.notificationService.createSystemNotification(
      body.userIds,
      body.title,
      body.message,
      body.metadata,
    );
  }
}
