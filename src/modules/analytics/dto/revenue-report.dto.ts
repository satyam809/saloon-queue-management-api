import { ApiProperty } from '@nestjs/swagger';

export class RevenuePeriodDto {
  @ApiProperty({ example: '2026-03-15' }) period: string;
  @ApiProperty({ example: 1250.00 })      revenue: number;
  @ApiProperty({ example: 50.00 })        refunds: number;
  @ApiProperty({ example: 1200.00 })      netRevenue: number;
  @ApiProperty({ example: 42 })           transactionCount: number;
}

export class RevenueByMethodDto {
  @ApiProperty({ example: 'card' })  method: string;
  @ApiProperty({ example: 850.00 })  revenue: number;
  @ApiProperty({ example: 28 })      count: number;
  @ApiProperty({ example: 68.00 })   percentage: number;
}

export class RevenueByServiceDto {
  @ApiProperty() serviceId: string;
  @ApiProperty() serviceName: string;
  @ApiProperty() revenue: number;
  @ApiProperty() count: number;
  @ApiProperty() avgRevenue: number;
}

export class RevenueReportDto {
  @ApiProperty({ example: 15200.00 })                        totalRevenue: number;
  @ApiProperty({ example: 320.00 })                          totalRefunds: number;
  @ApiProperty({ example: 14880.00 })                        netRevenue: number;
  @ApiProperty({ example: 480 })                             totalTransactions: number;
  @ApiProperty({ type: [RevenuePeriodDto] })                 byPeriod: RevenuePeriodDto[];
  @ApiProperty({ type: [RevenueByMethodDto] })               byPaymentMethod: RevenueByMethodDto[];
  @ApiProperty({ type: [RevenueByServiceDto] })              byService: RevenueByServiceDto[];
}
