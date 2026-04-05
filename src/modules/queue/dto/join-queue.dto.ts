import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for joining an existing queue.
 *
 * All fields are optional — a customer may join with no preferences and will
 * be assigned to the next available barber for any service.
 */
export class JoinQueueDto {
  /**
   * UUID of the preferred barber the customer would like to be served by.
   * When omitted (or `null`), the system assigns the next available barber.
   *
   * @example 'uuid-of-barber'
   */
  @ApiPropertyOptional({ description: 'Preferred barber UUID — null means any available barber' })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  /**
   * UUID of the specific service the customer wants to receive.
   * When omitted the service can be determined at the chair.
   *
   * @example 'uuid-of-service'
   */
  @ApiPropertyOptional({ description: 'Service UUID the customer wants' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  /**
   * Free-text notes or special requests from the customer.
   *
   * @example 'Haircut + beard trim'
   * @maxLength 255
   */
  @ApiPropertyOptional({ example: 'Haircut + beard trim' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
