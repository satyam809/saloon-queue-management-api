import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule as AppConfigModule } from '@config/config.module';
import { DatabaseConfig } from '@config/database.config';
import { winstonConfig } from '@config/logger.config';
import { CommonModule } from '@common/common.module';
import { SharedModule } from '@shared/shared.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';
import { SalonModule } from '@modules/salon/salon.module';
import { QueueModule } from '@modules/queue/queue.module';
import { AppointmentModule } from '@modules/appointment/appointment.module';
import { NotificationModule } from '@modules/notification/notification.module';
import appConfig from '@config/app.config';
import databaseConfig from '@config/database.config';
import jwtConfig from '@config/jwt.config';
import redisConfig from '@config/redis.config';

@Module({
  imports: [
    // Config — loads env vars and validates them
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      cache: true,
    }),

    // Logger
    WinstonModule.forRoot(winstonConfig),

    // Database
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),

    // Core
    AppConfigModule,
    CommonModule,
    SharedModule,

    // Feature modules
    AuthModule,
    UserModule,
    SalonModule,
    QueueModule,
    AppointmentModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
