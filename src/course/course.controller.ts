import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseFilterDto } from './dto/course-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';

@ApiTags('Courses')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new course' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Course created successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  create(
    @CurrentUser('id') userId: string,
    @Body() createCourseDto: CreateCourseDto,
  ) {
    return this.courseService.createCourse(userId, createCourseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all courses with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Courses retrieved successfully',
  })
  findAll(@Query() filter: CourseFilterDto) {
    return this.courseService.findAllCourses(filter);
  }

  @Get('my-courses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get courses created by the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Courses retrieved successfully',
  })
  findMyCourses(
    @CurrentUser('id') userId: string,
    @Query() filter: CourseFilterDto,
  ) {
    return this.courseService.findAllCourses({
      ...filter,
      instructorId: userId,
    });
  }

  @Get('enrolled')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get courses the user is enrolled in' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrolled courses retrieved successfully',
  })
  findEnrolledCourses(@CurrentUser('id') userId: string) {
    return this.courseService.getUserEnrollments(userId);
  }

  @Get(':identifier')
  @ApiOperation({ summary: 'Get course by ID or slug' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Course retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Course not found',
  })
  findOne(@Param('identifier') identifier: string) {
    return this.courseService.findCourseByIdOrSlug(identifier);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a course' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Course updated successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Course not found',
  })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') courseId: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    return this.courseService.updateCourse(userId, courseId, updateCourseDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a course' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Course deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Course not found',
  })
  remove(@CurrentUser('id') userId: string, @Param('id') courseId: string) {
    return this.courseService.deleteCourse(userId, courseId);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Publish a course' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Course published successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Course not found',
  })
  publish(@CurrentUser('id') userId: string, @Param('id') courseId: string) {
    return this.courseService.publishCourse(userId, courseId);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Unpublish a course' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Course unpublished successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Course not found',
  })
  unpublish(@CurrentUser('id') userId: string, @Param('id') courseId: string) {
    return this.courseService.unpublishCourse(userId, courseId);
  }

  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Enroll in a course' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Successfully enrolled in course',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Course not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Already enrolled or course not published',
  })
  enroll(@CurrentUser('id') userId: string, @Param('id') courseId: string) {
    return this.courseService.enrollInCourse(userId, courseId);
  }

  @Delete(':id/enroll')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Unenroll from a course' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Successfully unenrolled from course',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Enrollment not found',
  })
  unenroll(@CurrentUser('id') userId: string, @Param('id') courseId: string) {
    return this.courseService.unenrollFromCourse(userId, courseId);
  }

  @Get(':id/enrollments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get course enrollments (for instructors/admins)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrollments retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  getEnrollments(
    @CurrentUser('id') userId: string,
    @Param('id') courseId: string,
  ) {
    return this.courseService.getCourseEnrollments(courseId, userId);
  }

  @Patch(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update enrollment progress' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Progress updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Enrollment not found',
  })
  updateProgress(
    @CurrentUser('id') userId: string,
    @Param('id') courseId: string,
    @Body('progress') progress: number,
  ) {
    return this.courseService.updateEnrollmentProgress(
      userId,
      courseId,
      progress,
    );
  }
}
