import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { PaymentMethod, PaymentStatus } from '@common/enums/status.enum';

/**
 * Query Data Transfer Object for filtering and paginating payment records.
 *
 * Extends {@link PaginationDto} with a rich set of optional filter criteria
 * (salon, customer, status, payment method, date range) and configurable
 * sorting. All fields are optional — omitting them returns all payments
 * accessible to the caller, subject to role-based access control.
 */
export class PaymentQueryDto extends PaginationDto {
  /**
   * Restrict results to payments belonging to a specific salon.
   *
   * @example 'uuid-of-salon'
   */
  @ApiPropertyOptional({ description: 'Filter by salon UUID' })
  @IsOptional()
  @IsUUID()
  salonId?: string;

  /**
   * Restrict results to payments made by a specific customer.
   *
   * @example 'uuid-of-customer'
   */
  @ApiPropertyOptional({ description: 'Filter by customer UUID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  /**
   * Restrict results to payments with the given {@link PaymentStatus}.
   */
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  /**
   * Restrict results to payments made with the given {@link PaymentMethod}.
   */
  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /**
   * Lower bound (inclusive) for the payment date filter in ISO 8601 date format.
   * Only payments paid on or after this date are returned.
   *
   * @example '2026-03-01'
   */
  @ApiPropertyOptional({ example: '2026-03-01', description: 'Paid on or after this date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  /**
   * Upper bound (inclusive) for the payment date filter in ISO 8601 date format.
   * Only payments paid on or before this date are returned.
   *
   * @example '2026-03-31'
   */
  @ApiPropertyOptional({ example: '2026-03-31', description: 'Paid on or before this date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  /**
   * Field by which results should be sorted.
   * Defaults to `'createdAt'` when omitted.
   *
   * @default 'createdAt'
   */
  @ApiPropertyOptional({
    enum: ['paidAt', 'totalAmount', 'createdAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['paidAt', 'totalAmount', 'createdAt'])
  sortBy?: 'paidAt' | 'totalAmount' | 'createdAt';

  /**
   * Sort direction for the results.
   * Defaults to `'DESC'` (most recent first) when omitted.
   *
   * @default 'DESC'
   */
  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
