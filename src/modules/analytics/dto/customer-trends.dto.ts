import { ApiProperty } from '@nestjs/swagger';

export class CustomerGrowthDto {
  @ApiProperty({ example: '2026-03-15' }) period: string;
  @ApiProperty({ example: 12 })           newCustomers: number;
  @ApiProperty({ example: 35 })           returningCustomers: number;
  @ApiProperty({ example: 47 })           total: number;
}

export class PeakHourDto {
  /** 0–23 */
  @ApiProperty({ example: 10 })   hour: number;
  /** 1 = Sunday … 7 = Saturday (MySQL DAYOFWEEK convention) */
  @ApiProperty({ example: 2 })    dayOfWeek: number;
  @ApiProperty({ example: 38 })   visitCount: number;
}

export class CustomerTrendsDto {
  @ApiProperty({ example: 230 })                   totalUniqueCustomers: number;
  @ApiProperty({ example: 58 })                    newCustomers: number;
  @ApiProperty({ example: 172 })                   returningCustomers: number;
  @ApiProperty({ example: 2.4 })                   avgVisitsPerCustomer: number;
  @ApiProperty({ example: 34.50 })                 avgSpendPerCustomer: number;
  @ApiProperty({ example: 4.3 })                   avgRating: number;
  @ApiProperty({ type: [CustomerGrowthDto] })       growth: CustomerGrowthDto[];
  @ApiProperty({ type: [PeakHourDto] })             peakHours: PeakHourDto[];
}
