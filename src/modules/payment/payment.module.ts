import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentRefund } from './entities/payment-refund.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentRefund])],
  controllers: [PaymentController],
  providers: [PaymentService],
  /**
   * Export PaymentService so AppointmentModule / QueueModule can create
   * payment records on checkout without circular imports.
   */
  exports: [PaymentService],
})
export class PaymentModule {}
