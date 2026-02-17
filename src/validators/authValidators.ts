import { body } from 'express-validator';

export const registerValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('role')
    .isIn(['client', 'partner', 'admin'])
    .withMessage('Role must be client, partner, or admin'),
  body('first_name').trim().notEmpty().withMessage('First name required'),
  body('last_name').trim().notEmpty().withMessage('Last name required'),
  body('phone').optional().trim(),
];

export const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

export const verifyEmailValidator = [
  body('token').notEmpty().withMessage('Verification token required'),
];
