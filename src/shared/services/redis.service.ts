import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { ChainableCommander } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private available = false;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host:     this.configService.get<string>('redis.host'),
      port:     this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
      lazyConnect: true,

      // ── Reconnection ───────────────────────────────────────────────────────
      // Exponential back-off capped at 3 s; give up after 20 attempts so a
      // permanently-gone Redis does not spin forever.
      retryStrategy: (times) => (times > 20 ? null : Math.min(times * 100, 3_000)),

      // ── Connection health ──────────────────────────────────────────────────
      keepAlive: 15_000,

      // ── Socket hardening ───────────────────────────────────────────────────
      connectTimeout: 5_000,
      enableOfflineQueue: false,
      noDelay: true,
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('ready',   () => { this.available = true;  this.logger.log('Redis ready'); });
    this.client.on('error',   (err) => this.logger.error(err.message));
    this.client.on('close',   () => { this.available = false; this.logger.warn('Redis connection closed'); });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  private async exec<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    if (!this.available) return fallback;
    try {
      return await fn();
    } catch (err) {
      this.logger.error(`Redis command failed: ${(err as Error).message}`);
      return fallback;
    }
  }

  // ─── Pipeline ─────────────────────────────────────────────────────────────

  /**
   * Returns an ioredis pipeline so callers can batch multiple commands into a
   * single TCP round-trip.
   *
   * Usage:
   *   const pipe = this.redis.pipeline();
   *   pipe.set('k1', 'v1');
   *   pipe.expire('k1', 60);
   *   await pipe.exec();
   *
   * At 10 k concurrent users, batching queue-state writes (SET + EXPIRE + ZADD)
   * into one pipeline cuts round-trips by ≈ 60 % versus three sequential calls.
   */
  pipeline(): ChainableCommander {
    return this.client.pipeline();
  }

  async get(key: string): Promise<string | null> {
    return this.exec(() => this.client.get(key), null);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.exec(
      () => ttl ? this.client.set(key, value, 'EX', ttl) : this.client.set(key, value),
      null,
    );
  }

  async del(key: string): Promise<void> {
    await this.exec(() => this.client.del(key), null);
  }

  async exists(key: string): Promise<boolean> {
    return this.exec(async () => (await this.client.exists(key)) > 0, false);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async setJson<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  async ttl(key: string): Promise<number> {
    return this.exec(() => this.client.ttl(key), -1);
  }

  async incr(key: string): Promise<number> {
    return this.exec(() => this.client.incr(key), 0);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.exec(() => this.client.expire(key, seconds), null);
  }

  // ─── Hash operations ──────────────────────────────────────────────────────

  async hset(key: string, field: string, value: string | number): Promise<void> {
    await this.exec(() => this.client.hset(key, field, String(value)), null);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.exec(() => this.client.hget(key, field), null);
  }

  async hmset(key: string, data: Record<string, string | number>): Promise<void> {
    const args: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) args[k] = String(v);
    await this.exec(() => this.client.hmset(key, args), null);
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    return this.exec(async () => {
      const result = await this.client.hgetall(key);
      return result && Object.keys(result).length > 0 ? result : null;
    }, null);
  }

  async hincrbyfloat(key: string, field: string, increment: number): Promise<number> {
    return this.exec(
      async () => parseFloat(await this.client.hincrbyfloat(key, field, increment)),
      0,
    );
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.exec(() => this.client.hincrby(key, field, increment), 0);
  }

  // ─── Sorted Set operations ────────────────────────────────────────────────

  /** Add member with score. Returns 1 if added, 0 if updated. */
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.exec(() => this.client.zadd(key, score, member) as Promise<number>, 0);
  }

  /** Remove one or more members. */
  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.exec(() => this.client.zrem(key, ...members), 0);
  }

  /** 0-based rank of member (lowest score first). Returns null if not found. */
  async zrank(key: string, member: string): Promise<number | null> {
    return this.exec(() => this.client.zrank(key, member), null);
  }

  /** Number of members in the sorted set. */
  async zcard(key: string): Promise<number> {
    return this.exec(() => this.client.zcard(key), 0);
  }

  /** Members from index start to stop (inclusive), lowest score first. */
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.exec(() => this.client.zrange(key, start, stop), []);
  }

  /**
   * Execute a Lua script atomically.
   * @param script  Lua source string
   * @param keys    KEYS array passed to the script
   * @param args    ARGV array passed to the script
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async eval(script: string, keys: string[], args: (string | number)[]): Promise<any> {
    return this.exec(
      () => this.client.eval(script, keys.length, ...keys, ...args.map(String)),
      null,
    );
  }

  /**
   * Atomically remove and return the member with the lowest score.
   * Returns [member, score] or null if the set is empty.
   * Requires Redis >= 5.0.
   */
  async zpopmin(key: string): Promise<[string, string] | null> {
    return this.exec(async () => {
      const result = await this.client.zpopmin(key, 1);
      if (!result || result.length < 2) return null;
      return [result[0], result[1]] as [string, string];
    }, null);
  }
}
