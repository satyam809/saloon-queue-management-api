import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { comparePassword, hashPassword } from '@shared/utils/hash.util';
import { paginate } from '@shared/utils/pagination.util';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { Role } from '@common/enums/role.enum';
import { UserStatus } from '@common/enums/status.enum';
import { Permission } from '@common/enums/permission.enum';
import { canPerform } from '@common/rbac/rbac.util';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateUserDto, requester?: JwtPayload): Promise<UserResponseDto> {
    await this.assertEmailUnique(dto.email);

    // Only SUPER_ADMIN can assign elevated roles during creation
    let role = dto.role ?? Role.CUSTOMER;
    if (
      role !== Role.CUSTOMER &&
      requester?.role !== Role.SUPER_ADMIN
    ) {
      role = Role.CUSTOMER;
    }

    const user = this.userRepo.create({
      name:         dto.name,
      email:        dto.email,
      phone:        dto.phone ?? null,
      role,
      passwordHash: await hashPassword(dto.password),
    });

    return UserResponseDto.from(await this.userRepo.save(user));
  }

  // ─── Read: list with search, filter, sort, paginate ──────────────────────

  async findAll(
    query: UserQueryDto,
    requester: JwtPayload,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL');

    // ── Role-based visibility scope ─────────────────────────────────────────
    this.applyVisibilityScope(qb, requester);

    // ── Search ──────────────────────────────────────────────────────────────
    if (query.search?.trim()) {
      qb.andWhere(
        '(user.name LIKE :search OR user.email LIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    // ── Filters ─────────────────────────────────────────────────────────────
    if (query.role) {
      // Non-admins cannot filter to roles outside their visibility scope
      this.assertRoleVisibility(query.role, requester);
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    // ── Sort ────────────────────────────────────────────────────────────────
    const sortField = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    // Whitelist validated in UserQueryDto via @IsIn([...])
    qb.orderBy(`user.${sortField}`, sortOrder);

    // ── Paginate ────────────────────────────────────────────────────────────
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return paginate(
      data.map(UserResponseDto.from),
      total,
      query.page,
      query.limit,
    );
  }

  // ─── Read: single user ────────────────────────────────────────────────────

  async findOne(id: string, requester: JwtPayload): Promise<UserResponseDto> {
    const user = await this.findEntityOrFail(id);
    this.assertReadAccess(user, requester);
    return UserResponseDto.from(user);
  }

  /** Own profile — no access control needed beyond being authenticated. */
  async findMe(userId: string): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.findEntityOrFail(userId));
  }

  // ─── Update: own profile ──────────────────────────────────────────────────

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.findEntityOrFail(userId);

    if (dto.phone && dto.phone !== user.phone) {
      await this.assertPhoneUnique(dto.phone, userId);
    }

    if (dto.newPassword) {
      const valid = await comparePassword(dto.currentPassword!, user.passwordHash);
      if (!valid) {
        throw new BadRequestException('Current password is incorrect');
      }
      user.passwordHash = await hashPassword(dto.newPassword);
    }

    const { currentPassword: _cp, newPassword: _np, ...profileFields } = dto;
    Object.assign(user, profileFields);
    return UserResponseDto.from(await this.userRepo.save(user));
  }

  // ─── Update: admin edit any user ──────────────────────────────────────────

  async adminUpdate(
    id: string,
    dto: AdminUpdateUserDto,
    requester: JwtPayload,
  ): Promise<UserResponseDto> {
    const user = await this.findEntityOrFail(id);

    // Prevent privilege escalation — only SUPER_ADMIN can assign SUPER_ADMIN role
    if (dto.role === Role.SUPER_ADMIN && requester.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can assign the SUPER_ADMIN role');
    }

    // Prevent modifying another SUPER_ADMIN (unless you are one)
    if (user.role === Role.SUPER_ADMIN && requester.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot modify a SUPER_ADMIN account');
    }

    if (dto.email && dto.email !== user.email) {
      await this.assertEmailUnique(dto.email);
    }
    if (dto.phone && dto.phone !== user.phone) {
      await this.assertPhoneUnique(dto.phone, id);
    }

    if (dto.newPassword) {
      user.passwordHash = await hashPassword(dto.newPassword);
    }

    const { newPassword: _np, ...fields } = dto;
    Object.assign(user, fields);
    return UserResponseDto.from(await this.userRepo.save(user));
  }

  // ─── Status management ────────────────────────────────────────────────────

  async suspend(
    id: string,
    dto: SuspendUserDto,
    requester: JwtPayload,
  ): Promise<void> {
    const user = await this.findEntityOrFail(id);

    if (user.id === requester.sub) {
      throw new BadRequestException('You cannot suspend your own account');
    }
    if (user.role === Role.SUPER_ADMIN && requester.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot suspend a SUPER_ADMIN account');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('User is already suspended');
    }

    user.status = UserStatus.SUSPENDED;
    await this.userRepo.save(user);

    // TODO: inject ActivityLogService and log:
    // await this.activityLogService.log({
    //   userId: requester.sub,
    //   action: 'user.suspended',
    //   entityType: 'user',
    //   entityId: id,
    //   oldValues: { status: UserStatus.ACTIVE },
    //   newValues: { status: UserStatus.SUSPENDED, reason: dto.reason },
    // });
  }

  async activate(id: string, requester: JwtPayload): Promise<void> {
    const user = await this.findEntityOrFail(id);

    if (user.status === UserStatus.ACTIVE) {
      throw new BadRequestException('User is already active');
    }
    if (user.role === Role.SUPER_ADMIN && requester.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot modify a SUPER_ADMIN account');
    }

    user.status = UserStatus.ACTIVE;
    await this.userRepo.save(user);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, requester: JwtPayload): Promise<void> {
    const user = await this.findEntityOrFail(id);

    if (user.id === requester.sub) {
      throw new BadRequestException('You cannot delete your own account');
    }
    if (user.role === Role.SUPER_ADMIN && requester.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot delete a SUPER_ADMIN account');
    }

    await this.userRepo.softRemove(user);
  }

  // ─── Internal helpers (used by AuthService, other modules) ───────────────

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.userRepo.update(id, { passwordHash });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepo.update(id, { lastLoginAt: new Date() });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Fetches the raw User entity. Used internally where the full entity is needed
   * (e.g., password comparison, soft-remove). Never expose this directly in
   * controller responses — always map through UserResponseDto.from().
   */
  async findEntityOrFail(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Applies visibility scoping to a query builder based on the requester's role.
   *
   * SUPER_ADMIN        → sees all users (no filter applied)
   * ONBOARDING_STAFF   → sees all roles except SUPER_ADMIN
   * SALON_OWNER/STAFF  → sees only CUSTOMER role
   * (any other role)   → blocked at controller level; shouldn't reach here
   */
  private applyVisibilityScope(
    qb: SelectQueryBuilder<User>,
    requester: JwtPayload,
  ): void {
    switch (requester.role) {
      case Role.SUPER_ADMIN:
        // Full visibility — no scope restriction
        break;

      case Role.ONBOARDING_STAFF:
        // Cannot see other super admins or other onboarding staff
        qb.andWhere('user.role NOT IN (:...hiddenRoles)', {
          hiddenRoles: [Role.SUPER_ADMIN, Role.ONBOARDING_STAFF],
        });
        break;

      case Role.SALON_OWNER:
      case Role.STAFF:
        // Can only browse customer accounts (e.g., for support purposes)
        qb.andWhere('user.role = :customerRole', {
          customerRole: Role.CUSTOMER,
        });
        break;

      default:
        // CUSTOMER should not reach this point — blocked by @RequirePermissions in controller
        qb.andWhere('1 = 0');
    }
  }

  /**
   * Ensures a user can be read by the requester.
   *
   * SUPER_ADMIN        → can read anyone
   * ONBOARDING_STAFF   → can read anyone except SUPER_ADMIN
   * SALON_OWNER/STAFF  → can read only CUSTOMER users
   * CUSTOMER           → can only read themselves (GET /me handles this; GET /:id is admin-only)
   */
  private assertReadAccess(user: User, requester: JwtPayload): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (requester.role === Role.ONBOARDING_STAFF) {
      if (user.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    if (
      requester.role === Role.SALON_OWNER ||
      requester.role === Role.STAFF
    ) {
      if (user.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    // CUSTOMER — can only read their own profile; use GET /me instead
    if (user.id !== requester.sub) {
      throw new ForbiddenException('Access denied');
    }
  }

  /** Validates a role filter is within the requester's visibility scope. */
  private assertRoleVisibility(role: Role, requester: JwtPayload): void {
    if (requester.role === Role.SUPER_ADMIN) return;

    if (
      requester.role === Role.ONBOARDING_STAFF &&
      (role === Role.SUPER_ADMIN || role === Role.ONBOARDING_STAFF)
    ) {
      throw new ForbiddenException(
        `You cannot filter by role: ${role}`,
      );
    }

    if (
      (requester.role === Role.SALON_OWNER || requester.role === Role.STAFF) &&
      role !== Role.CUSTOMER
    ) {
      throw new ForbiddenException(
        `You can only filter by role: ${Role.CUSTOMER}`,
      );
    }
  }

  private async assertEmailUnique(
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .andWhere('user.deletedAt IS NULL');

    if (excludeId) {
      qb.andWhere('user.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) throw new ConflictException('Email is already registered');
  }

  private async assertPhoneUnique(
    phone: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.phone = :phone', { phone })
      .andWhere('user.deletedAt IS NULL');

    if (excludeId) {
      qb.andWhere('user.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) throw new ConflictException('Phone number is already in use');
  }
}
