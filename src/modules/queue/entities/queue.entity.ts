import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from '@database/base.entity';
import type { Salon } from '@modules/salon/entities/salon.entity';
import type { QueueEntry } from './queue-entry.entity';

@Entity('queues')
@Unique(['salonId', 'date'])              // one queue per salon per day
@Index(['isOpen', 'date'])
export class Queue extends BaseEntity {

  @Index()
  @Column()
  salonId: string;

  @ManyToOne('Salon', (salon: Salon) => salon.queues)
  @JoinColumn({ name: 'salon_id' })
  salon: Salon;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({ default: false })
  isOpen: boolean;

  @Column({ nullable: true })
  openedAt: Date | null;

  @Column({ nullable: true })
  closedAt: Date | null;

  /**
   * The token number currently being served.
   * Incremented each time staff calls the next customer.
   */
  @Column({ type: 'int', default: 0 })
  currentServingPosition: number;

  /**
   * Denormalized count of completed entries — used for daily analytics.
   */
  @Column({ type: 'int', default: 0 })
  totalServed: number;

  // ─── Relationships ───────────────────────────────────────────────────────

  @OneToMany('QueueEntry', (entry: QueueEntry) => entry.queue, { cascade: true })
  entries: QueueEntry[];
}
