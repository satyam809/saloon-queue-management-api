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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // ─── Public: list reviews ─────────────────────────────────────────────────

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
  @ApiResponse({ status: 200, description: 'Paginated list of ReviewResponseDto' })
  findAll(
    @Query() query: ReviewQueryDto,
    @CurrentUser() requester: JwtPayload,
  ) {
    return this.reviewService.findAll(query, requester);
  }

  // ─── Public: single review ────────────────────────────────────────────────

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single review' })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiResponse({ status: 200, type: ReviewResponseDto })
  @ApiResponse({ status: 404, description: 'Review not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.findOne(id, requester);
  }

  // ─── Create review ────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.REVIEW_CREATE)
  @ApiOperation({
    summary: 'Submit a review',
    description:
      'Customers submit a review for a salon visit. ' +
      'Providing a queueEntryId or appointmentId marks the review as verified. ' +
      'One review per queue-visit / appointment is enforced.',
  })
  @ApiResponse({ status: 201, type: ReviewResponseDto })
  @ApiResponse({ status: 400, description: 'Duplicate review for this visit' })
  create(
    @Body() dto: CreateReviewDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.create(dto, requester);
  }

  // ─── Reply to review ──────────────────────────────────────────────────────

  @Patch(':id/reply')
  @RequirePermissions(Permission.REVIEW_REPLY)
  @ApiOperation({
    summary: 'Reply to a review (salon owner)',
    description:
      'Salon owner or SUPER_ADMIN posts a public reply to a customer review. ' +
      'Calling this endpoint again will overwrite an existing reply.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiResponse({ status: 200, type: ReviewResponseDto })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyReviewDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.reply(id, dto, requester);
  }

  // ─── Admin: flag / moderate review ───────────────────────────────────────

  @Patch(':id/flag')
  @RequirePermissions(Permission.REVIEW_MODERATE)
  @ApiOperation({
    summary: 'Moderate a review (admin)',
    description:
      'SUPER_ADMIN sets isPublished to hide or restore a review. ' +
      'Pass { "isPublished": false } to hide, true to restore.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiResponse({ status: 200, type: ReviewResponseDto })
  flag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FlagReviewDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.flag(id, dto, requester);
  }
}
