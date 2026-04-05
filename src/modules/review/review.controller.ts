import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiAuthErrors,
  ApiCommonErrors,
  ApiConflictErrors,
  ApiCreatedWrapped,
  ApiOkWrapped,
  ApiPaginatedResponse,
} from '@common/swagger/decorators';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { FlagReviewDto } from './dto/flag-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Permission } from '@common/enums/permission.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

/**
 * ReviewController — HTTP interface for the salon review system.
 *
 * Public endpoints (GET) are accessible without authentication.
 * Write endpoints require a valid JWT and the appropriate permission.
 *
 * Base route: /reviews
 */
@ApiTags('Reviews')
@ApiBearerAuth('bearer')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // ─── Public: list reviews ─────────────────────────────────────────────────

  /**
   * GET /reviews
   *
   * Returns a paginated list of reviews. Public callers only see published
   * reviews. Admins (SUPER_ADMIN / ONBOARDING_STAFF) may pass
   * `?isPublished=false` to inspect hidden reviews.
   *
   * @param query - Filtering, sorting, and pagination options.
   * @param requester - JWT payload of the authenticated caller (may be undefined for public calls).
   * @returns Paginated list of ReviewResponseDto.
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: 'List reviews',
    description:
      'Public callers see only published reviews. ' +
      'Admins can pass ?isPublished=false to see hidden reviews. ' +
      'Supports ?salonId=, ?customerId=, ?barberId=, ?rating=, ?isVerifiedVisit=, ' +
      '?sortBy=, ?page=, ?limit=',
  })
  @ApiPaginatedResponse(ReviewResponseDto)
  @ApiAuthErrors()
  findAll(
    @Query() query: ReviewQueryDto,
    @CurrentUser() requester: JwtPayload,
  ) {
    return this.reviewService.findAll(query, requester);
  }

  // ─── Public: single review ────────────────────────────────────────────────

  /**
   * GET /reviews/:id
   *
   * Returns a single review by UUID. Unpublished reviews are hidden from
   * non-admin callers (NotFoundException is thrown instead).
   *
   * @param id - UUID of the review.
   * @param requester - JWT payload of the authenticated caller.
   * @returns The requested ReviewResponseDto.
   * @throws NotFoundException if the review does not exist or is hidden.
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single review' })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiOkWrapped(ReviewResponseDto)
  @ApiCommonErrors()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.findOne(id, requester);
  }

  // ─── Create review ────────────────────────────────────────────────────────

  /**
   * POST /reviews
   *
   * Allows an authenticated customer to submit a review for a salon visit.
   * Providing a `queueEntryId` or `appointmentId` marks the review as a
   * verified visit. One review per queue-visit and per appointment is enforced.
   *
   * @param dto - Review creation payload.
   * @param requester - JWT payload of the authenticated customer.
   * @returns The newly created ReviewResponseDto.
   * @throws ForbiddenException if the caller is not a customer.
   * @throws BadRequestException if a review for the same visit already exists.
   */
  @Post()
  @RequirePermissions(Permission.REVIEW_CREATE)
  @ApiOperation({
    summary: 'Submit a review',
    description:
      'Customers submit a review for a salon visit. ' +
      'Providing a queueEntryId or appointmentId marks the review as verified. ' +
      'One review per queue-visit / appointment is enforced.',
  })
  @ApiCreatedWrapped(ReviewResponseDto)
  @ApiCommonErrors()
  @ApiConflictErrors()
  create(
    @Body() dto: CreateReviewDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.create(dto, requester);
  }

  // ─── Reply to review ──────────────────────────────────────────────────────

  /**
   * PATCH /reviews/:id/reply
   *
   * Allows a salon owner or SUPER_ADMIN to post a public reply to a customer
   * review. Calling this endpoint again will overwrite an existing reply.
   *
   * @param id - UUID of the review to reply to.
   * @param dto - Reply payload containing the reply text.
   * @param requester - JWT payload of the authenticated salon owner or admin.
   * @returns The updated ReviewResponseDto with the reply populated.
   * @throws ForbiddenException if the caller lacks REVIEW_REPLY permission.
   * @throws NotFoundException if the review does not exist.
   */
  @Patch(':id/reply')
  @RequirePermissions(Permission.REVIEW_REPLY)
  @ApiOperation({
    summary: 'Reply to a review (salon owner)',
    description:
      'Salon owner or SUPER_ADMIN posts a public reply to a customer review. ' +
      'Calling this endpoint again will overwrite an existing reply.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiOkWrapped(ReviewResponseDto)
  @ApiCommonErrors()
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyReviewDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.reply(id, dto, requester);
  }

  // ─── Admin: flag / moderate review ───────────────────────────────────────

  /**
   * PATCH /reviews/:id/flag
   *
   * Allows a SUPER_ADMIN to hide or restore a review by toggling its
   * `isPublished` flag. Pass `{ "isPublished": false }` to hide or
   * `{ "isPublished": true }` to restore.
   *
   * @param id - UUID of the review to moderate.
   * @param dto - Flag payload containing the new isPublished value.
   * @param requester - JWT payload of the SUPER_ADMIN caller.
   * @returns The updated ReviewResponseDto.
   * @throws ForbiddenException if the caller lacks REVIEW_MODERATE permission.
   * @throws NotFoundException if the review does not exist.
   */
  @Patch(':id/flag')
  @RequirePermissions(Permission.REVIEW_MODERATE)
  @ApiOperation({
    summary: 'Moderate a review (admin)',
    description:
      'SUPER_ADMIN sets isPublished to hide or restore a review. ' +
      'Pass { "isPublished": false } to hide, true to restore.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiOkWrapped(ReviewResponseDto)
  @ApiCommonErrors()
  flag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FlagReviewDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.flag(id, dto, requester);
  }
}
