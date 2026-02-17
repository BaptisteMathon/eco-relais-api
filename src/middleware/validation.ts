/**
 * Express-validator middleware – run validation and pass errors to error handler
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { BadRequestError } from '../utils/errors';

export function validate(validations: ValidationChain[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((v) => v.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    const arr = errors.array();
    const firstMsg = arr.length ? (typeof arr[0].msg === 'string' ? arr[0].msg : 'Validation failed') : 'Validation failed';
    next(new BadRequestError(firstMsg));
  };
}
