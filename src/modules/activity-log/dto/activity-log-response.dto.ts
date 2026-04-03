import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '@common/enums/role.enum';
import { ActivityLog } from '../entities/activity-log.entity';

export class ActivityLogResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() userId: string | null;
  @ApiPropertyOptional() actorRole: Role | null;
  @ApiProperty() action: string;
  @ApiProperty() category: string;
  @ApiProperty() entityType: string;
  @ApiProperty() entityId: string;
  @ApiPropertyOptional() oldValues: Record<string, any> | null;
  @ApiPropertyOptional() newValues: Record<string, any> | null;
  @ApiPropertyOptional() metadata: Record<string, any> | null;
  @ApiPropertyOptional() ipAddress: string | null;
  @ApiPropertyOptional() userAgent: string | null;
  @ApiProperty() createdAt: Date;

  static from(log: ActivityLog): ActivityLogResponseDto {
    const dto        = new ActivityLogResponseDto();
    dto.id           = log.id;
    dto.userId       = log.userId;
    dto.actorRole    = log.actorRole;
    dto.action       = log.action;
    dto.category     = log.category;
    dto.entityType   = log.entityType;
    dto.entityId     = log.entityId;
    dto.oldValues    = log.oldValues;
    dto.newValues    = log.newValues;
    dto.metadata     = log.metadata;
    dto.ipAddress    = log.ipAddress;
    dto.userAgent    = log.userAgent;
    dto.createdAt    = log.createdAt;
    return dto;
  }
}
