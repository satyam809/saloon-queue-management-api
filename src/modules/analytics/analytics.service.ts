import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '@shared/services/redis.service';
import { AnalyticsQueryDto, Granularity } from './dto/analytics-query.dto';
import { RevenueReportDto } from './dto/revenue-report.dto';
import { CustomerTrendsDto } from './dto/customer-trends.dto';
import { SalonPerformanceDto } from './dto/salon-performance.dto';

/** 15-minute cache for all analytics endpoints */
const ANALYTICS_TTL = 900;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private resolveDates(query: AnalyticsQueryDto): { start: string; end: string } {
    const now = new Date();
    const end   = query.endDate   ?? now.toISOString().slice(0, 10);
    const start = query.startDate ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    return { start, end };
  }

  /**
   * Returns a MySQL DATE_FORMAT expression for the given granularity.
   * The `col` parameter must be a trusted internal column reference — never
   * interpolate user-supplied strings here.
   */
  private periodExpr(granularity: Granularity | undefined, col: string): string {
    switch (granularity) {
      case Granularity.WEEKLY:  return `DATE_FORMAT(${col}, '%Y-%u')`;
      case Granularity.MONTHLY: return `DATE_FORMAT(${col}, '%Y-%m')`;
      default:                  return `DATE_FORMAT(${col}, '%Y-%m-%d')`;
    }
  }

  private cacheKey(type: string, query: AnalyticsQueryDto): string {
    const { start, end } = this.resolveDates(query);
    const gran  = query.granularity ?? Granularity.DAILY;
    const salon = query.salonId ?? 'all';
    return `analytics:${type}:${salon}:${start}:${end}:${gran}`;
  }

  private pct(part: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((part / total) * 10000) / 100;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  // ─── Revenue report ───────────────────────────────────────────────────────

  async getRevenueReport(query: AnalyticsQueryDto): Promise<RevenueReportDto> {
    const key = this.cacheKey('revenue', query);
    const cached = await this.redis.getJson<RevenueReportDto>(key);
    if (cached) return cached;

    const { start, end } = this.resolveDates(query);
    const salonSql    = query.salonId ? 'AND p.salon_id = ?' : '';
    const baseParams  = [start, end, ...(query.salonId ? [query.salonId] : [])];

    // Total revenue, refunds (using the denormalised refunded_amount column),
    // and transaction count — single aggregation pass.
    const [totals] = await this.dataSource.query<[{
      total_revenue: string;
      total_refunds: string;
      total_transactions: string;
    }]>(
      `SELECT
         COALESCE(SUM(p.total_amount), 0)    AS total_revenue,
         COALESCE(SUM(p.refunded_amount), 0) AS total_refunds,
         COUNT(p.id)                         AS total_transactions
       FROM payments p
       WHERE p.status IN ('completed', 'refunded', 'partially_refunded')
         AND p.paid_at     BETWEEN ? AND ?
         AND p.deleted_at  IS NULL
         ${salonSql}`,
      baseParams,
    );

    // Time-series breakdown — GROUP BY computed period bucket.
    const periodCol  = this.periodExpr(query.granularity, 'p.paid_at');
    const byPeriod   = await this.dataSource.query<Array<{
      period: string; revenue: string; refunds: string; tx_count: string;
    }>>(
      `SELECT
         ${periodCol}                              AS period,
         COALESCE(SUM(p.total_amount), 0)          AS revenue,
         COALESCE(SUM(p.refunded_amount), 0)       AS refunds,
         COUNT(p.id)                               AS tx_count
       FROM payments p
       WHERE p.status IN ('completed', 'refunded', 'partially_refunded')
         AND p.paid_at     BETWEEN ? AND ?
         AND p.deleted_at  IS NULL
         ${salonSql}
       GROUP BY period
       ORDER BY period ASC`,
      baseParams,
    );

    // Payment-method breakdown.
    const byMethod = await this.dataSource.query<Array<{
      payment_method: string; revenue: string; count: string;
    }>>(
      `SELECT
         p.payment_method,
         SUM(p.total_amount) AS revenue,
         COUNT(*)            AS count
       FROM payments p
       WHERE p.status IN ('completed', 'refunded', 'partially_refunded')
         AND p.paid_at     BETWEEN ? AND ?
         AND p.deleted_at  IS NULL
         ${salonSql}
       GROUP BY p.payment_method
       ORDER BY revenue DESC`,
      baseParams,
    );

    // Service breakdown — LEFT JOIN to both queue_entry and appointment paths,
    // then resolve the service via COALESCE.  Only payments linked to a known
    // service appear in this result set (non-service payments are excluded).
    const byService = await this.dataSource.query<Array<{
      service_id: string; service_name: string;
      revenue: string; count: string; avg_revenue: string;
    }>>(
      `SELECT
         s.id                   AS service_id,
         s.name                 AS service_name,
         SUM(p.total_amount)    AS revenue,
         COUNT(p.id)            AS count,
         AVG(p.total_amount)    AS avg_revenue
       FROM payments p
       LEFT JOIN queue_entries qe ON qe.id = p.queue_entry_id
       LEFT JOIN appointments   a  ON a.id  = p.appointment_id
       JOIN services s ON s.id = COALESCE(qe.service_id, a.service_id)
       WHERE p.status IN ('completed', 'refunded', 'partially_refunded')
         AND p.paid_at     BETWEEN ? AND ?
         AND p.deleted_at  IS NULL
         ${salonSql}
         AND s.deleted_at  IS NULL
       GROUP BY s.id, s.name
       ORDER BY revenue DESC`,
      baseParams,
    );

    const totalRevenue = parseFloat(totals.total_revenue);
    const totalRefunds = parseFloat(totals.total_refunds);

    const result: RevenueReportDto = {
      totalRevenue,
      totalRefunds,
      netRevenue:        this.round2(totalRevenue - totalRefunds),
      totalTransactions: parseInt(totals.total_transactions, 10),
      byPeriod: byPeriod.map((r) => ({
        period:           r.period,
        revenue:          parseFloat(r.revenue),
        refunds:          parseFloat(r.refunds),
        netRevenue:       this.round2(parseFloat(r.revenue) - parseFloat(r.refunds)),
        transactionCount: parseInt(r.tx_count, 10),
      })),
      byPaymentMethod: byMethod.map((r) => ({
        method:     r.payment_method,
        revenue:    parseFloat(r.revenue),
        count:      parseInt(r.count, 10),
        percentage: this.pct(parseFloat(r.revenue), totalRevenue),
      })),
      byService: byService.map((r) => ({
        serviceId:   r.service_id,
        serviceName: r.service_name,
        revenue:     parseFloat(r.revenue),
        count:       parseInt(r.count, 10),
        avgRevenue:  this.round2(parseFloat(r.avg_revenue)),
      })),
    };

    await this.redis.setJson(key, result, ANALYTICS_TTL);
    return result;
  }

  // ─── Customer trends ──────────────────────────────────────────────────────

  async getCustomerTrends(query: AnalyticsQueryDto): Promise<CustomerTrendsDto> {
    const key = this.cacheKey('customers', query);
    const cached = await this.redis.getJson<CustomerTrendsDto>(key);
    if (cached) return cached;

    const { start, end } = this.resolveDates(query);
    const sP = query.salonId ? [query.salonId] : [];

    // SQL fragments for the two salon-aware joins.
    const qSalon  = query.salonId ? 'AND q.salon_id  = ?' : '';
    const q2Salon = query.salonId ? 'AND q2.salon_id = ?' : '';
    const pSalon  = query.salonId ? 'AND p.salon_id  = ?' : '';
    const rSalon  = query.salonId ? 'AND r.salon_id  = ?' : '';

    // First-visit subquery reused across multiple outer queries.
    // MIN(checked_in_at) gives the timestamp of the customer's earliest completed
    // visit — used to classify new vs returning.
    const firstVisitSubquery = (salonClause: string) => `
      SELECT qe2.customer_id, MIN(qe2.checked_in_at) AS first_visit_at
      FROM queue_entries qe2
      JOIN queues q2 ON q2.id = qe2.queue_id
      WHERE qe2.status = 'completed'
        ${salonClause}
      GROUP BY qe2.customer_id`;

    // 1) Unique visitors + new/returning split.
    //    "New" = first_visit_at falls within the queried date range.
    const [visitors] = await this.dataSource.query<[{
      total_unique: string; new_customers: string;
    }]>(
      `SELECT
         COUNT(DISTINCT pv.customer_id) AS total_unique,
         COUNT(DISTINCT CASE WHEN DATE(fv.first_visit_at) BETWEEN ? AND ?
                             THEN pv.customer_id END)          AS new_customers
       FROM (
         SELECT DISTINCT qe.customer_id
         FROM queue_entries qe
         JOIN queues q ON q.id = qe.queue_id
         WHERE qe.status = 'completed'
           AND DATE(qe.checked_in_at) BETWEEN ? AND ?
           ${qSalon}
       ) pv
       JOIN (${firstVisitSubquery(q2Salon)}) fv ON fv.customer_id = pv.customer_id`,
      [start, end, start, end, ...sP, ...sP],
    );

    // 2) Average visits per customer within the period.
    const [avgVisitsRow] = await this.dataSource.query<[{ avg_visits: string }]>(
      `SELECT COALESCE(AVG(cnt), 0) AS avg_visits
       FROM (
         SELECT COUNT(*) AS cnt
         FROM queue_entries qe
         JOIN queues q ON q.id = qe.queue_id
         WHERE qe.status = 'completed'
           AND DATE(qe.checked_in_at) BETWEEN ? AND ?
           ${qSalon}
         GROUP BY qe.customer_id
       ) t`,
      [start, end, ...sP],
    );

    // 3) Average spend per customer (payments that cleared within the period).
    const [avgSpendRow] = await this.dataSource.query<[{ avg_spend: string }]>(
      `SELECT COALESCE(AVG(total), 0) AS avg_spend
       FROM (
         SELECT p.customer_id, SUM(p.total_amount) AS total
         FROM payments p
         WHERE p.status IN ('completed', 'refunded', 'partially_refunded')
           AND p.paid_at    BETWEEN ? AND ?
           AND p.deleted_at IS NULL
           ${pSalon}
         GROUP BY p.customer_id
       ) t`,
      [start, end, ...sP],
    );

    // 4) Average published review rating within the period.
    const [ratingRow] = await this.dataSource.query<[{ avg_rating: string }]>(
      `SELECT COALESCE(AVG(r.rating), 0) AS avg_rating
       FROM reviews r
       WHERE r.is_published = 1
         AND r.deleted_at   IS NULL
         AND r.created_at   BETWEEN ? AND ?
         ${rSalon}`,
      [start, end, ...sP],
    );

    // 5) Growth over time.
    //    A customer is "new" in a period if the period of their first_visit_at
    //    matches the period of the current row.  COUNT DISTINCT ensures they are
    //    counted once per period even if they have multiple visits.
    const periodCol     = this.periodExpr(query.granularity, 'qe.checked_in_at');
    const fvPeriodCol   = this.periodExpr(query.granularity, 'fv.first_visit_at');
    const growthRows = await this.dataSource.query<Array<{
      period: string; total: string; new_customers: string;
    }>>(
      `SELECT
         ${periodCol}                                                        AS period,
         COUNT(DISTINCT qe.customer_id)                                      AS total,
         COUNT(DISTINCT CASE WHEN ${fvPeriodCol} = ${periodCol}
                             THEN qe.customer_id END)                        AS new_customers
       FROM queue_entries qe
       JOIN queues q ON q.id = qe.queue_id
       JOIN (${firstVisitSubquery(q2Salon)}) fv ON fv.customer_id = qe.customer_id
       WHERE qe.status = 'completed'
         AND qe.checked_in_at BETWEEN ? AND ?
         ${qSalon}
       GROUP BY period
       ORDER BY period ASC`,
      [...sP, start, end, ...sP],
    );

    // 6) Peak check-in hours (top 48 slots — covers all 24h × 7 days).
    const peakRows = await this.dataSource.query<Array<{
      hour: string; day_of_week: string; visit_count: string;
    }>>(
      `SELECT
         HOUR(qe.checked_in_at)      AS hour,
         DAYOFWEEK(qe.checked_in_at) AS day_of_week,
         COUNT(*)                    AS visit_count
       FROM queue_entries qe
       JOIN queues q ON q.id = qe.queue_id
       WHERE qe.status = 'completed'
         AND qe.checked_in_at BETWEEN ? AND ?
         ${qSalon}
       GROUP BY HOUR(qe.checked_in_at), DAYOFWEEK(qe.checked_in_at)
       ORDER BY visit_count DESC
       LIMIT 48`,
      [start, end, ...sP],
    );

    const totalUnique  = parseInt(visitors.total_unique, 10);
    const newCustomers = parseInt(visitors.new_customers, 10);

    const result: CustomerTrendsDto = {
      totalUniqueCustomers: totalUnique,
      newCustomers,
      returningCustomers:    totalUnique - newCustomers,
      avgVisitsPerCustomer:  this.round2(parseFloat(avgVisitsRow.avg_visits)),
      avgSpendPerCustomer:   this.round2(parseFloat(avgSpendRow.avg_spend)),
      avgRating:             this.round2(parseFloat(ratingRow.avg_rating)),
      growth: growthRows.map((r) => {
        const total = parseInt(r.total, 10);
        const nc    = parseInt(r.new_customers, 10);
        return {
          period:             r.period,
          newCustomers:       nc,
          returningCustomers: total - nc,
          total,
        };
      }),
      peakHours: peakRows.map((r) => ({
        hour:       parseInt(r.hour, 10),
        dayOfWeek:  parseInt(r.day_of_week, 10),
        visitCount: parseInt(r.visit_count, 10),
      })),
    };

    await this.redis.setJson(key, result, ANALYTICS_TTL);
    return result;
  }

  // ─── Salon performance ────────────────────────────────────────────────────

  async getSalonPerformance(query: AnalyticsQueryDto): Promise<SalonPerformanceDto> {
    const key = this.cacheKey('performance', query);
    const cached = await this.redis.getJson<SalonPerformanceDto>(key);
    if (cached) return cached;

    const { start, end } = this.resolveDates(query);
    const sP      = query.salonId ? [query.salonId] : [];
    const qSalon  = query.salonId ? 'AND q.salon_id = ?' : '';

    // 1) Overall aggregate across the date range.
    const [overall] = await this.dataSource.query<[{
      total_served:        string;
      total_cancelled:     string;
      total_no_shows:      string;
      total_entries:       string;
      avg_wait_minutes:    string;
      avg_service_minutes: string;
    }]>(
      `SELECT
         COUNT(CASE WHEN qe.status = 'completed' THEN 1 END) AS total_served,
         COUNT(CASE WHEN qe.status = 'cancelled' THEN 1 END) AS total_cancelled,
         COUNT(CASE WHEN qe.status = 'no_show'   THEN 1 END) AS total_no_shows,
         COUNT(qe.id)                                         AS total_entries,
         AVG(
           CASE WHEN qe.called_at IS NOT NULL
                THEN TIMESTAMPDIFF(MINUTE, qe.checked_in_at, qe.called_at) END
         ) AS avg_wait_minutes,
         AVG(
           CASE WHEN qe.service_started_at IS NOT NULL AND qe.completed_at IS NOT NULL
                THEN TIMESTAMPDIFF(MINUTE, qe.service_started_at, qe.completed_at) END
         ) AS avg_service_minutes
       FROM queue_entries qe
       JOIN queues q ON q.id = qe.queue_id
       WHERE q.date        BETWEEN ? AND ?
         AND qe.deleted_at IS NULL
         ${qSalon}`,
      [start, end, ...sP],
    );

    // 2) Per-day queue metrics.
    //    utilizationRate is computed in the application layer as
    //    total_entries / max_queue_size, giving a per-day capacity fill rate.
    const queueMetricRows = await this.dataSource.query<Array<{
      date:                string;
      total_queues:        string;
      total_served:        string;
      total_cancelled:     string;
      total_no_shows:      string;
      avg_wait_minutes:    string;
      avg_service_minutes: string;
      total_entries:       string;
      max_queue_size:      string;
    }>>(
      `SELECT
         q.date,
         COUNT(DISTINCT q.id)                                                        AS total_queues,
         COUNT(CASE WHEN qe.status = 'completed' THEN 1 END)                        AS total_served,
         COUNT(CASE WHEN qe.status = 'cancelled' THEN 1 END)                        AS total_cancelled,
         COUNT(CASE WHEN qe.status = 'no_show'   THEN 1 END)                        AS total_no_shows,
         AVG(
           CASE WHEN qe.called_at IS NOT NULL
                THEN TIMESTAMPDIFF(MINUTE, qe.checked_in_at, qe.called_at) END
         )                                                                           AS avg_wait_minutes,
         AVG(
           CASE WHEN qe.service_started_at IS NOT NULL AND qe.completed_at IS NOT NULL
                THEN TIMESTAMPDIFF(MINUTE, qe.service_started_at, qe.completed_at) END
         )                                                                           AS avg_service_minutes,
         COUNT(qe.id)                                                                AS total_entries,
         s.max_queue_size
       FROM queues q
       JOIN salons s ON s.id = q.salon_id
       LEFT JOIN queue_entries qe ON qe.queue_id = q.id AND qe.deleted_at IS NULL
       WHERE q.date        BETWEEN ? AND ?
         AND q.deleted_at  IS NULL
         ${qSalon}
       GROUP BY q.date, s.max_queue_size
       ORDER BY q.date ASC`,
      [start, end, ...sP],
    );

    // 3) Barber performance — only when salonId is scoped.
    //    Uses LEFT JOINs to include barbers with zero entries in the period.
    //    The barbers.rating column is a pre-computed rolling average maintained
    //    by the review service.
    let barberRows: Array<{
      barber_id:           string;
      barber_name:         string;
      total_served:        string;
      avg_service_minutes: string;
      avg_rating:          string;
      revenue:             string;
    }> = [];

    if (query.salonId) {
      barberRows = await this.dataSource.query(
        `SELECT
           b.id                                                                            AS barber_id,
           b.name                                                                          AS barber_name,
           COUNT(CASE WHEN qe.status = 'completed' THEN 1 END)                            AS total_served,
           AVG(
             CASE WHEN qe.service_started_at IS NOT NULL AND qe.completed_at IS NOT NULL
                  THEN TIMESTAMPDIFF(MINUTE, qe.service_started_at, qe.completed_at) END
           )                                                                               AS avg_service_minutes,
           b.rating                                                                        AS avg_rating,
           COALESCE(SUM(p.total_amount), 0)                                                AS revenue
         FROM barbers b
         LEFT JOIN queue_entries qe
           ON  qe.barber_id   = b.id
           AND qe.deleted_at  IS NULL
           AND DATE(qe.checked_in_at) BETWEEN ? AND ?
         LEFT JOIN payments p
           ON  p.queue_entry_id = qe.id
           AND p.status IN ('completed', 'refunded', 'partially_refunded')
           AND p.deleted_at    IS NULL
         WHERE b.salon_id   = ?
           AND b.deleted_at IS NULL
         GROUP BY b.id, b.name, b.rating
         ORDER BY total_served DESC`,
        [start, end, query.salonId],
      );
    }

    // 4) Service popularity — only when salonId is scoped.
    //    avg_rating is computed from published reviews (not per-entry), giving
    //    a lifetime signal that contextualises booking volume.
    let serviceRows: Array<{
      service_id:    string;
      service_name:  string;
      booking_count: string;
      revenue:       string;
      avg_rating:    string;
    }> = [];

    if (query.salonId) {
      serviceRows = await this.dataSource.query(
        `SELECT
           s.id                            AS service_id,
           s.name                          AS service_name,
           COUNT(qe.id)                    AS booking_count,
           COALESCE(SUM(p.total_amount), 0) AS revenue,
           COALESCE(AVG(r.rating), 0)       AS avg_rating
         FROM services s
         LEFT JOIN queue_entries qe
           ON  qe.service_id  = s.id
           AND qe.status      = 'completed'
           AND DATE(qe.checked_in_at) BETWEEN ? AND ?
           AND qe.deleted_at  IS NULL
         LEFT JOIN payments p
           ON  p.queue_entry_id = qe.id
           AND p.status IN ('completed', 'refunded', 'partially_refunded')
           AND p.deleted_at    IS NULL
         LEFT JOIN reviews r
           ON  r.service_id   = s.id
           AND r.is_published  = 1
           AND r.deleted_at    IS NULL
         WHERE s.salon_id   = ?
           AND s.deleted_at IS NULL
         GROUP BY s.id, s.name
         ORDER BY booking_count DESC`,
        [start, end, query.salonId],
      );
    }

    const totalEntries   = parseInt(overall.total_entries, 10);
    const totalCancelled = parseInt(overall.total_cancelled, 10);
    const totalNoShows   = parseInt(overall.total_no_shows, 10);

    const result: SalonPerformanceDto = {
      totalServed:         parseInt(overall.total_served, 10),
      cancellationRate:    this.pct(totalCancelled, totalEntries),
      noShowRate:          this.pct(totalNoShows, totalEntries),
      avgWaitMinutes:      this.round2(parseFloat(overall.avg_wait_minutes) || 0),
      avgServiceMinutes:   this.round2(parseFloat(overall.avg_service_minutes) || 0),
      queueMetrics: queueMetricRows.map((r) => ({
        date:              r.date,
        totalQueues:       parseInt(r.total_queues, 10),
        totalServed:       parseInt(r.total_served, 10),
        totalCancelled:    parseInt(r.total_cancelled, 10),
        totalNoShows:      parseInt(r.total_no_shows, 10),
        avgWaitMinutes:    this.round2(parseFloat(r.avg_wait_minutes) || 0),
        avgServiceMinutes: this.round2(parseFloat(r.avg_service_minutes) || 0),
        utilizationRate:   this.pct(parseInt(r.total_entries, 10), parseInt(r.max_queue_size, 10)),
      })),
      barberPerformance: barberRows.map((r) => ({
        barberId:          r.barber_id,
        barberName:        r.barber_name,
        totalServed:       parseInt(r.total_served, 10),
        avgServiceMinutes: this.round2(parseFloat(r.avg_service_minutes) || 0),
        avgRating:         parseFloat(r.avg_rating),
        revenue:           parseFloat(r.revenue),
      })),
      servicePopularity: serviceRows.map((r) => ({
        serviceId:    r.service_id,
        serviceName:  r.service_name,
        bookingCount: parseInt(r.booking_count, 10),
        revenue:      parseFloat(r.revenue),
        avgRating:    this.round2(parseFloat(r.avg_rating)),
      })),
    };

    await this.redis.setJson(key, result, ANALYTICS_TTL);
    return result;
  }
}
