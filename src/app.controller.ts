import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from '@common/decorators/public.decorator';

/**
 * Root application controller.
 * Exposes infrastructure-level endpoints such as the health check.
 */
@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Returns the current health status of the application, including uptime
   * and a server-side timestamp. This endpoint is public and requires no
   * authentication — suitable for use by load-balancer health probes.
   *
   * @returns An object containing `status`, `timestamp`, and `uptime`.
   */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return this.appService.getHealth();
  }
}
