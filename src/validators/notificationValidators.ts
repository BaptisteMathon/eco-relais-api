import { body, param } from 'express-validator';

export const sendNotificationValidator = [
  body('user_id').optional().isUUID(),
  body('user_ids').optional().isArray(),
  body('user_ids.*').optional().isUUID(),
  body('type').trim().notEmpty().withMessage('Type required'),
  body('message').trim().notEmpty().withMessage('Message required'),
];

export const notificationIdValidator = [param('id').isUUID().withMessage('Invalid notification ID')];
