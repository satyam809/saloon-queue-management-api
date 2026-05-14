-- =============================================================================
-- SALON QUEUE MANAGEMENT SYSTEM — FULL DATABASE SCHEMA
-- Engine: MySQL 8.0+  |  Charset: utf8mb4  |  Collation: utf8mb4_unicode_ci
-- Conventions:
--   - UUID primary keys (char(36))
--   - snake_case column names
--   - Soft delete via deleted_at (NULL = not deleted)
--   - Audit trail: created_at, updated_at on every table
--   - Enum columns inline for portability
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- =============================================================================
-- 1. USERS
-- Central identity table. All roles share this table (single-table inheritance).
-- Barbers and Staff have FK references back here for app-account linkage.
-- =============================================================================
CREATE TABLE users (
  id                  CHAR(36)        NOT NULL,
  name                VARCHAR(100)    NOT NULL,
  email               VARCHAR(150)    NOT NULL,
  phone               VARCHAR(20)     NULL,
  password_hash       VARCHAR(255)    NOT NULL,
  role                ENUM(
                        'super_admin',
                        'onboarding_staff',
                        'salon_owner',
                        'customer'
                      )               NOT NULL DEFAULT 'customer',
  status              ENUM(
                        'active',
                        'inactive',
                        'suspended'
                      )               NOT NULL DEFAULT 'active',
  avatar_url          VARCHAR(500)    NULL,
  email_verified_at   DATETIME        NULL,
  phone_verified_at   DATETIME        NULL,
  last_login_at       DATETIME        NULL,
  -- Audit fields
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME        NULL,

  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_phone UNIQUE (phone)
);

CREATE INDEX idx_users_role           ON users (role);
CREATE INDEX idx_users_status         ON users (status);
CREATE INDEX idx_users_deleted_at     ON users (deleted_at);
-- Partial-like: active users only (use WHERE deleted_at IS NULL in queries)
CREATE INDEX idx_users_email_active   ON users (email, deleted_at);


-- =============================================================================
-- 2. SALONS
-- Owned by a user with role=salon_owner.
-- Verified by onboarding_staff.
-- =============================================================================
CREATE TABLE salons (
  id                          CHAR(36)        NOT NULL,
  added_by                    CHAR(36)        NOT NULL,
  name                        VARCHAR(150)    NOT NULL,
  slug                        VARCHAR(160)    NOT NULL,           -- URL-friendly unique name
  description                 TEXT            NULL,
  -- Location
  address                     VARCHAR(255)    NULL,
  city                        VARCHAR(100)    NULL,
  state                       VARCHAR(100)    NULL,
  country                     VARCHAR(100)    NULL DEFAULT 'US',
  postal_code                 VARCHAR(20)     NULL,
  latitude                    DECIMAL(10,8)   NULL,
  longitude                   DECIMAL(11,8)   NULL,
  -- Media
  logo_url                    VARCHAR(500)    NULL,
  cover_image_url             VARCHAR(500)    NULL,
  -- Business config
  status                      ENUM(
                                'pending',
                                'active',
                                'inactive',
                                'suspended'
                              )               NOT NULL DEFAULT 'pending',
  is_verified                 TINYINT(1)      NOT NULL DEFAULT 0,
  verified_at                 DATETIME        NULL,
  verified_by                 CHAR(36)        NULL,               -- FK -> users (onboarding_staff)
  avg_service_duration_minutes SMALLINT       NOT NULL DEFAULT 30,
  max_queue_size              SMALLINT        NOT NULL DEFAULT 20,
  working_hours               JSON            NULL,               -- { "mon": {"open":"09:00","close":"18:00"}, ... }
  timezone                    VARCHAR(50)     NOT NULL DEFAULT 'UTC',
  -- Audit fields
  created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME        NULL,

  CONSTRAINT pk_salons PRIMARY KEY (id),
  CONSTRAINT uq_salons_slug UNIQUE (slug),
  CONSTRAINT fk_salons_owner FOREIGN KEY (added_by)     REFERENCES users (id),
  CONSTRAINT fk_salons_verifier FOREIGN KEY (verified_by) REFERENCES users (id)
);

CREATE INDEX idx_salons_added_by      ON salons (added_by);
CREATE INDEX idx_salons_status        ON salons (status);
CREATE INDEX idx_salons_city          ON salons (city);
CREATE INDEX idx_salons_deleted_at    ON salons (deleted_at);
CREATE INDEX idx_salons_location      ON salons (latitude, longitude); -- geo proximity queries
CREATE INDEX idx_salons_verified      ON salons (is_verified, status);


-- =============================================================================
-- 3. STAFF
-- Salon employees (managers, receptionists). May or may not have a user account.
-- Barbers are a separate table because they have distinct attributes.
-- =============================================================================
CREATE TABLE staff (
  id                CHAR(36)        NOT NULL,
  salon_id          CHAR(36)        NOT NULL,
  user_id           CHAR(36)        NULL,                         -- NULL if no app account
  name              VARCHAR(100)    NOT NULL,
  email             VARCHAR(150)    NULL,
  phone             VARCHAR(20)     NULL,
  role              ENUM(
                      'manager',
                      'receptionist',
                      'staff'
                    )               NOT NULL DEFAULT 'staff',
  status            ENUM(
                      'active',
                      'inactive',
                      'on_leave'
                    )               NOT NULL DEFAULT 'active',
  avatar_url        VARCHAR(500)    NULL,
  hired_at          DATE            NULL,
  -- Audit fields
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME        NULL,

  CONSTRAINT pk_staff PRIMARY KEY (id),
  CONSTRAINT fk_staff_salon FOREIGN KEY (salon_id) REFERENCES salons (id),
  CONSTRAINT fk_staff_user  FOREIGN KEY (user_id)  REFERENCES users  (id)
);

CREATE INDEX idx_staff_salon_id     ON staff (salon_id);
CREATE INDEX idx_staff_user_id      ON staff (user_id);
CREATE INDEX idx_staff_status       ON staff (status);
CREATE INDEX idx_staff_deleted_at   ON staff (deleted_at);
CREATE INDEX idx_staff_salon_role   ON staff (salon_id, role, deleted_at); -- find all managers of a salon


-- =============================================================================
-- 4. BARBERS
-- Can be linked to a user account. Have specializations, availability, ratings.
-- =============================================================================
CREATE TABLE barbers (
  id                    CHAR(36)        NOT NULL,
  salon_id              CHAR(36)        NOT NULL,
  user_id               CHAR(36)        NULL,
  name                  VARCHAR(100)    NOT NULL,
  bio                   TEXT            NULL,
  avatar_url            VARCHAR(500)    NULL,
  email                 VARCHAR(150)    NULL,
  phone                 VARCHAR(20)     NULL,
  specializations       JSON            NULL,                     -- ["haircut", "beard trim", "coloring"]
  rating                DECIMAL(3,2)    NOT NULL DEFAULT 0.00,    -- 0.00 – 5.00
  total_reviews         INT UNSIGNED    NOT NULL DEFAULT 0,
  is_available          TINYINT(1)      NOT NULL DEFAULT 1,
  status                ENUM(
                          'active',
                          'inactive',
                          'on_leave'
                        )               NOT NULL DEFAULT 'active',
  -- Audit fields
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME        NULL,

  CONSTRAINT pk_barbers PRIMARY KEY (id),
  CONSTRAINT fk_barbers_salon FOREIGN KEY (salon_id) REFERENCES salons (id),
  CONSTRAINT fk_barbers_user  FOREIGN KEY (user_id)  REFERENCES users  (id)
);

CREATE INDEX idx_barbers_salon_id       ON barbers (salon_id);
CREATE INDEX idx_barbers_user_id        ON barbers (user_id);
CREATE INDEX idx_barbers_status         ON barbers (status);
CREATE INDEX idx_barbers_available      ON barbers (salon_id, is_available, deleted_at);
CREATE INDEX idx_barbers_rating         ON barbers (rating DESC);
CREATE INDEX idx_barbers_deleted_at     ON barbers (deleted_at);


-- =============================================================================
-- 5. SERVICES
-- Services offered by a salon. Barbers can optionally override price/duration.
-- =============================================================================
CREATE TABLE services (
  id                  CHAR(36)        NOT NULL,
  salon_id            CHAR(36)        NOT NULL,
  name                VARCHAR(150)    NOT NULL,
  description         TEXT            NULL,
  category            VARCHAR(80)     NULL,                       -- "Hair", "Beard", "Skin"
  price               DECIMAL(10,2)   NOT NULL,
  discount_price      DECIMAL(10,2)   NULL,                       -- NULL = no discount
  duration_minutes    SMALLINT        NOT NULL DEFAULT 30,
  image_url           VARCHAR(500)    NULL,
  is_active           TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order          SMALLINT        NOT NULL DEFAULT 0,
  -- Audit fields
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME        NULL,

  CONSTRAINT pk_services PRIMARY KEY (id),
  CONSTRAINT fk_services_salon FOREIGN KEY (salon_id) REFERENCES salons (id)
);

CREATE INDEX idx_services_salon_id      ON services (salon_id);
CREATE INDEX idx_services_category      ON services (salon_id, category, is_active);
CREATE INDEX idx_services_active        ON services (is_active, deleted_at);
CREATE INDEX idx_services_deleted_at    ON services (deleted_at);


-- =============================================================================
-- 6. BARBER_SERVICES  (many-to-many pivot)
-- Links barbers to the services they perform.
-- Allows per-barber price/duration overrides.
-- =============================================================================
CREATE TABLE barber_services (
  id                  CHAR(36)        NOT NULL,
  barber_id           CHAR(36)        NOT NULL,
  service_id          CHAR(36)        NOT NULL,
  custom_price        DECIMAL(10,2)   NULL,                       -- NULL = use service.price
  custom_duration     SMALLINT        NULL,                       -- NULL = use service.duration_minutes
  -- Audit fields
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_barber_services           PRIMARY KEY (id),
  CONSTRAINT uq_barber_services           UNIQUE (barber_id, service_id),
  CONSTRAINT fk_barber_services_barber    FOREIGN KEY (barber_id)  REFERENCES barbers  (id) ON DELETE CASCADE,
  CONSTRAINT fk_barber_services_service   FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
);

CREATE INDEX idx_barber_services_barber   ON barber_services (barber_id);
CREATE INDEX idx_barber_services_service  ON barber_services (service_id);


-- =============================================================================
-- 7. QUEUES
-- One queue per salon per day. Controlled by staff (open/close).
-- =============================================================================
CREATE TABLE queues (
  id                        CHAR(36)    NOT NULL,
  salon_id                  CHAR(36)    NOT NULL,
  date                      DATE        NOT NULL,
  is_open                   TINYINT(1)  NOT NULL DEFAULT 0,
  opened_at                 DATETIME    NULL,
  closed_at                 DATETIME    NULL,
  current_serving_position  INT         NOT NULL DEFAULT 0,       -- last called token number
  total_served              INT         NOT NULL DEFAULT 0,
  -- Audit fields
  created_at                DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME    NULL,

  CONSTRAINT pk_queues              PRIMARY KEY (id),
  CONSTRAINT uq_queues_salon_date   UNIQUE (salon_id, date),
  CONSTRAINT fk_queues_salon        FOREIGN KEY (salon_id) REFERENCES salons (id)
);

CREATE INDEX idx_queues_salon_id    ON queues (salon_id);
CREATE INDEX idx_queues_date        ON queues (date);
CREATE INDEX idx_queues_is_open     ON queues (is_open, date);
CREATE INDEX idx_queues_deleted_at  ON queues (deleted_at);


-- =============================================================================
-- 8. QUEUE_ENTRIES
-- Each row is one customer's slot in the queue.
-- Lifecycle: waiting → called → in_progress → completed | cancelled | no_show
-- =============================================================================
CREATE TABLE queue_entries (
  id                      CHAR(36)        NOT NULL,
  queue_id                CHAR(36)        NOT NULL,
  customer_id             CHAR(36)        NOT NULL,
  barber_id               CHAR(36)        NULL,                   -- preferred barber (optional)
  service_id              CHAR(36)        NULL,                   -- service requested (optional)
  token_number            SMALLINT        NOT NULL,               -- display number (e.g. A-007)
  position                SMALLINT        NOT NULL,               -- order in queue
  status                  ENUM(
                            'waiting',
                            'called',
                            'in_progress',
                            'completed',
                            'cancelled',
                            'no_show'
                          )               NOT NULL DEFAULT 'waiting',
  estimated_wait_minutes  SMALLINT        NULL,
  -- Lifecycle timestamps
  checked_in_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  called_at               DATETIME        NULL,
  service_started_at      DATETIME        NULL,
  completed_at            DATETIME        NULL,
  cancelled_at            DATETIME        NULL,
  cancellation_reason     VARCHAR(255)    NULL,
  notes                   TEXT            NULL,
  -- Audit fields
  created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at              DATETIME        NULL,

  CONSTRAINT pk_queue_entries             PRIMARY KEY (id),
  CONSTRAINT uq_queue_entries_token       UNIQUE (queue_id, token_number),
  CONSTRAINT fk_queue_entries_queue       FOREIGN KEY (queue_id)    REFERENCES queues   (id),
  CONSTRAINT fk_queue_entries_customer    FOREIGN KEY (customer_id) REFERENCES users    (id),
  CONSTRAINT fk_queue_entries_barber      FOREIGN KEY (barber_id)   REFERENCES barbers  (id),
  CONSTRAINT fk_queue_entries_service     FOREIGN KEY (service_id)  REFERENCES services (id)
);

CREATE INDEX idx_qe_queue_id          ON queue_entries (queue_id);
CREATE INDEX idx_qe_customer_id       ON queue_entries (customer_id);
CREATE INDEX idx_qe_barber_id         ON queue_entries (barber_id);
CREATE INDEX idx_qe_service_id        ON queue_entries (service_id);
CREATE INDEX idx_qe_status            ON queue_entries (status);
CREATE INDEX idx_qe_queue_status      ON queue_entries (queue_id, status, position);  -- call-next query
CREATE INDEX idx_qe_customer_status   ON queue_entries (customer_id, status);          -- my active queue
CREATE INDEX idx_qe_deleted_at        ON queue_entries (deleted_at);


-- =============================================================================
-- 9. APPOINTMENTS
-- Pre-scheduled sessions. Can optionally convert to a queue entry on arrival.
-- =============================================================================
CREATE TABLE appointments (
  id                    CHAR(36)        NOT NULL,
  salon_id              CHAR(36)        NOT NULL,
  customer_id           CHAR(36)        NOT NULL,
  barber_id             CHAR(36)        NULL,
  service_id            CHAR(36)        NULL,
  queue_entry_id        CHAR(36)        NULL,                     -- set when customer checks in
  scheduled_at          DATETIME        NOT NULL,
  ends_at               DATETIME        NOT NULL,                 -- scheduled_at + duration
  duration_minutes      SMALLINT        NOT NULL DEFAULT 30,
  status                ENUM(
                          'pending',
                          'confirmed',
                          'in_progress',
                          'completed',
                          'cancelled',
                          'no_show'
                        )               NOT NULL DEFAULT 'pending',
  -- Lifecycle timestamps
  confirmed_at          DATETIME        NULL,
  reminder_sent_at      DATETIME        NULL,
  cancelled_at          DATETIME        NULL,
  cancellation_reason   VARCHAR(255)    NULL,
  notes                 TEXT            NULL,
  -- Audit fields
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME        NULL,

  CONSTRAINT pk_appointments              PRIMARY KEY (id),
  CONSTRAINT fk_appointments_salon        FOREIGN KEY (salon_id)        REFERENCES salons        (id),
  CONSTRAINT fk_appointments_customer     FOREIGN KEY (customer_id)     REFERENCES users         (id),
  CONSTRAINT fk_appointments_barber       FOREIGN KEY (barber_id)       REFERENCES barbers       (id),
  CONSTRAINT fk_appointments_service      FOREIGN KEY (service_id)      REFERENCES services      (id),
  CONSTRAINT fk_appointments_queue_entry  FOREIGN KEY (queue_entry_id)  REFERENCES queue_entries (id)
);

CREATE INDEX idx_appt_salon_id          ON appointments (salon_id);
CREATE INDEX idx_appt_customer_id       ON appointments (customer_id);
CREATE INDEX idx_appt_barber_id         ON appointments (barber_id);
CREATE INDEX idx_appt_service_id        ON appointments (service_id);
CREATE INDEX idx_appt_status            ON appointments (status);
CREATE INDEX idx_appt_scheduled_at      ON appointments (scheduled_at);
-- Conflict detection: barber double-booking check
CREATE INDEX idx_appt_conflict_check    ON appointments (barber_id, scheduled_at, ends_at, status);
-- Reminder job: find upcoming unreminded appointments
CREATE INDEX idx_appt_reminder          ON appointments (status, scheduled_at, reminder_sent_at);
CREATE INDEX idx_appt_deleted_at        ON appointments (deleted_at);


-- =============================================================================
-- 10. PAYMENTS
-- Linked to either a queue_entry or an appointment (at least one must be set).
-- Supports partial refunds via the payment_refunds child table.
--
-- Amount invariant (enforced in service layer):
--   total_amount = subtotal_amount - discount_amount + tax_amount
--
-- Refund invariant (enforced via SELECT FOR UPDATE in PaymentService.refund):
--   refunded_amount <= total_amount
-- =============================================================================
CREATE TABLE payments (
  id                    CHAR(36)        NOT NULL,
  payment_number        VARCHAR(30)     NOT NULL,                  -- PAY-20260330-00042
  salon_id              CHAR(36)        NOT NULL,
  customer_id           CHAR(36)        NOT NULL,
  queue_entry_id        CHAR(36)        NULL,
  appointment_id        CHAR(36)        NULL,
  -- Amount breakdown
  subtotal_amount       DECIMAL(10,2)   NOT NULL,
  discount_amount       DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  tax_amount            DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  total_amount          DECIMAL(10,2)   NOT NULL,                  -- subtotal - discount + tax
  refunded_amount       DECIMAL(10,2)   NOT NULL DEFAULT 0.00,     -- sum of payment_refunds.amount
  currency              CHAR(3)         NOT NULL DEFAULT 'USD',
  -- Payment method & gateway
  payment_method        ENUM(
                          'cash',
                          'card',
                          'online',
                          'wallet'
                        )               NOT NULL DEFAULT 'cash',
  provider              ENUM(
                          'manual',
                          'stripe',
                          'paypal',
                          'square'
                        )               NOT NULL DEFAULT 'manual',
  status                ENUM(
                          'pending',
                          'completed',
                          'failed',
                          'refunded',
                          'partially_refunded',
                          'cancelled'
                        )               NOT NULL DEFAULT 'pending',
  transaction_id        VARCHAR(255)    NULL,                      -- gateway intent / charge ID
  gateway_response      JSON            NULL,                      -- raw gateway payload (never exposed to clients)
  failure_reason        TEXT            NULL,                      -- populated on status=failed
  notes                 TEXT            NULL,                      -- internal staff notes
  -- Lifecycle timestamps
  paid_at               DATETIME        NULL,
  cancelled_at          DATETIME        NULL,
  -- Audit fields
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME        NULL,

  CONSTRAINT pk_payments                PRIMARY KEY (id),
  CONSTRAINT uq_payments_number         UNIQUE (payment_number),
  CONSTRAINT fk_payments_salon          FOREIGN KEY (salon_id)        REFERENCES salons        (id),
  CONSTRAINT fk_payments_customer       FOREIGN KEY (customer_id)     REFERENCES users         (id),
  CONSTRAINT fk_payments_queue_entry    FOREIGN KEY (queue_entry_id)  REFERENCES queue_entries (id),
  CONSTRAINT fk_payments_appointment    FOREIGN KEY (appointment_id)  REFERENCES appointments  (id),
  -- At least one source must be set (belt-and-suspenders; enforced in service too)
  CONSTRAINT chk_payments_source        CHECK (queue_entry_id IS NOT NULL OR appointment_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_payments_number          ON payments (payment_number);
CREATE INDEX idx_payments_salon_status           ON payments (salon_id, status);
CREATE INDEX idx_payments_salon_paid_at          ON payments (salon_id, paid_at);
CREATE INDEX idx_payments_customer_status        ON payments (customer_id, status);
CREATE INDEX idx_payments_queue_entry_id         ON payments (queue_entry_id);
CREATE INDEX idx_payments_appointment_id         ON payments (appointment_id);
CREATE UNIQUE INDEX idx_payments_transaction_id  ON payments (transaction_id);  -- idempotency key
CREATE INDEX idx_payments_deleted_at             ON payments (deleted_at);


-- =============================================================================
-- 10a. PAYMENT_REFUNDS
-- One row per refund event. Supports multiple partial refunds on a single payment.
-- No soft-delete: refund records are permanent ledger entries.
-- =============================================================================
CREATE TABLE payment_refunds (
  id                    CHAR(36)        NOT NULL,
  payment_id            CHAR(36)        NOT NULL,
  refunded_by_id        CHAR(36)        NOT NULL,                  -- staff member who issued the refund
  amount                DECIMAL(10,2)   NOT NULL,                  -- > 0, <= (total - already refunded)
  reason                TEXT            NOT NULL,
  transaction_id        VARCHAR(255)    NULL,                      -- gateway refund ID
  gateway_response      JSON            NULL,
  refunded_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Audit fields
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_payment_refunds             PRIMARY KEY (id),
  CONSTRAINT fk_payment_refunds_payment     FOREIGN KEY (payment_id)     REFERENCES payments (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_refunds_refunded_by FOREIGN KEY (refunded_by_id) REFERENCES users    (id),
  CONSTRAINT chk_refund_amount_positive     CHECK (amount > 0)
);

CREATE INDEX idx_refunds_payment_id   ON payment_refunds (payment_id);
CREATE INDEX idx_refunds_refunded_at  ON payment_refunds (refunded_at);
CREATE INDEX idx_refunds_staff        ON payment_refunds (refunded_by_id);


-- =============================================================================
-- 11. REVIEWS
-- Customers review a salon and optionally a specific barber.
-- Linked to a verified visit (queue_entry or appointment) to prevent fake reviews.
-- Owner/staff can post a reply once.
-- =============================================================================
CREATE TABLE reviews (
  id                    CHAR(36)        NOT NULL,
  salon_id              CHAR(36)        NOT NULL,
  customer_id           CHAR(36)        NOT NULL,
  barber_id             CHAR(36)        NULL,
  queue_entry_id        CHAR(36)        NULL,                     -- proof of visit
  appointment_id        CHAR(36)        NULL,                     -- proof of visit
  rating                TINYINT         NOT NULL,                 -- 1–5
  title                 VARCHAR(150)    NULL,
  body                  TEXT            NULL,
  is_verified_visit     TINYINT(1)      NOT NULL DEFAULT 0,       -- computed: has valid queue/appt ref
  is_published          TINYINT(1)      NOT NULL DEFAULT 1,
  published_at          DATETIME        NULL,
  -- Owner reply
  reply_body            TEXT            NULL,
  replied_by            CHAR(36)        NULL,                     -- FK -> users (owner/staff)
  replied_at            DATETIME        NULL,
  -- Audit fields
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME        NULL,

  CONSTRAINT pk_reviews               PRIMARY KEY (id),
  CONSTRAINT chk_reviews_rating       CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT uq_reviews_visit_queue   UNIQUE (customer_id, queue_entry_id),   -- one review per visit
  CONSTRAINT uq_reviews_visit_appt    UNIQUE (customer_id, appointment_id),
  CONSTRAINT fk_reviews_salon         FOREIGN KEY (salon_id)        REFERENCES salons        (id),
  CONSTRAINT fk_reviews_customer      FOREIGN KEY (customer_id)     REFERENCES users         (id),
  CONSTRAINT fk_reviews_barber        FOREIGN KEY (barber_id)       REFERENCES barbers       (id),
  CONSTRAINT fk_reviews_queue_entry   FOREIGN KEY (queue_entry_id)  REFERENCES queue_entries (id),
  CONSTRAINT fk_reviews_appointment   FOREIGN KEY (appointment_id)  REFERENCES appointments  (id),
  CONSTRAINT fk_reviews_replied_by    FOREIGN KEY (replied_by)      REFERENCES users         (id)
);

CREATE INDEX idx_reviews_salon_id         ON reviews (salon_id);
CREATE INDEX idx_reviews_customer_id      ON reviews (customer_id);
CREATE INDEX idx_reviews_barber_id        ON reviews (barber_id);
CREATE INDEX idx_reviews_rating           ON reviews (salon_id, rating);         -- avg rating calculation
CREATE INDEX idx_reviews_published        ON reviews (is_published, salon_id);
CREATE INDEX idx_reviews_deleted_at       ON reviews (deleted_at);


-- =============================================================================
-- 12. NOTIFICATIONS
-- Per-user notification records for in-app, email, SMS, push channels.
-- =============================================================================
CREATE TABLE notifications (
  id            CHAR(36)        NOT NULL,
  user_id       CHAR(36)        NOT NULL,
  type          ENUM(
                  'queue_called',
                  'queue_joined',
                  'appointment_confirmed',
                  'appointment_reminder',
                  'appointment_cancelled',
                  'payment_received',
                  'payment_refunded',
                  'review_reply',
                  'general'
                )               NOT NULL DEFAULT 'general',
  channel       ENUM(
                  'in_app',
                  'email',
                  'sms',
                  'push'
                )               NOT NULL DEFAULT 'in_app',
  title         VARCHAR(150)    NOT NULL,
  body          TEXT            NOT NULL,
  is_read       TINYINT(1)      NOT NULL DEFAULT 0,
  read_at       DATETIME        NULL,
  sent_at       DATETIME        NULL,
  metadata      JSON            NULL,                             -- { "queueEntryId": "...", "salonName": "..." }
  -- Audit fields
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_notifications       PRIMARY KEY (id),
  CONSTRAINT fk_notifications_user  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_notifs_user_id         ON notifications (user_id);
CREATE INDEX idx_notifs_is_read         ON notifications (user_id, is_read);      -- unread count
CREATE INDEX idx_notifs_type            ON notifications (type);
CREATE INDEX idx_notifs_channel         ON notifications (channel, sent_at);      -- delivery jobs
CREATE INDEX idx_notifs_created_at      ON notifications (created_at);


-- =============================================================================
-- 13. ACTIVITY_LOGS
-- Immutable audit log of every state-changing action in the system.
-- NOT soft-deleted — logs are permanent by design.
-- =============================================================================
CREATE TABLE activity_logs (
  id            CHAR(36)        NOT NULL,
  user_id       CHAR(36)        NULL,                             -- NULL = system/scheduled job
  actor_role    VARCHAR(20)     NULL,                             -- role at time of action
  action        VARCHAR(100)    NOT NULL,                         -- 'queue.entry.cancelled', 'salon.updated'
  category      VARCHAR(50)     NOT NULL,                         -- 'queue', 'payment', 'barber', 'service', 'review', 'user', 'salon', 'appointment'
  entity_type   VARCHAR(80)     NOT NULL,                         -- 'queue_entry', 'salon', 'user'
  entity_id     CHAR(36)        NOT NULL,
  old_values    JSON            NULL,                             -- state before change
  new_values    JSON            NULL,                             -- state after change
  metadata      JSON            NULL,                             -- arbitrary context beyond state diffs
  ip_address    VARCHAR(45)     NULL,                             -- supports IPv6
  user_agent    VARCHAR(500)    NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_activity_logs       PRIMARY KEY (id),
  CONSTRAINT fk_activity_logs_user  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_logs_user_id     ON activity_logs (user_id);
CREATE INDEX idx_logs_entity      ON activity_logs (entity_type, entity_id);    -- audit trail per record
CREATE INDEX idx_logs_action      ON activity_logs (action);
CREATE INDEX idx_logs_category    ON activity_logs (category);
CREATE INDEX idx_logs_created_at  ON activity_logs (created_at);                -- time-range queries


SET FOREIGN_KEY_CHECKS = 1;


-- =============================================================================
-- PERFORMANCE INDEXES
-- Run once via migration.  All statements use IF NOT EXISTS so they are
-- idempotent and safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- queue_entries: generated date column + index
-- ---------------------------------------------------------------------------
-- The analytics queries filter on DATE(checked_in_at) BETWEEN ? AND ?.
-- Wrapping a column in DATE() makes the expression non-sargable, causing full
-- index scans.  A STORED generated column exposes the date part as a plain
-- column so a regular B-tree index can satisfy the range predicate in O(log N).
--
-- NOTE: ALTER TABLE acquires a metadata lock.  Run during a low-traffic window
-- or via pt-online-schema-change on large tables.

ALTER TABLE queue_entries
  ADD COLUMN IF NOT EXISTS checked_in_date DATE
    GENERATED ALWAYS AS (DATE(checked_in_at)) STORED;

CREATE INDEX IF NOT EXISTS idx_qe_checked_in_date
  ON queue_entries (checked_in_date);

-- Covering index for the per-day performance analytics query.
-- Satisfies: queue_id filter + status filter + all TIMESTAMPDIFF columns.
-- Avoids the row heap lookup for every matched entry in the aggregation.
CREATE INDEX IF NOT EXISTS idx_qe_analytics
  ON queue_entries (queue_id, status, checked_in_date,
                    checked_in_at, called_at, service_started_at, completed_at);

-- ---------------------------------------------------------------------------
-- payments: covering index for analytics revenue queries
-- ---------------------------------------------------------------------------
-- Analytics queries pattern:
--   WHERE salon_id = ?
--     AND status IN ('completed','refunded','partially_refunded')
--     AND paid_at BETWEEN ? AND ?
-- Existing separate indexes on (salon_id, status) and (salon_id, paid_at) force
-- MySQL to pick one and filter the other in memory.  A triple composite is
-- unambiguously better for this access pattern.
-- Including total_amount and refunded_amount avoids the heap lookup for SUM().
CREATE INDEX IF NOT EXISTS idx_payments_analytics
  ON payments (salon_id, status, paid_at, total_amount, refunded_amount);

-- ---------------------------------------------------------------------------
-- reviews: covering index for analytics rating queries
-- ---------------------------------------------------------------------------
-- Analytics pattern:
--   WHERE salon_id = ?
--     AND is_published = 1
--     AND deleted_at IS NULL
--     AND created_at BETWEEN ? AND ?
-- The existing (is_published, salon_id) index covers the boolean + salon filter
-- but not the date range, causing a full-index scan for the date filter.
CREATE INDEX IF NOT EXISTS idx_reviews_analytics
  ON reviews (salon_id, is_published, deleted_at, created_at, rating);

-- ---------------------------------------------------------------------------
-- appointments: covering index for the barber conflict-detection hot path
-- ---------------------------------------------------------------------------
-- The existing idx_appt_conflict_check already covers (barber_id, scheduled_at,
-- ends_at, status); no change needed there.
-- Add a date-only index for appointment analytics (date range scans).
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS scheduled_date DATE
    GENERATED ALWAYS AS (DATE(scheduled_at)) STORED;

CREATE INDEX IF NOT EXISTS idx_appt_scheduled_date
  ON appointments (scheduled_date);

-- ---------------------------------------------------------------------------
-- activity_logs: composite for the most common audit-trail query
-- ---------------------------------------------------------------------------
-- Typical query: WHERE category = ? AND created_at BETWEEN ? AND ?
-- The separate indexes on category and created_at each satisfy only part of
-- the predicate.  A composite uses the category equality + date range together.
CREATE INDEX IF NOT EXISTS idx_logs_category_date
  ON activity_logs (category, created_at);

-- =============================================================================
-- NOTIFICATION MODULE ENHANCEMENTS
-- Run once against an existing schema (idempotent via IF NOT EXISTS / IGNORE).
-- =============================================================================

-- 14. Extend notifications with priority + related-entity columns

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS priority              ENUM('low','normal','urgent') NOT NULL DEFAULT 'normal'
    AFTER metadata,
  ADD COLUMN IF NOT EXISTS related_entity_type   VARCHAR(80) NULL
    AFTER priority,
  ADD COLUMN IF NOT EXISTS related_entity_id     CHAR(36)    NULL
    AFTER related_entity_type;

CREATE INDEX IF NOT EXISTS idx_notifs_related ON notifications (related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_notifs_priority ON notifications (priority);


-- =============================================================================
-- 14a. NOTIFICATION_TEMPLATES
-- One row per (type × channel). Stores title + body mustache templates.
-- Seeded automatically by NotificationTemplateService.onModuleInit().
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id              CHAR(36)        NOT NULL,
  type            ENUM(
                    'queue_called',
                    'queue_joined',
                    'appointment_confirmed',
                    'appointment_reminder',
                    'appointment_cancelled',
                    'payment_received',
                    'payment_refunded',
                    'review_reply',
                    'general'
                  )               NOT NULL,
  channel         ENUM(
                    'in_app',
                    'email',
                    'sms',
                    'push'
                  )               NOT NULL,
  title_template  VARCHAR(250)    NOT NULL,
  body_template   TEXT            NOT NULL,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  -- Audit fields
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME        NULL,

  CONSTRAINT pk_notification_templates           PRIMARY KEY (id),
  CONSTRAINT uq_notification_templates_type_chan UNIQUE (type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notif_tpl_type_chan ON notification_templates (type, channel);


-- =============================================================================
-- 14b. NOTIFICATION_PREFERENCES
-- Per-user opt-in/opt-out for each (type × channel) combination.
-- Absence of a row means the user receives that notification (opt-out model).
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id          CHAR(36)        NOT NULL,
  user_id     CHAR(36)        NOT NULL,
  type        ENUM(
                'queue_called',
                'queue_joined',
                'appointment_confirmed',
                'appointment_reminder',
                'appointment_cancelled',
                'payment_received',
                'payment_refunded',
                'review_reply',
                'general'
              )               NOT NULL,
  channel     ENUM(
                'in_app',
                'email',
                'sms',
                'push'
              )               NOT NULL,
  is_enabled  TINYINT(1)      NOT NULL DEFAULT 1,
  -- Audit fields
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME        NULL,

  CONSTRAINT pk_notification_prefs               PRIMARY KEY (id),
  CONSTRAINT uq_notification_prefs_user_type_chan UNIQUE (user_id, type, channel),
  CONSTRAINT fk_notification_prefs_user          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_id ON notification_preferences (user_id);
