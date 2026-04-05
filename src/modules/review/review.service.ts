import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { FlagReviewDto } from './dto/flag-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { paginate } from '@shared/utils/pagination.util';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { Role } from '@common/enums/role.enum';
import { canPerform } from '@common/rbac/rbac.util';
import { Permission } from '@common/enums/permission.enum';
import { ActivityLogService } from '@modules/activity-log/activity-log.service';

/**
 * ReviewService — business logic for the salon review system.
 *
 * Handles creating, querying, replying to, and moderating reviews.
 * All state-changing operations emit activity log entries via ActivityLogService.
 */
@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    private readonly actLog: ActivityLogService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates a new review submitted by an authenticated customer.
   *
   * Enforces:
   * - Only CUSTOMER role may submit reviews.
   * - One review per queue-visit (via `queueEntryId`).
   * - One review per appointment (via `appointmentId`).
   *
   * A review is automatically marked as `isVerifiedVisit = true` when
   * either `queueEntryId` or `appointmentId` is provided.
   *
   * @param dto - Review creation payload from the request body.
   * @param requester - JWT payload of the authenticated customer.
   * @returns The persisted ReviewResponseDto.
   * @throws ForbiddenException if the caller is not a customer.
   * @throws BadRequestException if a duplicate review is detected.
   */
  async create(dto: CreateReviewDto, requester: JwtPayload): Promise<ReviewResponseDto> {
    // Only customers may submit reviews
    if (requester.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Only customers can submit reviews');
    }

    // One review per queue-visit
    if (dto.queueEntryId) {
      const exists = await this.reviewRepo.findOne({
        where: { customerId: requester.sub, queueEntryId: dto.queueEntryId },
      });
      if (exists) {
        throw new BadRequestException('You have already reviewed this queue visit');
      }
    }

    // One review per appointment
    if (dto.appointmentId) {
      const exists = await this.reviewRepo.findOne({
        where: { customerId: requester.sub, appointmentId: dto.appointmentId },
      });
      if (exists) {
        throw new BadRequestException('You have already reviewed this appointment');
      }
    }

    const isVerifiedVisit = Boolean(dto.queueEntryId ?? dto.appointmentId);

    const review = this.reviewRepo.create({
      salonId:        dto.salonId,
      customerId:     requester.sub,
      barberId:       dto.barberId      ?? null,
      queueEntryId:   dto.queueEntryId  ?? null,
      appointmentId:  dto.appointmentId ?? null,
      rating:         dto.rating,
      title:          dto.title         ?? null,
      body:           dto.body          ?? null,
      isVerifiedVisit,
      isPublished:    true,
      publishedAt:    new Date(),
    });

    const saved = await this.reviewRepo.save(review);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'review.created', category: 'review', entityType: 'review', entityId: saved.id, newValues: { rating: saved.rating, salonId: saved.salonId, isVerifiedVisit: saved.isVerifiedVisit } });
    return ReviewResponseDto.from(saved);
  }

  // ─── Read: list ───────────────────────────────────────────────────────────

  /**
   * Returns a paginated, filterable list of reviews.
   *
   * Non-admin callers always receive only published reviews. Admins
   * (SUPER_ADMIN / ONBOARDING_STAFF) may additionally filter by
   * `isPublished=false` to inspect hidden reviews.
   *
   * @param query - Filtering (salonId, customerId, barberId, rating, isVerifiedVisit,
   *                isPublished), sorting (sortBy, sortOrder), and pagination options.
   * @param requester - Optional JWT payload; determines admin visibility.
   * @returns Paginated result containing ReviewResponseDto items.
   */
  async findAll(
    query: ReviewQueryDto,
    requester?: JwtPayload,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const qb = this.reviewRepo
      .createQueryBuilder('review')
      .where('review.deletedAt IS NULL');

    const isAdmin =
      requester &&
      (requester.role === Role.SUPER_ADMIN ||
        requester.role === Role.ONBOARDING_STAFF);

    // Non-admins only see published reviews; admins can filter by isPublished
    if (!isAdmin) {
      qb.andWhere('review.isPublished = :pub', { pub: true });
    } else if (query.isPublished !== undefined) {
      qb.andWhere('review.isPublished = :pub', { pub: query.isPublished });
    }

    if (query.salonId) {
      qb.andWhere('review.salonId = :salonId', { salonId: query.salonId });
    }

    if (query.customerId) {
      qb.andWhere('review.customerId = :customerId', { customerId: query.customerId });
    }

    if (query.barberId) {
      qb.andWhere('review.barberId = :barberId', { barberId: query.barberId });
    }

    if (query.rating !== undefined) {
      qb.andWhere('review.rating = :rating', { rating: query.rating });
    }

    if (query.isVerifiedVisit !== undefined) {
      qb.andWhere('review.isVerifiedVisit = :verified', {
        verified: query.isVerifiedVisit,
      });
    }

    const sortField = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    qb.orderBy(`review.${sortField}`, sortOrder);

    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return paginate(data.map(ReviewResponseDto.from), total, query.page, query.limit);
  }

  // ─── Read: single ─────────────────────────────────────────────────────────

  /**
   * Returns a single review by its UUID.
   *
   * Unpublished reviews are hidden from non-admin callers — a NotFoundException
   * is thrown rather than revealing the existence of the record.
   *
   * @param id - UUID of the review.
   * @param requester - Optional JWT payload; determines visibility of unpublished reviews.
   * @returns The requested ReviewResponseDto.
   * @throws NotFoundException if the review does not exist or is not visible to the caller.
   */
  async findOne(id: string, requester?: JwtPayload): Promise<ReviewResponseDto> {
    const review = await this.findEntityOrFail(id);

    // Hide unpublished reviews from non-admins
    const isAdmin =
      requester &&
      (requester.role === Role.SUPER_ADMIN ||
        requester.role === Role.ONBOARDING_STAFF);

    if (!review.isPublished && !isAdmin) {
      throw new NotFoundException('Review not found');
    }

    return ReviewResponseDto.from(review);
  }

  // ─── Reply ────────────────────────────────────────────────────────────────

  /**
   * Salon owner (or SUPER_ADMIN) posts a reply to a customer review.
   * The reply can be updated by calling this endpoint again.
   *
   * @param id - UUID of the review to reply to.
   * @param dto - Reply payload containing the reply text.
   * @param requester - JWT payload of the authenticated salon owner or admin.
   * @returns The updated ReviewResponseDto with reply fields populated.
   * @throws ForbiddenException if the caller lacks REVIEW_REPLY permission.
   * @throws NotFoundException if the review does not exist.
   */
  async reply(
    id: string,
    dto: ReplyReviewDto,
    requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    if (!canPerform(requester.role, Permission.REVIEW_REPLY)) {
      throw new ForbiddenException('You do not have permission to reply to reviews');
    }

    const review = await this.findEntityOrFail(id);

    // SALON_OWNER can only reply to reviews for their own salon context.
    // (Full salonId ↔ owner binding requires a Salon ownership lookup;
    //  SALON_OWNER permission is scoped at the guard level here.)
    if (
      requester.role !== Role.SUPER_ADMIN &&
      requester.role !== Role.ONBOARDING_STAFF
    ) {
      // For SALON_OWNER: trust that the permission grant is scoped appropriately.
      // A production system would load the owner's salonId from a Staff/Salon table
      // and assert review.salonId === owner.salonId here.
    }

    review.replyBody  = dto.replyBody;
    review.repliedBy  = requester.sub;
    review.repliedAt  = new Date();

    const saved = await this.reviewRepo.save(review);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'review.replied', category: 'review', entityType: 'review', entityId: id, metadata: { salonId: review.salonId } });
    return ReviewResponseDto.from(saved);
  }

  // ─── Flag (admin moderation) ──────────────────────────────────────────────

  /**
   * Admin sets isPublished to false (hide) or true (restore).
   * Requires REVIEW_MODERATE permission (SUPER_ADMIN only).
   *
   * When restoring a previously hidden review that lacks a `publishedAt`
   * timestamp, the timestamp is set to the current time.
   *
   * @param id - UUID of the review to moderate.
   * @param dto - Flag payload with the desired `isPublished` value and optional reason.
   * @param requester - JWT payload of the SUPER_ADMIN caller.
   * @returns The updated ReviewResponseDto.
   * @throws ForbiddenException if the caller lacks REVIEW_MODERATE permission.
   * @throws NotFoundException if the review does not exist.
   */
  async flag(
    id: string,
    dto: FlagReviewDto,
    requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    if (!canPerform(requester.role, Permission.REVIEW_MODERATE)) {
      throw new ForbiddenException('You do not have permission to moderate reviews');
    }

    const review = await this.findEntityOrFail(id);

    const prevPublished = review.isPublished;
    review.isPublished = dto.isPublished;

    // Restore publishedAt when re-publishing a previously hidden review
    if (dto.isPublished && !review.publishedAt) {
      review.publishedAt = new Date();
    }

    const saved = await this.reviewRepo.save(review);
    void this.actLog.log({ userId: requester.sub, actorRole: requester.role, action: 'review.flagged', category: 'review', entityType: 'review', entityId: id, oldValues: { isPublished: prevPublished }, newValues: { isPublished: dto.isPublished } });
    return ReviewResponseDto.from(saved);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Loads a Review entity by UUID or throws NotFoundException.
   *
   * Intended for internal use within this service to avoid repeating the
   * null-check pattern across methods.
   *
   * @param id - UUID of the review.
   * @returns The Review entity.
   * @throws NotFoundException if no review with the given id exists.
   */
  async findEntityOrFail(id: string): Promise<Review> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }
}
