import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import { BarberStatus } from '@common/enums/status.enum';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { User } from '@modules/user/entities/user.entity';
import type { BarberService } from '@modules/service/entities/barber-service.entity';
import type { QueueEntry } from '@modules/queue/entities/queue-entry.entity';
import type { Appointment } from '@modules/appointment/entities/appointment.entity';
import type { Review } from '@modules/review/entities/review.entity';

@Entity('barbers')
@Index(['salonId', 'isAvailable', 'deletedAt'])  // active available barbers per salon
export class Barber extends BaseEntity {

  @Index()
  @Column({ type: 'varchar' })
  salonId: string;

  @ManyToOne('Salon', (salon: Salon) => salon.barbers)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  /**
   * Optional link to a users row.
   * Barbers without app accounts can still be tracked for scheduling.
   */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @ManyToOne('User', (user: User) => user.barberProfiles, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true, length: 150 })
  email: string | null;

  @Column({ type: 'varchar', nullable: true, length: 20 })
  phone: string | null;

  /**
   * Free-form skill tags: ["haircut", "beard trim", "coloring"]
   */
  @Column({ type: 'json', nullable: true })
  specializations: string[] | null;

  /**
   * Denormalized average — updated by a background job / DB trigger
   * after each review insert/update to avoid GROUP BY on every card render.
   */
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  totalReviews: number;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @Index()
  @Column({ type: 'enum', enum: BarberStatus, default: BarberStatus.ACTIVE })
  status: BarberStatus;

  // ─── Relationships ───────────────────────────────────────────────────────

  @OneToMany('BarberService', (bs: BarberService) => bs.barber, { cascade: true })
  barberServices: BarberService[];

  @OneToMany('QueueEntry', (qe: QueueEntry) => qe.barber)
  queueEntries: QueueEntry[];

  @OneToMany('Appointment', (a: Appointment) => a.barber)
  appointments: Appointment[];

  @OneToMany('Review', (r: Review) => r.barber)
  reviews: Review[];
}
