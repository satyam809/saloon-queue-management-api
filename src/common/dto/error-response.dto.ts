import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Documents the error shape returned by HttpExceptionFilter and
 * AllExceptionsFilter — consistent across the entire API.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: '2026-04-03T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/auth/login' })
  path: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  requestId: string;

  @ApiProperty({
    description: 'Human-readable reason. Array when multiple validation errors exist.',
    oneOf: [
      { type: 'string',  example: 'Email already registered' },
      { type: 'array',  items: { type: 'string' }, example: ['name must not be empty', 'email must be an email'] },
    ],
  })
  message: string | string[];

  @ApiPropertyOptional({ example: 'Bad Request' })
  error?: string;
}
