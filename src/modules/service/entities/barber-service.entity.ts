import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Barber } from '@modules/barber/entities/barber.entity';
import type { Service } from './service.entity';

/**
 * Pivot table: barbers ↔ services (many-to-many).
 *
 * Per-barber overrides:
 *   - customPrice    → NULL means inherit service.price
 *   - customDuration → NULL means inherit service.durationMinutes
 *
 * No deletedAt — removing a barber from a service is a hard delete of this row.
 */
@Entity('barber_services')
@Unique(['barberId', 'serviceId'])
export class BarberService {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  barberId: string;

  @ManyToOne('Barber', (barber: Barber) => barber.barberServices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'barber_id' })
  barber: Barber;

  @Column()
  serviceId: string;

  @ManyToOne('Service', (service: Service) => service.barberServices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  /**
   * When set, overrides service.price for bookings with this barber.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  customPrice: number | null;

  /**
   * When set, overrides service.durationMinutes for scheduling this barber.
   */
  @Column({ type: 'smallint', nullable: true })
  customDuration: number | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
