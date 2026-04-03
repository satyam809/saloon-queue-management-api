import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FailPaymentDto {
  @ApiPropertyOptional({ example: 'Card declined — insufficient funds' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Raw gateway failure payload' })
  @IsOptional()
  gatewayResponse?: Record<string, unknown>;
}
