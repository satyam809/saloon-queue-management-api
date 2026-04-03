import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationChannel, NotificationType } from '@common/enums/notification.enum';
import { NotificationPreference } from './entities/notification-preference.entity';
import { UpsertPreferenceDto } from './dto/notification-preference.dto';

@Injectable()
export class NotificationPreferenceService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,
  ) {}

  // ─── User-facing ───────────────────────────────────────────────────────────

  /** Returns all stored preferences for the user (default = enabled when absent). */
  findForUser(userId: string): Promise<NotificationPreference[]> {
    return this.prefRepo.find({ where: { userId } });
  }

  async upsertOne(userId: string, dto: UpsertPreferenceDto): Promise<NotificationPreference> {
    const existing = await this.prefRepo.findOne({
      where: { userId, type: dto.type, channel: dto.channel },
    });

    if (existing) {
      existing.isEnabled = dto.isEnabled;
      return this.prefRepo.save(existing);
    }

    return this.prefRepo.save(
      this.prefRepo.create({ userId, ...dto }),
    );
  }

  async upsertMany(userId: string, preferences: UpsertPreferenceDto[]): Promise<void> {
    await Promise.all(preferences.map((p) => this.upsertOne(userId, p)));
  }

  // ─── Dispatcher helper ─────────────────────────────────────────────────────

  /**
   * Check if a user wants to receive a given (type × channel) notification.
   * Returns true when no preference row exists (opt-out model).
   */
  async isEnabled(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const pref = await this.prefRepo.findOne({ where: { userId, type, channel } });
    return pref?.isEnabled ?? true; // default: enabled
  }

  /**
   * Load all preferences for a user into a Map for efficient multi-channel lookups
   * during a single dispatch call.
   */
  async getPreferenceMap(
    userId: string,
  ): Promise<Map<string, boolean>> {
    const prefs = await this.prefRepo.find({ where: { userId } });
    const map = new Map<string, boolean>();
    for (const p of prefs) {
      map.set(`${p.type}:${p.channel}`, p.isEnabled);
    }
    return map;
  }
}
