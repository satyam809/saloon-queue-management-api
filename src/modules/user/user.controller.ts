import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiAuthErrors,
  ApiCommonErrors,
  ApiConflictErrors,
  ApiCreatedWrapped,
  ApiOkWrapped,
  ApiPaginatedResponse,
} from '@common/swagger/decorators';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permission } from '@common/enums/permission.enum';
import { Role } from '@common/enums/role.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ─── Own profile ──────────────────────────────────────────────────────────
  // Placed BEFORE /:id routes so 'me' is not parsed as a UUID parameter.

  /**
   * GET /users/me
   * Any authenticated user can retrieve their own profile.
   * No permission check needed — the route is scoped by the JWT sub claim.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user\'s own profile' })
  @ApiOkWrapped(UserResponseDto)
  @ApiAuthErrors()
  getMe(@CurrentUser('sub') userId: string): Promise<UserResponseDto> {
    return this.userService.findMe(userId);
  }

  @Put('me')
  @ApiOperation({
    summary: 'Update own profile (name, phone, avatarUrl)',
    description:
      'Users can only change name, phone, and avatarUrl. ' +
      'To change email or role, an admin must use PUT /users/:id.',
  })
  @ApiOkWrapped(UserResponseDto)
  @ApiCommonErrors()
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateProfile(userId, dto);
  }

  // ─── Admin: list all users ─────────────────────────────────────────────────

  /**
   * GET /users
   * Visibility is role-scoped inside the service:
   *   SUPER_ADMIN      → all users
   *   ONBOARDING_STAFF → all except SUPER_ADMIN / ONBOARDING_STAFF
   *   SALON_OWNER/STAFF → customers only
   */
  @Get()
  @RequirePermissions(Permission.USER_READ_ALL)
  @ApiOperation({
    summary: 'List users with search, filter, sort, and pagination',
    description:
      'Results are scoped by the caller\'s role. ' +
      'Supports ?search=, ?role=, ?status=, ?sortBy=, ?sortOrder=, ?page=, ?limit=',
  })
  @ApiPaginatedResponse(UserResponseDto)
  @ApiAuthErrors()
  findAll(
    @Query() query: UserQueryDto,
    @CurrentUser() requester: JwtPayload,
  ) {
    return this.userService.findAll(query, requester);
  }

  // ─── Admin: create user ────────────────────────────────────────────────────

  /**
   * POST /users
   * Admin-created accounts — e.g., creating staff or onboarding-staff accounts.
   * Regular sign-up goes through POST /auth/register.
   */
  @Post()
  @RequirePermissions(Permission.USER_CREATE)
  @ApiOperation({
    summary: 'Create a user account (admin)',
    description:
      'Admins create accounts with specific roles. ' +
      'Only SUPER_ADMIN can assign SUPER_ADMIN role.',
  })
  @ApiCreatedWrapped(UserResponseDto)
  @ApiCommonErrors()
  @ApiConflictErrors()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.userService.create(dto, requester);
  }

  // ─── Admin: single user ────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions(Permission.USER_READ_ALL)
  @ApiOperation({
    summary: 'Get any user by ID (admin)',
    description: 'Access is scoped by the caller\'s role (see service for visibility rules).',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkWrapped(UserResponseDto)
  @ApiCommonErrors()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.userService.findOne(id, requester);
  }

  @Put(':id')
  @RequirePermissions(Permission.USER_UPDATE_ANY)
  @ApiOperation({
    summary: 'Admin: update any user\'s account fields',
    description:
      'Allows changing role, status, email, name, phone. ' +
      'Set status=SUSPENDED with optional suspendReason to suspend; ' +
      'set status=ACTIVE to reactivate. ' +
      'Only SUPER_ADMIN can assign or modify SUPER_ADMIN accounts.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkWrapped(UserResponseDto)
  @ApiCommonErrors()
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.userService.adminUpdate(id, dto, requester);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * DELETE /users/:id
   * Soft delete — sets deletedAt, preserves the row.
   * The user will receive 401 on their next request (DB lookup finds no active user).
   */
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a user (SUPER_ADMIN only)',
    description:
      'Sets deletedAt timestamp. The row is preserved but the account is inaccessible. ' +
      'Cannot delete your own account.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiNoContentResponse({ description: 'User deleted.' })
  @ApiCommonErrors()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<void> {
    return this.userService.remove(id, requester);
  }
}
