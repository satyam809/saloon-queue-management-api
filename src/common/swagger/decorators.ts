import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '@common/dto/error-response.dto';

// ─── Envelope helpers ──────────────────────────────────────────────────────
// Every response is wrapped by TransformInterceptor:
//   { success: true, statusCode, data: <DTO>, timestamp }
// These decorators document that real shape instead of the raw DTO.

const TIMESTAMP_EXAMPLE = '2026-04-03T12:00:00.000Z';

function envelopeProps(statusCode: number) {
  return {
    success:    { type: 'boolean',     example: true },
    statusCode: { type: 'number',      example: statusCode },
    timestamp:  { type: 'string',      format: 'date-time', example: TIMESTAMP_EXAMPLE },
  };
}

// ─── Single-object responses ───────────────────────────────────────────────

/**
 * GET → 200 with `data` holding a single DTO.
 *
 * @example
 *   \@ApiOkWrapped(UserResponseDto)
 */
export function ApiOkWrapped(model: Type) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          ...envelopeProps(200),
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
}

/**
 * POST → 201 with `data` holding a single DTO.
 *
 * @example
 *   \@ApiCreatedWrapped(SalonResponseDto)
 */
export function ApiCreatedWrapped(model: Type) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      schema: {
        properties: {
          ...envelopeProps(201),
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
}

// ─── Collection responses ──────────────────────────────────────────────────

/**
 * GET → 200 with `data` holding a paginated list.
 * Matches the shape returned by service.findAll() methods.
 *
 * @example
 *   \@ApiPaginatedResponse(BarberResponseDto)
 */
export function ApiPaginatedResponse(model: Type) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          ...envelopeProps(200),
          data: {
            type: 'object',
            properties: {
              items:      { type: 'array', items: { $ref: getSchemaPath(model) } },
              total:      { type: 'number', example: 42 },
              page:       { type: 'number', example: 1 },
              limit:      { type: 'number', example: 10 },
              totalPages: { type: 'number', example: 5 },
            },
          },
        },
      },
    }),
  );
}

/**
 * GET → 200 with `data` holding a plain array (non-paginated).
 *
 * @example
 *   \@ApiOkArrayWrapped(QueueEntryResponseDto)
 */
export function ApiOkArrayWrapped(model: Type) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          ...envelopeProps(200),
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
        },
      },
    }),
  );
}

// ─── Error bundles ─────────────────────────────────────────────────────────

/**
 * Documents 401 + 403. Add to any authenticated endpoint.
 */
export function ApiAuthErrors() {
  return applyDecorators(
    ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token', type: ErrorResponseDto }),
    ApiForbiddenResponse({   description: 'Insufficient role or permission',  type: ErrorResponseDto }),
  );
}

/**
 * Documents 400 + 401 + 403 + 404. Standard bundle for most write endpoints.
 */
export function ApiCommonErrors() {
  return applyDecorators(
    ApiBadRequestResponse({  description: 'Validation failed',               type: ErrorResponseDto }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token', type: ErrorResponseDto }),
    ApiForbiddenResponse({   description: 'Insufficient role or permission',  type: ErrorResponseDto }),
    ApiNotFoundResponse({    description: 'Resource not found',               type: ErrorResponseDto }),
  );
}

/**
 * Documents 409. Add to create/upsert routes that may conflict.
 */
export function ApiConflictErrors() {
  return applyDecorators(
    ApiConflictResponse({ description: 'Conflict — resource already exists', type: ErrorResponseDto }),
  );
}
