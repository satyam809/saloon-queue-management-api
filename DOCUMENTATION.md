# Saloon Queue Management API — Complete Documentation

> Production-grade REST API built with NestJS for managing salon queues, appointments, payments, staff, and customer interactions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Getting Started](#4-getting-started)
5. [Environment Variables](#5-environment-variables)
6. [Database & Data Model](#6-database--data-model)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Role-Based Access Control (RBAC)](#8-role-based-access-control-rbac)
9. [API Modules & Endpoints](#9-api-modules--endpoints)
   - [Health Check](#91-health-check)
   - [Authentication](#92-authentication)
   - [Users](#93-users)
   - [Salons](#94-salons)
   - [Barbers](#95-barbers)
   - [Services](#96-services)
   - [Queue Management](#97-queue-management)
   - [Appointments](#98-appointments)
   - [Payments](#99-payments)
   - [Reviews](#910-reviews)
   - [Analytics](#911-analytics)
   - [Activity Logs](#912-activity-logs)
   - [Notifications](#913-notifications)
10. [Queue System Deep Dive](#10-queue-system-deep-dive)
11. [Caching Strategy (Redis)](#11-caching-strategy-redis)
12. [Security](#12-security)
13. [Global Infrastructure](#13-global-infrastructure)
14. [Shared Utilities](#14-shared-utilities)
15. [Error Handling](#15-error-handling)
16. [Logging](#16-logging)
17. [Key Invariants & Constraints](#17-key-invariants--constraints)
18. [Scripts & CLI](#18-scripts--cli)
19. [Swagger / OpenAPI](#19-swagger--openapi)

---

## 1. Project Overview

The **Saloon Queue Management API** is a multi-tenant backend for salon businesses. It provides:

- **Real-time queue management** with Redis-backed live state and atomic Lua scripts
- **Appointment booking** with double-booking conflict detection
- **Full payment lifecycle** including refunds and multi-gateway support
- **Role-based access control** with 67 granular permissions across 5 roles
- **Multi-channel notifications** (in-app, email, SMS, push)
- **Complete audit trail** via append-only activity logs
- **Business analytics** with revenue, customer trends, and performance reports

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | NestJS | ^10.0.0 |
| Language | TypeScript | ^5.1.3 |
| Database | MySQL (via TypeORM) | mysql2 ^3.6.0 / typeorm ^0.3.17 |
| Cache / Queue State | Redis (via ioredis) | ^5.3.2 |
| Authentication | JWT + Passport | @nestjs/jwt ^10.1.0 |
| Password Hashing | bcrypt | ^5.1.0 |
| Validation | class-validator + class-transformer | ^0.14.0 / ^0.5.1 |
| API Documentation | Swagger / OpenAPI | @nestjs/swagger ^7.1.0 |
| Logging | Winston + daily rotate | ^3.10.0 |
| Security | Helmet | ^7.0.0 |
| Rate Limiting | @nestjs/throttler | ^6.5.0 |
| Compression | compression | ^1.7.4 |

---

## 3. Project Structure

```
src/
├── main.ts                                    # Bootstrap: security, Swagger, logging
├── app.module.ts                              # Root module
├── app.controller.ts                          # Health check
├── app.service.ts                             # App service (uptime)
│
├── config/
│   ├── app.config.ts                          # NODE_ENV, PORT, CORS
│   ├── jwt.config.ts                          # JWT secrets, expiry durations
│   ├── redis.config.ts                        # Redis host, port, password, TTL
│   ├── database.config.ts                     # TypeORM MySQL options
│   ├── logger.config.ts                       # Winston configuration
│   └── config.module.ts                       # Exports DatabaseConfig provider
│
├── database/
│   ├── base.entity.ts                         # Abstract base: id, createdAt, updatedAt, deletedAt
│   ├── data-source.ts                         # TypeORM DataSource for migrations
│   └── snake-naming.strategy.ts               # camelCase → snake_case columns
│
├── common/
│   ├── common.module.ts                       # Registers global guards
│   ├── decorators/
│   │   ├── public.decorator.ts                # @Public() — skip JWT auth
│   │   ├── current-user.decorator.ts          # @CurrentUser() — extract JWT payload
│   │   ├── roles.decorator.ts                 # @Roles(...) — role gate
│   │   └── require-permissions.decorator.ts   # @RequirePermissions(...) — permission gate
│   ├── dto/
│   │   ├── pagination.dto.ts                  # page, limit, skip getter
│   │   └── error-response.dto.ts              # Standardized error envelope
│   ├── enums/
│   │   ├── role.enum.ts                       # SUPER_ADMIN, ONBOARDING_STAFF, SALON_OWNER, STAFF, CUSTOMER
│   │   ├── permission.enum.ts                 # 67 granular permissions
│   │   ├── status.enum.ts                     # Statuses for user, salon, barber, queue, appointment, payment
│   │   └── notification.enum.ts               # NotificationType, NotificationChannel, NotificationPriority
│   ├── filters/
│   │   ├── all-exceptions.filter.ts           # Catch-all: 500 with requestId
│   │   └── http-exception.filter.ts           # Formats HTTP exceptions
│   ├── guards/
│   │   ├── jwt-auth.guard.ts                  # Bearer JWT validation
│   │   ├── jwt-refresh.guard.ts               # Refresh token guard
│   │   ├── local-auth.guard.ts                # email+password guard
│   │   ├── roles.guard.ts                     # Role enforcement
│   │   └── permissions.guard.ts               # Permission enforcement
│   ├── interceptors/
│   │   ├── logging.interceptor.ts             # Request/response logging with requestId
│   │   ├── transform.interceptor.ts           # Wrap all responses in { success, statusCode, data, timestamp }
│   │   └── timeout.interceptor.ts             # 30s hard timeout on every request
│   ├── interfaces/
│   │   ├── jwt-payload.interface.ts           # { sub, email, role, iat, exp }
│   │   └── paginated-result.interface.ts      # { data[], meta: { total, page, limit, totalPages } }
│   ├── rbac/
│   │   ├── role-permissions.map.ts            # Single source of truth: role → permissions[]
│   │   └── rbac.util.ts                       # canPerform, getPermissionsForRole helpers
│   └── swagger/
│       └── decorators.ts                      # ApiOkWrapped, ApiPaginatedResponse, error bundles
│
├── shared/
│   ├── shared.module.ts                       # Global module exporting RedisService
│   ├── services/
│   │   └── redis.service.ts                   # ioredis wrapper with error fallbacks
│   ├── constants/
│   │   └── app.constants.ts                   # Cache TTLs and Redis key builders
│   └── utils/
│       ├── hash.util.ts                       # hashPassword, comparePassword (bcrypt)
│       ├── date.util.ts                       # addMinutes, isFuture, isPast, minutesBetween
│       └── pagination.util.ts                 # paginate<T>() helper
│
└── modules/
    ├── auth/                                  # Registration, login, token rotation, password reset
    ├── user/                                  # User CRUD, profile management
    ├── salon/                                 # Salon lifecycle and onboarding
    ├── barber/                                # Barber profiles and availability
    ├── service/                               # Service catalog and barber assignments
    ├── queue/                                 # Daily queue with Redis live state
    ├── appointment/                           # Booking and scheduling
    ├── payment/                               # Payment records and refunds
    ├── review/                                # Customer reviews and moderation
    ├── analytics/                             # Business intelligence reports
    ├── activity-log/                          # Append-only audit trail
    ├── notification/                          # Multi-channel notification dispatch
    └── staff/                                 # Staff entity (role scoping)
```

---

## 4. Getting Started

### Prerequisites

- Node.js >= 18
- MySQL 8
- Redis 6+

### Installation

```bash
npm install
```

### Running

```bash
# Development (watch mode)
npm run start:dev

# Production build
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

### Database Migrations

```bash
# Generate migration from entity changes
npm run migration:generate -- migrations/MigrationName

# Apply pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

---

## 5. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | `development` \| `production` \| `test` | `development` |
| `PORT` | HTTP port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origin(s) | `*` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USERNAME` | MySQL user | — |
| `DB_PASSWORD` | MySQL password | — |
| `DB_NAME` | MySQL database name | — |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password (optional) | — |
| `REDIS_TTL` | Default Redis TTL (seconds) | `3600` |
| `JWT_SECRET` | Access token signing secret | — |
| `JWT_EXPIRES_IN` | Access token lifetime | `7d` |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | — |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `30d` |
| `THROTTLE_DEFAULT_TTL` | Rate limit window (ms) | `60000` |
| `THROTTLE_DEFAULT_LIMIT` | Requests per window | `300` |
| `THROTTLE_AUTH_TTL` | Auth rate limit window (ms) | `60000` |
| `THROTTLE_AUTH_LIMIT` | Auth requests per window | `10` |
| `THROTTLE_QUEUE_TTL` | Queue rate limit window (ms) | `60000` |
| `THROTTLE_QUEUE_LIMIT` | Queue requests per window | `30` |

---

## 6. Database & Data Model

### Base Entity

Every entity extends `BaseEntity` which provides:

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `createdAt` | timestamp | Set on INSERT |
| `updatedAt` | timestamp | Updated on every UPDATE |
| `deletedAt` | timestamp \| null | Soft-delete marker (TypeORM withDeleted) |

### Naming Strategy

All TypeScript `camelCase` property names are automatically converted to `snake_case` database columns by `SnakeNamingStrategy`.

---

### Entities

#### User

Table: `users`

| Column | Type | Notes |
|---|---|---|
| `name` | varchar(150) | |
| `email` | varchar(150) | Unique |
| `phone` | varchar(30) | Unique, nullable |
| `password_hash` | varchar | bcrypt, excluded from responses |
| `role` | enum | `SUPER_ADMIN \| ONBOARDING_STAFF \| SALON_OWNER \| STAFF \| CUSTOMER` |
| `status` | enum | `ACTIVE \| INACTIVE \| SUSPENDED` |
| `avatar_url` | varchar | nullable |
| `email_verified_at` | timestamp | nullable |
| `phone_verified_at` | timestamp | nullable |
| `last_login_at` | timestamp | nullable |

Relations: `ownedSalons`, `verifiedSalons`, `staffProfiles`, `barberProfiles`, `notifications`, `activityLogs`, `reviews`

---

#### Salon

Table: `salons`

| Column | Type | Notes |
|---|---|---|
| `owner_id` | UUID FK | References `users` |
| `name` | varchar(150) | |
| `slug` | varchar | Unique, URL-safe, auto-generated from name |
| `description` | text | nullable |
| `address / city / state / country / postal_code` | varchar | |
| `latitude / longitude` | decimal(10,7) | nullable |
| `phone / email` | varchar | nullable |
| `logo_url / cover_image_url` | varchar | nullable |
| `status` | enum | `PENDING \| ACTIVE \| REJECTED \| ARCHIVED \| SUSPENDED` |
| `is_verified` | boolean | Set by onboarding staff |
| `verified_by` | UUID FK | nullable, references `users` |
| `verified_at` | timestamp | nullable |
| `rejection_reason` | text | nullable |
| `avg_service_duration_minutes` | int | Used for wait time estimates |
| `max_queue_size` | int | Max concurrent waiting customers |
| `working_hours` | JSON | `{ mon: { open: "09:00", close: "18:00" }, ... }` |
| `timezone` | varchar | IANA timezone string (e.g. `Asia/Kolkata`) |

**Status Workflow:**
```
PENDING → ACTIVE    (approved by ONBOARDING_STAFF)
PENDING → REJECTED  (rejected by ONBOARDING_STAFF)
ACTIVE  → ARCHIVED  (owner archives)
ACTIVE  → SUSPENDED (admin suspends)
```

---

#### Barber

Table: `barbers`

| Column | Type | Notes |
|---|---|---|
| `salon_id` | UUID FK | References `salons` |
| `user_id` | UUID FK | nullable — links to a platform user account |
| `name` | varchar(150) | |
| `bio` | text | nullable |
| `avatar_url` | varchar | nullable |
| `email / phone` | varchar | nullable |
| `specializations` | JSON | Array of strings |
| `rating` | decimal(3,2) | 0.00–5.00 |
| `total_reviews` | int | Denormalized count |
| `is_available` | boolean | Toggle for floor availability |
| `status` | enum | `ACTIVE \| INACTIVE \| ON_LEAVE` |

---

#### Service

Table: `services`

| Column | Type | Notes |
|---|---|---|
| `salon_id` | UUID FK | |
| `name` | varchar(150) | |
| `description` | text | nullable |
| `category` | varchar(100) | nullable |
| `price` | decimal(10,2) | |
| `discount_price` | decimal(10,2) | nullable |
| `duration_minutes` | int | |
| `image_url` | varchar | nullable |
| `is_active` | boolean | |
| `sort_order` | int | Display ordering |

#### BarberService (pivot)

Table: `barber_services`

Joins `barbers` and `services` with optional overrides:

| Column | Type | Notes |
|---|---|---|
| `barber_id` | UUID FK | |
| `service_id` | UUID FK | |
| `custom_price` | decimal | nullable — overrides service.price |
| `custom_duration` | int | nullable — overrides service.duration_minutes |

---

#### Queue

Table: `queues`

| Column | Type | Notes |
|---|---|---|
| `salon_id` | UUID FK | |
| `date` | date | One queue per salon per date (unique) |
| `is_open` | boolean | |
| `opened_at` | timestamp | nullable |
| `closed_at` | timestamp | nullable |
| `current_serving_position` | int | Token number currently being served |
| `total_served` | int | Denormalized completed count |

#### QueueEntry

Table: `queue_entries`

| Column | Type | Notes |
|---|---|---|
| `queue_id` | UUID FK | |
| `customer_id` | UUID FK | |
| `barber_id` | UUID FK | nullable |
| `service_id` | UUID FK | nullable |
| `token_number` | int | Unique per queue (unique constraint with queue_id) |
| `position` | int | Snapshot position at check-in |
| `status` | enum | See state machine below |
| `estimated_wait_minutes` | int | Calculated at join time |
| `notes` | text | nullable |
| `checked_in_at` | timestamp | |
| `called_at` | timestamp | nullable |
| `service_started_at` | timestamp | nullable |
| `completed_at` | timestamp | nullable |
| `cancelled_at` | timestamp | nullable |
| `cancellation_reason` | text | nullable |

**Status State Machine:**
```
WAITING → CALLED → IN_PROGRESS → COMPLETED
                              └→ NO_SHOW
WAITING → CANCELLED
CALLED  → CANCELLED
CALLED  → NO_SHOW
```

---

#### Appointment

Table: `appointments`

| Column | Type | Notes |
|---|---|---|
| `customer_id` | UUID FK | |
| `salon_id` | UUID FK | |
| `barber_id` | UUID FK | nullable |
| `service_id` | UUID FK | nullable |
| `scheduled_at` | timestamp | Start time |
| `ends_at` | timestamp | Calculated from service duration |
| `status` | enum | `PENDING \| CONFIRMED \| IN_PROGRESS \| COMPLETED \| CANCELLED \| NO_SHOW` |
| `notes` | text | nullable |
| `cancellation_reason` | text | nullable |
| `queue_entry_id` | UUID FK | nullable — linked when converted to queue |

Unique constraint: `(barber_id, scheduled_at, ends_at, status)` prevents double booking.

---

#### Payment

Table: `payments`

| Column | Type | Notes |
|---|---|---|
| `payment_number` | varchar | Auto-generated: `PAY-YYYYMMDD-XXXXX` |
| `salon_id` | UUID FK | |
| `customer_id` | UUID FK | |
| `appointment_id` | UUID FK | nullable |
| `queue_entry_id` | UUID FK | nullable |
| `subtotal_amount` | decimal(12,2) | |
| `discount_amount` | decimal(12,2) | default 0 |
| `tax_amount` | decimal(12,2) | default 0 |
| `total_amount` | decimal(12,2) | = subtotal - discount + tax |
| `refunded_amount` | decimal(12,2) | Accumulated refunds |
| `method` | enum | `CASH \| CARD \| ONLINE \| WALLET` |
| `provider` | enum | `MANUAL \| STRIPE \| PAYPAL \| SQUARE` |
| `status` | enum | `PENDING \| COMPLETED \| FAILED \| REFUNDED \| PARTIALLY_REFUNDED` |
| `transaction_id` | varchar | nullable, unique — provider transaction reference |
| `provider_response` | JSON | nullable — raw gateway response |
| `paid_at` | timestamp | nullable |
| `failed_at` | timestamp | nullable |
| `failure_reason` | text | nullable |

#### PaymentRefund

Table: `payment_refunds`

| Column | Type | Notes |
|---|---|---|
| `payment_id` | UUID FK | |
| `amount` | decimal(12,2) | |
| `reason` | text | nullable |
| `processed_by` | UUID FK | nullable — references users |
| `processed_at` | timestamp | |
| `provider_refund_id` | varchar | nullable |

---

#### Review

Table: `reviews`

| Column | Type | Notes |
|---|---|---|
| `customer_id` | UUID FK | |
| `barber_id` | UUID FK | nullable |
| `salon_id` | UUID FK | nullable |
| `queue_entry_id` | UUID FK | nullable — proof of visit |
| `appointment_id` | UUID FK | nullable — proof of visit |
| `rating` | int | 1–5 |
| `title` | varchar(150) | nullable |
| `body` | text | nullable |
| `status` | enum | `PENDING \| PUBLISHED \| HIDDEN` |
| `is_verified_visit` | boolean | true if queueEntryId or appointmentId set |
| `replied_by` | UUID FK | nullable — owner/staff user |
| `reply_text` | text | nullable |
| `replied_at` | timestamp | nullable |

---

#### Notification

Table: `notifications`

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID FK | |
| `type` | enum | See NotificationType |
| `channel` | enum | `IN_APP \| EMAIL \| SMS \| PUSH` |
| `priority` | enum | `LOW \| MEDIUM \| HIGH \| URGENT` |
| `title` | varchar(255) | |
| `body` | text | |
| `is_read` | boolean | |
| `read_at` | timestamp | nullable |
| `sent_at` | timestamp | nullable |
| `metadata` | JSON | nullable — deep link data, entity IDs |
| `related_entity_type` | varchar | nullable — polymorphic reference |
| `related_entity_id` | UUID | nullable — polymorphic reference |

---

#### ActivityLog

Table: `activity_logs` — **Append-only audit trail, no soft delete**

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID | nullable (SET NULL on user delete) |
| `actor_role` | varchar | nullable |
| `action` | varchar | Dot-notation: `queue.entry.cancelled`, `salon.verified` |
| `category` | varchar | `queue`, `auth`, `salon`, etc. |
| `entity_type` | varchar | `queue_entry`, `payment`, etc. |
| `entity_id` | UUID | Polymorphic — no FK |
| `old_values` | JSON | nullable — state before change |
| `new_values` | JSON | nullable — state after change |
| `metadata` | JSON | nullable — extra context |
| `ip_address` | varchar | nullable |
| `user_agent` | varchar | nullable |

---

## 7. Authentication & Authorization

### Flow

```
1. POST /auth/register  →  creates CUSTOMER account
2. POST /auth/login     →  validates email+password → { accessToken, refreshToken }
3. API calls            →  Bearer <accessToken> in Authorization header
4. POST /auth/refresh   →  { refreshToken } in body → new { accessToken, refreshToken }
5. POST /auth/logout    →  revokes refreshToken in Redis
```

### JWT Access Token

- **Algorithm:** HS256
- **Payload:** `{ sub: userId, email, role, iat, exp }`
- **Lifetime:** configurable via `JWT_EXPIRES_IN` (default `7d`)
- **Validated on every request** by `JwtAuthGuard`
- **User status check:** on each request, `JwtStrategy` fetches `user:status:<userId>` from Redis (60s TTL). If user is SUSPENDED or INACTIVE, the request is rejected — no DB query needed on cache hit.

### Refresh Token Rotation

- Long-lived token (default `30d`), stored as `auth:refresh:<userId>` in Redis
- **Single-session enforcement:** only the latest issued refresh token is valid
- On refresh: old token is deleted, new token pair is issued and stored
- **Theft detection:** if an already-rotated token is presented, it will not match Redis → 401 Unauthorized

### Password Reset

1. `POST /auth/forgot-password` — always returns 200 (prevents user enumeration)
2. A time-limited one-use token is stored in Redis: `auth:password_reset:<token>`
3. `POST /auth/reset-password` — validates token, sets new password, revokes all sessions

---

## 8. Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|---|---|
| `SUPER_ADMIN` | Full access to everything. Receives all permissions automatically. |
| `ONBOARDING_STAFF` | Internal staff who verify salon registrations. Read-only on most resources. |
| `SALON_OWNER` | Business owner. Full control over their own salon, staff, and operations. |
| `STAFF` | Front-desk employee. Queue and appointment operations within a salon. |
| `CUSTOMER` | End user. Can browse, join queues, book appointments, pay, and review. |

### Permission Convention

Permissions follow the pattern `RESOURCE_ACTION_SCOPE`:

- `USER_READ_OWN` — read your own profile
- `USER_READ_ALL` — read any user's profile
- `SALON_UPDATE_OWN` — update your own salon
- `QUEUE_MANAGE` — manage queue entries (call next, complete, etc.)

### Role → Permissions Matrix

| Permission | SUPER_ADMIN | ONBOARDING_STAFF | SALON_OWNER | STAFF | CUSTOMER |
|---|:---:|:---:|:---:|:---:|:---:|
| USER_READ_ALL | ✓ | ✓ | | | |
| USER_READ_OWN | ✓ | ✓ | ✓ | ✓ | ✓ |
| USER_UPDATE_OWN | ✓ | ✓ | ✓ | ✓ | ✓ |
| USER_UPDATE_ANY | ✓ | | | | |
| USER_SUSPEND | ✓ | | | | |
| USER_DELETE | ✓ | | | | |
| SALON_CREATE | ✓ | | ✓ | | |
| SALON_READ_ALL | ✓ | ✓ | ✓ | ✓ | ✓ |
| SALON_UPDATE_OWN | ✓ | | ✓ | | |
| SALON_DELETE_OWN | ✓ | | ✓ | | |
| SALON_VERIFY | ✓ | ✓ | | | |
| BARBER_READ | ✓ | | ✓ | ✓ | ✓ |
| BARBER_CREATE | ✓ | | ✓ | | |
| BARBER_UPDATE | ✓ | | ✓ | ✓ | |
| BARBER_DELETE | ✓ | | ✓ | | |
| SERVICE_READ | ✓ | | ✓ | ✓ | ✓ |
| SERVICE_CREATE | ✓ | | ✓ | | |
| SERVICE_UPDATE | ✓ | | ✓ | | |
| SERVICE_DELETE | ✓ | | ✓ | | |
| QUEUE_CREATE | ✓ | | ✓ | ✓ | |
| QUEUE_READ | ✓ | | ✓ | ✓ | ✓ |
| QUEUE_JOIN | ✓ | | | | ✓ |
| QUEUE_MANAGE | ✓ | | ✓ | ✓ | |
| QUEUE_CLOSE | ✓ | | ✓ | ✓ | |
| APPOINTMENT_CREATE | ✓ | | ✓ | | ✓ |
| APPOINTMENT_READ_OWN | ✓ | | | | ✓ |
| APPOINTMENT_READ_SALON | ✓ | | ✓ | ✓ | |
| APPOINTMENT_UPDATE | ✓ | | ✓ | ✓ | |
| APPOINTMENT_CANCEL_OWN | ✓ | | | | ✓ |
| APPOINTMENT_CANCEL_ANY | ✓ | | ✓ | ✓ | |
| PAYMENT_READ_OWN | ✓ | | | | ✓ |
| PAYMENT_READ_SALON | ✓ | | ✓ | ✓ | |
| PAYMENT_REFUND | ✓ | | ✓ | | |
| REVIEW_CREATE | ✓ | | | | ✓ |
| REVIEW_READ | ✓ | | ✓ | ✓ | ✓ |
| REVIEW_REPLY | ✓ | | ✓ | | |
| ANALYTICS_READ_SALON | ✓ | | ✓ | | |
| ANALYTICS_READ_ALL | ✓ | ✓ | | | |
| ACTIVITY_LOG_READ_OWN | ✓ | | ✓ | | ✓ |
| ACTIVITY_LOG_READ_ALL | ✓ | ✓ | | | |
| NOTIFICATION_READ_OWN | ✓ | ✓ | ✓ | ✓ | ✓ |

> **Note:** SUPER_ADMIN receives all permissions dynamically — the matrix row is for documentation only.

### Ownership Check

Permissions like `SALON_UPDATE_OWN` grant the **capability** to update a salon. The actual **ownership check** (is this your salon?) is still enforced in the service layer. The guard only validates capability — resource identity is validated by the service.

---

## 9. API Modules & Endpoints

All responses are wrapped in a standard envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2026-04-05T10:00:00.000Z"
}
```

Paginated responses include:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "data": [...],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

### 9.1 Health Check

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Public | Returns application uptime and status |

---

### 9.2 Authentication

Base: `/auth` — Rate limited: **10 req / 60s**

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new customer account |
| `POST` | `/auth/login` | Public (LocalAuthGuard) | Email + password login, returns token pair |
| `POST` | `/auth/refresh` | JwtRefreshGuard | Rotate tokens using refresh token in body |
| `POST` | `/auth/logout` | JWT | Revoke refresh token (logout) |
| `POST` | `/auth/change-password` | JWT | Change password, revokes all existing sessions |
| `POST` | `/auth/forgot-password` | Public | Send password reset email (user-enumeration safe) |
| `POST` | `/auth/reset-password` | Public | Submit one-use reset token + new password |

**Register body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Str0ng!Pass",
  "phone": "+919876543210"
}
```

**Login body:**
```json
{ "email": "jane@example.com", "password": "Str0ng!Pass" }
```

**Login response:**
```json
{
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "tokenType": "Bearer",
    "expiresIn": 604800
  },
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "CUSTOMER"
  }
}
```

---

### 9.3 Users

Base: `/users`

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/users/me` | JWT | Get own profile |
| `PATCH` | `/users/me` | JWT | Update own profile (name, phone, avatarUrl) |
| `GET` | `/users` | `USER_READ_ALL` | Paginated user list with search/filter/sort |
| `POST` | `/users` | `USER_CREATE` | Admin create user |
| `GET` | `/users/:id` | `USER_READ_ALL` | Get user by ID |
| `PATCH` | `/users/:id` | `USER_UPDATE_ANY` | Admin update user (role, status, email) |
| `PATCH` | `/users/:id/suspend` | `USER_SUSPEND` | Suspend user with reason |
| `PATCH` | `/users/:id/activate` | `USER_SUSPEND` | Reactivate suspended user |
| `DELETE` | `/users/:id` | `USER_DELETE` | Soft-delete user |

**Query params for `GET /users`:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Search name or email |
| `role` | Role enum | Filter by role |
| `status` | UserStatus enum | Filter by status |
| `sortBy` | `name \| email \| createdAt` | Sort field |
| `sortOrder` | `ASC \| DESC` | Sort direction |
| `page` | number | Default: 1 |
| `limit` | number | Default: 20, max: 100 |

**Visibility scoping by role:**
- `SUPER_ADMIN`: sees all users
- `ONBOARDING_STAFF`: sees all except other SUPER_ADMIN/ONBOARDING_STAFF
- `SALON_OWNER` / `STAFF`: sees only CUSTOMER role users
- `CUSTOMER`: can only access `GET /users/me`

---

### 9.4 Salons

Base: `/salons`

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/salons` | Public | Paginated salon list (active only for public) |
| `GET` | `/salons/:id` | Public | Single salon (non-active only visible to owner/staff/admin) |
| `POST` | `/salons` | `SALON_CREATE` | Create salon (creator becomes owner) |
| `PATCH` | `/salons/:id` | `SALON_UPDATE_OWN` | Update own salon |
| `PATCH` | `/salons/:id/approve` | `SALON_VERIFY` | Approve pending salon → ACTIVE |
| `PATCH` | `/salons/:id/reject` | `SALON_VERIFY` | Reject pending salon with reason |
| `PATCH` | `/salons/:id/archive` | `SALON_DELETE_OWN` | Archive own salon |
| `DELETE` | `/salons/:id` | `SALON_DELETE_ANY` | Hard-delete (SUPER_ADMIN only) |

**Query params for `GET /salons`:**

| Param | Description |
|---|---|
| `search` | Search name, slug, city |
| `city` | Filter by city |
| `status` | Filter by status (admin only) |
| `sortBy` | `name \| createdAt \| rating` |
| `sortOrder` | `ASC \| DESC` |
| `page` / `limit` | Pagination |

---

### 9.5 Barbers

Base: `/barbers`

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/barbers` | Public | Paginated barber list |
| `GET` | `/barbers/:id` | Public | Single barber |
| `POST` | `/barbers` | `BARBER_CREATE` | Create barber profile |
| `PATCH` | `/barbers/:id` | `BARBER_UPDATE` | Update barber |
| `PATCH` | `/barbers/:id/availability` | `BARBER_UPDATE` | Toggle isAvailable (floor staff quick action) |
| `DELETE` | `/barbers/:id` | `BARBER_DELETE` | Soft-delete barber |

**Query params for `GET /barbers`:**

| Param | Description |
|---|---|
| `salonId` | Filter by salon (required for non-admins) |
| `search` | Search name |
| `isAvailable` | `true \| false` |
| `status` | Filter by status |
| `sortBy` | `name \| rating \| createdAt` |

---

### 9.6 Services

Base: `/services`

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/services` | Public | Paginated service list (active only for public) |
| `GET` | `/services/:id` | Public | Single service |
| `GET` | `/services/:id/barbers` | `SERVICE_READ` | List barbers assigned to service |
| `POST` | `/services` | `SERVICE_CREATE` | Create service |
| `PATCH` | `/services/:id` | `SERVICE_UPDATE` | Update service |
| `DELETE` | `/services/:id` | `SERVICE_DELETE` | Soft-delete service |
| `POST` | `/services/:id/barbers` | `SERVICE_UPDATE` | Assign barber with optional price/duration override |
| `DELETE` | `/services/:id/barbers/:barberId` | `SERVICE_UPDATE` | Remove barber from service |

---

### 9.7 Queue Management

Base: `/queues` — Rate limited: **30 req / 60s**

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `POST` | `/queues` | `QUEUE_CREATE` | Open daily queue for a salon |
| `GET` | `/queues/salon/:salonId/live` | Public | Live queue state (cached 60s) |
| `GET` | `/queues/salon/:salonId` | `QUEUE_READ` | Queue by salon + `?date=` |
| `GET` | `/queues/:id/entries` | `QUEUE_READ` | List entries, optional `?status=` filter |
| `GET` | `/queues/:id/my-position` | JWT | Customer's live position in queue |
| `POST` | `/queues/:id/join` | `QUEUE_JOIN` | Join queue (atomic, duplicate-safe) |
| `PATCH` | `/queues/:id/call-next` | `QUEUE_MANAGE` | Advance queue: WAITING → CALLED |
| `PATCH` | `/queues/:id/close` | `QUEUE_CLOSE` | Close queue, bulk-cancel waiting entries |
| `PATCH` | `/queues/:id/force-reset` | `SUPER_ADMIN` | Cancel all waiting entries |
| `PATCH` | `/queues/entries/:entryId/start` | `QUEUE_MANAGE` | CALLED → IN_PROGRESS |
| `PATCH` | `/queues/entries/:entryId/complete` | `QUEUE_MANAGE` | IN_PROGRESS → COMPLETED |
| `PATCH` | `/queues/entries/:entryId/no-show` | `QUEUE_MANAGE` | Mark as NO_SHOW |
| `PATCH` | `/queues/entries/:entryId/cancel` | JWT | Cancel entry (own or staff) |

---

### 9.8 Appointments

Base: `/appointments`

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `POST` | `/appointments` | `APPOINTMENT_CREATE` | Book appointment (conflict detection) |
| `GET` | `/appointments/my` | JWT | Customer's own appointments |
| `GET` | `/appointments/salon/:salonId` | `APPOINTMENT_READ_SALON` | Salon's appointments |
| `GET` | `/appointments/:id` | JWT | Single appointment (ownership enforced) |
| `PATCH` | `/appointments/:id` | `APPOINTMENT_UPDATE` | Reschedule or update status |
| `PATCH` | `/appointments/:id/cancel` | `APPOINTMENT_CANCEL_OWN` | Customer cancels own appointment |

**Create body:**
```json
{
  "customerId": "uuid",
  "salonId": "uuid",
  "barberId": "uuid",
  "serviceId": "uuid",
  "scheduledAt": "2026-04-10T10:00:00.000Z"
}
```

---

### 9.9 Payments

Base: `/payments`

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/payments` | Role-scoped | List payments (own / salon / all) |
| `GET` | `/payments/:id` | Role-scoped | Payment details with refund history |
| `POST` | `/payments` | `PAYMENT_CREATE` | Create PENDING payment record |
| `PATCH` | `/payments/:id/confirm-offline` | `PAYMENT_CONFIRM` | Cash/POS → COMPLETED |
| `PATCH` | `/payments/:id/confirm-online` | `PAYMENT_CONFIRM` | Webhook: online gateway → COMPLETED |
| `PATCH` | `/payments/:id/fail` | `PAYMENT_CONFIRM` | Mark as FAILED with reason |
| `PATCH` | `/payments/:id/cancel` | `PAYMENT_CONFIRM` | Cancel PENDING payment |
| `POST` | `/payments/:id/refunds` | `PAYMENT_REFUND` | Issue partial or full refund |
| `GET` | `/payments/:id/refunds` | Role-scoped | List refund history |

**Amount invariant:** `total_amount = subtotal_amount - discount_amount + tax_amount`

**Refund serialization:** Uses `SELECT ... FOR UPDATE` pessimistic lock to prevent concurrent over-refunds.

---

### 9.10 Reviews

Base: `/reviews`

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/reviews` | Public | List reviews (PUBLISHED only for non-admin) |
| `GET` | `/reviews/:id` | Public | Single review |
| `POST` | `/reviews` | `REVIEW_CREATE` | Submit review (CUSTOMER only) |
| `PATCH` | `/reviews/:id/reply` | `REVIEW_REPLY` | Salon owner replies to review |
| `PATCH` | `/reviews/:id/flag` | Admin | Moderate: hide or restore a review |

**Query params:**

| Param | Description |
|---|---|
| `salonId` | Filter by salon |
| `barberId` | Filter by barber |
| `rating` | Filter by rating (1–5) |
| `status` | Admin-only status filter |

---

### 9.11 Analytics

Base: `/analytics` — Results cached for 15 minutes in Redis

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/analytics/revenue` | `ANALYTICS_READ_SALON` or `ALL` | Revenue report |
| `GET` | `/analytics/customers` | `ANALYTICS_READ_SALON` or `ALL` | Customer trends |
| `GET` | `/analytics/performance` | `ANALYTICS_READ_SALON` or `ALL` | Queue & staff performance |

**Query params:**

| Param | Description |
|---|---|
| `startDate` | ISO date string |
| `endDate` | ISO date string |
| `salonId` | Scope to one salon (SALON_OWNER/STAFF required) |
| `granularity` | `DAILY \| WEEKLY \| MONTHLY` |

**Revenue report shape:**
```json
{
  "totalGross": 150000.00,
  "totalRefunds": 2500.00,
  "totalNet": 147500.00,
  "totalTransactions": 312,
  "byPeriod": [...],
  "byPaymentMethod": [...],
  "byService": [...]
}
```

---

### 9.12 Activity Logs

Base: `/activity-logs` — Read-only, append-only audit trail

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `GET` | `/activity-logs` | `ACTIVITY_LOG_READ_ALL` | Paginated filterable audit log (admin) |
| `GET` | `/activity-logs/me` | JWT | Authenticated user's own activity |
| `GET` | `/activity-logs/entity/:type/:id` | `ACTIVITY_LOG_READ_ALL` | Full audit trail for one entity |

**Query params:**

| Param | Description |
|---|---|
| `userId` | Filter by actor |
| `action` | Filter by action string |
| `category` | Filter by category |
| `entityType` | Filter by entity type |
| `entityId` | Filter by entity ID |
| `startDate` / `endDate` | Date range |

---

### 9.13 Notifications

Base: `/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/notifications` | JWT | List own notifications (paginated) |
| `GET` | `/notifications/unread-count` | JWT | Badge count of unread notifications |
| `PATCH` | `/notifications/:id/read` | JWT | Mark single notification as read (idempotent) |
| `PATCH` | `/notifications/read-all` | JWT | Bulk mark all as read |
| `DELETE` | `/notifications/:id` | JWT | Hard-delete own notification |

**Notification Preferences** (`/notification-preferences`):

| Method | Path | Description |
|---|---|---|
| `GET` | `/notification-preferences` | List my preferences |
| `PUT` | `/notification-preferences` | Bulk upsert all preferences |
| `PATCH` | `/notification-preferences/:type/:channel` | Upsert one preference |

**Notification Templates** (`/notification-templates`) — Admin only:

| Method | Path | Description |
|---|---|---|
| `GET` | `/notification-templates` | List templates |
| `POST` | `/notification-templates` | Create template |
| `PATCH` | `/notification-templates/:id` | Update template |
| `DELETE` | `/notification-templates/:id` | Delete template |

---

## 10. Queue System Deep Dive

### Architecture

The queue system combines MySQL (authoritative) with Redis (performance) to serve high-concurrency queue operations with sub-millisecond response times.

```
Customer JOIN
     │
     ├─► Redis CLAIM_TOKEN (Lua)
     │     ├─ Checks MEMBER_LOCK → reject duplicate
     │     └─ INCR TOKEN_SEQ → return token number
     │
     ├─► MySQL INSERT queue_entry
     │
     └─► Redis ZADD WAITING_SET (score = join timestamp)

Staff CALL_NEXT
     │
     ├─► Redis CALL_NEXT (Lua)
     │     └─ ZRANGE + ZREM WAITING_SET → return entryId
     │
     └─► MySQL UPDATE SET status='CALLED' WHERE status='WAITING'
```

### Redis Keys

| Key Pattern | Type | TTL | Content |
|---|---|---|---|
| `queue:state:<queueId>` | Hash | 60s | waitingCount, currentServingToken, avgDuration |
| `queue:waiting:<queueId>` | Sorted Set | EOD | entryId → join timestamp (FIFO) |
| `queue:token_seq:<queueId>` | String | EOD | Auto-increment token counter |
| `queue:member_lock:<queueId>:<customerId>` | String | EOD | Duplicate-join prevention |
| `queue:user_position:<queueId>:<customerId>` | JSON | 5min | entryId, tokenNumber, position, ewt |

### Lua Scripts

#### CLAIM_TOKEN

Atomically prevents duplicate joins and issues a unique token number:

```lua
-- KEYS[1] = member lock key
-- KEYS[2] = token sequence key
-- ARGV[1] = TTL (seconds until end of day)
-- Returns: [0, tokenNumber] on success
--          [1, 0] if already in queue
if redis.call('EXISTS', KEYS[1]) == 1 then
  return {1, 0}
end
redis.call('SET', KEYS[1], '1', 'EX', ARGV[1])
local token = redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], ARGV[1])
return {0, token}
```

#### CALL_NEXT

Atomically dequeues the next waiting customer:

```lua
-- KEYS[1] = waiting sorted set key
-- Returns: entryId string, or "" if empty
local result = redis.call('ZRANGE', KEYS[1], 0, 0)
if #result == 0 then return "" end
redis.call('ZREM', KEYS[1], result[1])
return result[1]
```

### Token Format

Tokens are formatted as `A-NNN` (e.g., `A-007`, `A-042`).

### Wait Time Estimation

```
estimatedWaitMinutes = peopleAhead × avgServiceDurationMinutes
```

- `avgServiceDurationMinutes` is computed from a rolling average (Redis hash: `totalDurationSum / completedCount`)
- Falls back to `salon.avgServiceDurationMinutes` until `ROLLING_AVG_MIN_SAMPLES` (3) services complete

### Concurrency Guarantees

| Scenario | Protection |
|---|---|
| Two customers join simultaneously | Lua script: only one gets the member lock |
| Two staff call-next simultaneously | Lua script: ZRANGE+ZREM is atomic — only one gets an entry |
| DB failure after Lua script | Member lock released, token gap accepted (harmless) |
| Redis eviction / restart | All operations fall back to DB queries + set rebuild |
| Stale Redis set entry | Conditional UPDATE on DB (WHERE status='WAITING') detects mismatch |

---

## 11. Caching Strategy (Redis)

| Data | Key Pattern | TTL | Strategy |
|---|---|---|---|
| Queue live state | `queue:state:<id>` | 60s | Read-through, invalidate on write |
| Queue waiting set | `queue:waiting:<id>` | EOD | Updated on every join/cancel/call |
| Token sequence | `queue:token_seq:<id>` | EOD | INCR only |
| Member lock | `queue:member_lock:<id>:<userId>` | EOD | SET NX, DEL on complete/cancel |
| User queue position | `queue:user_position:<id>:<userId>` | 5min | Set on join, DEL on complete/cancel |
| User status | `user:status:<userId>` | 60s | Read-through in JwtStrategy |
| Auth refresh token | `auth:refresh:<userId>` | 30d | Replaced on each rotation |
| Password reset token | `auth:password_reset:<token>` | 15min | DEL after use |
| Notification preferences | `notification:prefs:<userId>` | 5min | Read-through |
| Analytics reports | `analytics:<type>:<salonId>:<params>` | 15min | Read-through, regenerated from DB |

### Redis Resilience

- Exponential backoff reconnection (capped 3s, 20 retries)
- All Redis methods have fallback values (null, false, 0, [])
- `enableOfflineQueue: false` — fail fast instead of queuing commands during disconnection
- `available` flag: all commands no-op when Redis is unreachable

---

## 12. Security

### Hardening (main.ts)

| Measure | Detail |
|---|---|
| **Helmet** | HSTS, X-Frame-Options, X-Content-Type-Options, CSP |
| **CORS** | Configurable origin via `CORS_ORIGIN` env |
| **Compression** | brotli (quality 4) + gzip fallback, 1 KB threshold |
| **ETags** | Weak ETags for conditional GET caching |
| **Validation** | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| **Rate limiting** | 3 tiers: default 300/60s, auth 10/60s, queue 30/60s |
| **Timeout** | 30s hard cap via `TimeoutInterceptor` |

### Password Security

- bcrypt with `SALT_ROUNDS = 12` (≈300ms per hash)
- Salt is embedded in the hash — no separate storage needed
- `comparePassword` uses bcrypt's constant-time comparison

### JWT Security

- Separate secrets for access and refresh tokens
- Refresh token stored only in Redis (not in DB)
- Single-use rotation with theft detection
- User status re-validated on every access token use

---

## 13. Global Infrastructure

### Request Lifecycle

```
Request
  → Helmet/CORS/Compression (middleware)
  → ThrottlerGuard (rate limiting)
  → LoggingInterceptor (assigns requestId, logs start)
  → TimeoutInterceptor (30s timer starts)
  → JwtAuthGuard (validates Bearer token, unless @Public())
  → RolesGuard (checks @Roles())
  → PermissionsGuard (checks @RequirePermissions())
  → Controller method
  → TransformInterceptor (wraps response in envelope)
  → LoggingInterceptor (logs completion + duration)
Response
```

### Response Envelope

All responses (including errors) are wrapped:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2026-04-05T12:00:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "timestamp": "2026-04-05T12:00:00.000Z",
  "path": "/queues/abc/join",
  "requestId": "uuid",
  "message": "Queue is full (maximum 50 customers)",
  "error": "Bad Request"
}
```

### Activity Logging Pattern

All state mutations emit an activity log entry using the fire-and-forget pattern:

```typescript
void this.actLog.log({
  userId:     requester.sub,
  actorRole:  requester.role,
  action:     'queue.entry.cancelled',
  category:   'queue',
  entityType: 'queue_entry',
  entityId:   entryId,
  oldValues:  { status: 'WAITING' },
  newValues:  { status: 'CANCELLED' },
  metadata:   { reason: dto.reason },
});
```

Using `void` ensures log failures never block business operations.

---

## 14. Shared Utilities

### `hash.util.ts`

```typescript
hashPassword(plain: string): Promise<string>
// bcrypt hash with SALT_ROUNDS=12

comparePassword(plain: string, hash: string): Promise<boolean>
// Timing-safe bcrypt comparison
```

### `date.util.ts`

```typescript
addMinutes(date: Date, minutes: number): Date
// Returns new Date with minutes added (non-mutating)

isFuture(date: Date): boolean
// true if date > Date.now()

isPast(date: Date): boolean
// true if date < Date.now()

minutesBetween(start: Date, end: Date): number
// Returns Math.round((end - start) / 60_000)
```

### `pagination.util.ts`

```typescript
paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T>
// Returns { data, meta: { total, page, limit, totalPages } }
```

### `redis.service.ts`

Full ioredis wrapper exposing:

| Method | Description |
|---|---|
| `get / set / del / exists` | Basic key-value ops |
| `getJson / setJson` | JSON serialization helpers |
| `ttl / incr / expire` | Key metadata ops |
| `hset / hget / hmset / hgetall` | Hash field ops |
| `hincrbyfloat / hincrby` | Hash numeric increment ops |
| `zadd / zrem / zrank / zcard / zrange / zpopmin` | Sorted set ops |
| `eval(script, keys, args)` | Atomic Lua script execution |
| `pipeline()` | Batch commands into one TCP round-trip |

All methods return safe fallback values when Redis is unavailable.

### `app.constants.ts`

Cache TTL presets:

```typescript
QUEUE_TTL.EOD_SECONDS        // seconds until midnight
QUEUE_TTL.STATE_SECONDS      // 60
QUEUE_TTL.USER_POSITION_SECONDS  // 300

AUTH_TTL.REFRESH_SECONDS     // 30 days
AUTH_TTL.RESET_SECONDS       // 900 (15 min)
AUTH_TTL.USER_STATUS_SECONDS // 60
```

Redis key builders:

```typescript
QUEUE_CACHE_KEY.STATE(queueId)
QUEUE_CACHE_KEY.WAITING_SET(queueId)
QUEUE_CACHE_KEY.TOKEN_SEQ(queueId)
QUEUE_CACHE_KEY.MEMBER_LOCK(queueId, customerId)
QUEUE_CACHE_KEY.USER_POSITION(queueId, customerId)
AUTH_CACHE_KEY.REFRESH(userId)
AUTH_CACHE_KEY.RESET(token)
AUTH_CACHE_KEY.USER_STATUS(userId)
```

---

## 15. Error Handling

### HTTP Exceptions

Standard NestJS HTTP exceptions are thrown from services and caught by `HttpExceptionFilter`:

| Exception | Status | When |
|---|---|---|
| `BadRequestException` | 400 | Validation failures, invalid state transitions |
| `UnauthorizedException` | 401 | Invalid/expired token |
| `ForbiddenException` | 403 | Insufficient role or permissions |
| `NotFoundException` | 404 | Entity not found |
| `ConflictException` | 409 | Duplicate entries, concurrent modification |
| `InternalServerErrorException` | 500 | Unexpected failures (DB errors, etc.) |

### AllExceptionsFilter

Catches any thrown value that is not an `HttpException`. Returns 500 with:

```json
{
  "success": false,
  "statusCode": 500,
  "message": "Internal server error",
  "requestId": "uuid",
  "timestamp": "..."
}
```

And logs the full stack trace via Winston.

---

## 16. Logging

### Winston Configuration

- **Development:** colorized console output with timestamp and context
- **Production:** structured JSON logs

### Log Files (Daily Rotation)

| File | Levels | Retention |
|---|---|---|
| `logs/error-YYYY-MM-DD.log` | error only | 30 days |
| `logs/combined-YYYY-MM-DD.log` | all levels | 14 days |

### Request Logging (LoggingInterceptor)

Every request logs:
- **On start:** `requestId`, method, URL, user ID (if authenticated)
- **On success:** status code, duration (ms)
- **On error:** status code, error message, duration

---

## 17. Key Invariants & Constraints

| Constraint | Enforcement |
|---|---|
| One queue per salon per date | DB unique index: `(salon_id, date)` |
| Token numbers unique per queue | DB unique index: `(queue_id, token_number)` |
| One active refresh token per user | Redis key overwrites on each rotation |
| Barber double-booking prevention | DB unique index: `(barber_id, scheduled_at, ends_at, status)` |
| No over-refunding | `SELECT FOR UPDATE` + amount check before insert |
| Payment amount equation | `total = subtotal - discount + tax` enforced on create |
| One barber↔service assignment | DB unique index: `(barber_id, service_id)` |
| One review per visit | DB unique index: `(customer_id, queue_entry_id)` and `(customer_id, appointment_id)` |
| Non-active salons hidden from public | Status check in service layer |
| Users cannot escalate their own role | Service layer privilege escalation guard |
| Queue entry status transitions | `conditionalStatusUpdate` (optimistic lock via `WHERE status = :expected`) |

---

## 18. Scripts & CLI

```bash
# Build
npm run build

# Development
npm run start:dev       # hot reload
npm run start:debug     # debug mode

# Production
npm run start:prod      # runs dist/main.js

# Code quality
npm run format          # prettier
npm run lint            # eslint --fix

# Tests
npm test                # unit tests
npm run test:watch      # watch mode
npm run test:cov        # with coverage report
npm run test:e2e        # end-to-end tests

# Migrations
npm run migration:generate -- migrations/MyMigration
npm run migration:run
npm run migration:revert
```

### Path Aliases (tsconfig)

| Alias | Maps to |
|---|---|
| `@config/*` | `src/config/*` |
| `@common/*` | `src/common/*` |
| `@shared/*` | `src/shared/*` |
| `@modules/*` | `src/modules/*` |
| `@database/*` | `src/database/*` |

---

## 19. Swagger / OpenAPI

Swagger UI is available at: **`/api/docs`**

- Auto-generated from `@ApiProperty()`, `@ApiTags()`, `@ApiBearerAuth()` decorators
- All response shapes documented via custom Swagger helpers in `src/common/swagger/decorators.ts`
- Bearer auth scheme configured for easy testing in the browser

Custom helpers:
- `ApiOkWrapped(dto)` — documents `200 { success, statusCode, data: dto }`
- `ApiCreatedWrapped(dto)` — documents `201` envelope
- `ApiPaginatedResponse(dto)` — documents paginated response shape
- `ApiOkArrayWrapped(dto)` — documents array wrapped response
- `ApiErrorResponses(...codes)` — bundles common error response docs (400, 401, 403, 404, 409)

---

*Last updated: 2026-04-05*
