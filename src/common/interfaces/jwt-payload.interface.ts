import { Role } from '@common/enums/role.enum';

export interface JwtPayload {
  sub: string;   // user UUID
  email: string;
  role: Role;
  iat?: number;  // issued at  (set by JWT library)
  exp?: number;  // expires at (set by JWT library)
}
