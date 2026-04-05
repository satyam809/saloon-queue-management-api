import { Injectable } from '@nestjs/common';

/**
 * Core application service providing infrastructure-level operations
 * that are not specific to any business domain.
 */
@Injectable()
export class AppService {
  /**
   * Returns a snapshot of the application's runtime health.
   *
   * @returns An object with:
   *  - `status`    — always `"ok"` when the process is reachable.
   *  - `timestamp` — ISO-8601 server time at the moment of the call.
   *  - `uptime`    — process uptime in seconds since the last restart.
   */
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
