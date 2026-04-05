import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { StaffRole, StaffStatus } from '@common/enums/status.enum';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { User } from '@modules/user/entities/user.entity';

@Entity('staff')
@Index(['salonId', 'role', 'deletedAt'])   // find all managers of a salon
export class Staff extends BaseEntity {

  @Index()
  @Column({ type: 'varchar' })
  salonId: string;

  @ManyToOne('Salon', (salon: Salon) => salon.staff)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  /**
   * NULL when the staff member does not have an app account.
   * When present, login is handled via the users table.
   */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @ManyToOne('User', (user: User) => user.staffProfiles, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 150 })
  email: string | null;

  @Column({ type: 'varchar', nullable: true, length: 20 })
  phone: string | null;

  @Column({ type: 'enum', enum: StaffRole, default: StaffRole.STAFF })
  role: StaffRole;

  @Index()
  @Column({ type: 'enum', enum: StaffStatus, default: StaffStatus.ACTIVE })
  status: StaffStatus;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'date', nullable: true })
  hiredAt: Date | null;
}
