import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
  /**
   * Export UserService so AuthModule, SalonModule, StaffModule etc.
   * can call findByEmail(), updatePasswordHash(), updateLastLogin()
   * without circular imports.
   */
  exports: [UserService],
})
export class UserModule {}
