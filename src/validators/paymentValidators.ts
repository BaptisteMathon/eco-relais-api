import { body } from 'express-validator';

export const createCheckoutValidator = [
  body('mission_id').isUUID().withMessage('Valid mission_id required'),
  body('success_url').optional().isURL(),
  body('cancel_url').optional().isURL(),
];
