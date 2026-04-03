import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuthErrors, ApiOkWrapped } from '@common/swagger/decorators';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { RevenueReportDto } from './dto/revenue-report.dto';
import { CustomerTrendsDto } from './dto/customer-trends.dto';
import { SalonPerformanceDto } from './dto/salon-performance.dto';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';

@ApiTags('Analytics')
@ApiBearerAuth('bearer')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/revenue
   * Gross revenue, refunds, net revenue, time-series, payment-method split,
   * and per-service breakdown.
   * Results are cached for 15 minutes.
   */
  @Get('revenue')
  @RequirePermissions(Permission.ANALYTICS_READ_SALON)
  @ApiOperation({
    summary: 'Revenue report',
    description:
      'Returns gross revenue, total refunds, net revenue, and breakdowns ' +
      'by time period, payment method, and service. Cached for 15 minutes. ' +
      'Provide ?salonId= to scope to a single salon.',
  })
  @ApiOkWrapped(RevenueReportDto)
  @ApiAuthErrors()
  getRevenue(@Query() query: AnalyticsQueryDto): Promise<RevenueReportDto> {
    return this.analyticsService.getRevenueReport(query);
  }

  /**
   * GET /analytics/customers
   * New vs returning visitors, visit frequency, average spend, ratings,
   * period-over-period growth, and peak-hour heatmap data.
   */
  @Get('customers')
  @RequirePermissions(Permission.ANALYTICS_READ_SALON)
  @ApiOperation({
    summary: 'Customer trends',
    description:
      'New vs returning customers, average visits per customer, average spend, ' +
      'published review rating, growth by period, and peak check-in hours. ' +
      'Cached for 15 minutes.',
  })
  @ApiOkWrapped(CustomerTrendsDto)
  @ApiAuthErrors()
  getCustomerTrends(@Query() query: AnalyticsQueryDto): Promise<CustomerTrendsDto> {
    return this.analyticsService.getCustomerTrends(query);
  }

  /**
   * GET /analytics/performance
   * Queue-level KPIs (wait times, utilization, cancellation/no-show rates),
   * per-barber stats, and service popularity.
   * Barber and service data require ?salonId= to be specified.
   */
  @Get('performance')
  @RequirePermissions(Permission.ANALYTICS_READ_SALON)
  @ApiOperation({
    summary: 'Salon performance',
    description:
      'Per-day queue metrics (wait time, service duration, utilization, no-show rate). ' +
      'Barber performance and service popularity are included only when ?salonId= is provided. ' +
      'Cached for 15 minutes.',
  })
  @ApiOkWrapped(SalonPerformanceDto)
  @ApiAuthErrors()
  getPerformance(@Query() query: AnalyticsQueryDto): Promise<SalonPerformanceDto> {
    return this.analyticsService.getSalonPerformance(query);
  }
}
