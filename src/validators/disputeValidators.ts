import { body, param } from 'express-validator';

export const createDisputeValidator = [
  body('mission_id').isUUID().withMessage('Valid mission_id required'),
  body('reason').trim().notEmpty().withMessage('Reason required'),
];

export const disputeIdValidator = [
  param('id').isUUID().withMessage('Invalid dispute ID'),
];

export const resolveDisputeValidator = [
  param('id').isUUID().withMessage('Invalid dispute ID'),
  body('resolution').trim().notEmpty().withMessage('Resolution required'),
];
