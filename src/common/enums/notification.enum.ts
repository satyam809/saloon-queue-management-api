export enum NotificationType {
  QUEUE_CALLED           = 'queue_called',
  QUEUE_JOINED           = 'queue_joined',
  APPOINTMENT_CONFIRMED  = 'appointment_confirmed',
  APPOINTMENT_REMINDER   = 'appointment_reminder',
  APPOINTMENT_CANCELLED  = 'appointment_cancelled',
  PAYMENT_RECEIVED       = 'payment_received',
  PAYMENT_REFUNDED       = 'payment_refunded',
  REVIEW_REPLY           = 'review_reply',
  GENERAL                = 'general',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL  = 'email',
  SMS    = 'sms',
  PUSH   = 'push',
}

export enum NotificationPriority {
  LOW    = 'low',
  NORMAL = 'normal',
  URGENT = 'urgent',
}
