import {
  Entity,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '@database/base.entity';
import { Role } from '@common/enums/role.enum';
import { UserStatus } from '@common/enums/status.enum';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { Staff } from '@modules/staff/entities/staff.entity';
import type { Barber } from '@modules/barber/entities/barber.entity';
import type { Notification } from '@modules/notification/entities/notification.entity';
import type { ActivityLog } from '@modules/activity-log/entities/activity-log.entity';
import type { Review } from '@modules/review/entities/review.entity';

@Entity('users')
@Index(['email', 'deletedAt'])           // partial-like index for active-user lookups
export class User extends BaseEntity {

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', unique: true, length: 150 })
  email: string;

  @Column({ type: 'varchar', unique: true, nullable: true, length: 20 })
  phone: string | null;

  @Exclude()
  @Column({ type: 'varchar', name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, default: Role.CUSTOMER })
  role: Role;

  @Index()
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'datetime', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  phoneVerifiedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  // ─── Relationships ───────────────────────────────────────────────────────

  @OneToMany('Salon', (salon: Salon) => salon.owner)
  ownedSalons: Salon[];

  // Salons this user verified as onboarding staff
  @OneToMany('Salon', (salon: Salon) => salon.verifier)
  verifiedSalons: Salon[];

  @OneToMany('Staff', (staff: Staff) => staff.user)
  staffProfiles: Staff[];

  @OneToMany('Barber', (barber: Barber) => barber.user)
  barberProfiles: Barber[];

  @OneToMany('Notification', (n: Notification) => n.user)
  notifications: Notification[];

  @OneToMany('ActivityLog', (log: ActivityLog) => log.user)
  activityLogs: ActivityLog[];

  @OneToMany('Review', (r: Review) => r.customer)
  reviews: Review[];

  @OneToMany('Review', (r: Review) => r.repliedBy)
  reviewReplies: Review[];
}
