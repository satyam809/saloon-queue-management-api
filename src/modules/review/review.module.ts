import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

/**
 * ReviewModule — encapsulates all review-related functionality.
 *
 * Registers the Review entity with TypeORM, exposes ReviewController
 * for HTTP routing, and exports ReviewService so other modules can
 * programmatically interact with reviews (e.g. triggering notifications
 * after a review reply).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Review])],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
