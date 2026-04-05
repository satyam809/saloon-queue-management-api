/**
 * Enumeration of all notification event types produced by the system.
 *
 * Each member represents a discrete business event that can trigger a
 * notification to one or more users.  The string values are persisted in the
 * database and sent over the wire, so they must remain stable across releases.
 */
export enum NotificationType {
  /** Emitted when a queued customer is called to the service counter. */
  QUEUE_CALLED           = 'queue_called',

  /** Emitted when a customer successfully joins a queue. */
  QUEUE_JOINED           = 'queue_joined',

  /** Emitted when an appointment booking is confirmed by the saloon. */
  APPOINTMENT_CONFIRMED  = 'appointment_confirmed',

  /** Emitted as a pre-appointment reminder before the scheduled time. */
  APPOINTMENT_REMINDER   = 'appointment_reminder',

  /** Emitted when an appointment is cancelled by either party. */
  APPOINTMENT_CANCELLED  = 'appointment_cancelled',

  /** Emitted when a payment transaction is successfully completed. */
  PAYMENT_RECEIVED       = 'payment_received',

  /** Emitted when a payment refund is issued to the customer. */
  PAYMENT_REFUNDED       = 'payment_refunded',

  /** Emitted when the saloon owner replies to a customer review. */
  REVIEW_REPLY           = 'review_reply',

  /** Generic notification type for announcements not covered by other values. */
  GENERAL                = 'general',
}

/**
 * Enumeration of the delivery channels available for sending notifications.
 *
 * A single {@link NotificationType} event may be dispatched through one or
 * more channels depending on the user's preferences and the notification
 * priority.
 */
export enum NotificationChannel {
  /** Delivered within the application's notification centre (real-time). */
  IN_APP = 'in_app',

  /** Delivered to the user's registered e-mail address. */
  EMAIL  = 'email',

  /** Delivered as a text message to the user's phone number. */
  SMS    = 'sms',

  /** Delivered as a mobile push notification via FCM / APNs. */
  PUSH   = 'push',
}

/**
 * Enumeration of priority levels that control how urgently a notification
 * is processed and displayed.
 *
 * Higher-priority notifications may bypass quiet-hour rules, appear more
 * prominently in the UI, or be delivered via additional channels.
 */
export enum NotificationPriority {
  /** Non-urgent informational notifications; may be batched or deferred. */
  LOW    = 'low',

  /** Default priority for routine transactional notifications. */
  NORMAL = 'normal',

  /** Time-sensitive notifications that should be delivered immediately. */
  URGENT = 'urgent',
}
