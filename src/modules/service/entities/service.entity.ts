import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { BarberService } from './barber-service.entity';
import type { QueueEntry } from '@modules/queue/entities/queue-entry.entity';
import type { Appointment } from '@modules/appointment/entities/appointment.entity';

@Entity('services')
@Index(['salonId', 'category', 'isActive'])  // service catalog listing
export class Service extends BaseEntity {

  @Index()
  @Column({ type: 'varchar' })
  salonId: string;

  @ManyToOne('Salon', (salon: Salon) => salon.services)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true, length: 80 })
  category: string | null;                   // e.g. "Hair", "Beard", "Skin"

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  /**
   * NULL = no active discount. Application reads discountPrice when present.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountPrice: number | null;

  @Column({ type: 'smallint', default: 30 })
  durationMinutes: number;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Controls display order in the menu / booking UI.
   */
  @Column({ type: 'smallint', default: 0 })
  sortOrder: number;

  // ─── Relationships ───────────────────────────────────────────────────────

  @OneToMany('BarberService', (bs: BarberService) => bs.service, { cascade: true })
  barberServices: BarberService[];

  @OneToMany('QueueEntry', (qe: QueueEntry) => qe.service)
  queueEntries: QueueEntry[];

  @OneToMany('Appointment', (a: Appointment) => a.service)
  appointments: Appointment[];
}
