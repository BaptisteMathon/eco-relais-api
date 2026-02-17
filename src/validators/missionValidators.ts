import { body, param } from 'express-validator';

export const createMissionValidator = [
  body('package_title').trim().notEmpty().withMessage('Package title required'),
  body('package_size')
    .isIn(['small', 'medium', 'large'])
    .withMessage('Package size must be small, medium, or large'),
  body('pickup_address').trim().notEmpty().withMessage('Pickup address required'),
  body('pickup_lat').isFloat({ min: -90, max: 90 }).withMessage('Valid pickup latitude required'),
  body('pickup_lng').isFloat({ min: -180, max: 180 }).withMessage('Valid pickup longitude required'),
  body('delivery_address').trim().notEmpty().withMessage('Delivery address required'),
  body('delivery_lat').isFloat({ min: -90, max: 90 }).withMessage('Valid delivery latitude required'),
  body('delivery_lng').isFloat({ min: -180, max: 180 }).withMessage('Valid delivery longitude required'),
  body('pickup_time_slot').trim().notEmpty().withMessage('Pickup time slot required'),
];

export const missionIdValidator = [param('id').isUUID().withMessage('Invalid mission ID')];

export const collectValidator = [
  param('id').isUUID(),
  body('qr_payload').optional().isString(),
];

export const statusValidator = [
  param('id').isUUID(),
  body('status').isIn(['collected', 'in_transit']).withMessage('Invalid status'),
];
