import { body } from 'express-validator';

export const updateProfileValidator = [
  body('first_name').optional().trim().notEmpty(),
  body('last_name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('address_lat').optional().isFloat({ min: -90, max: 90 }),
  body('address_lng').optional().isFloat({ min: -180, max: 180 }),
];
