/**
 * API routes – mount under /api
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { uploadPackagePhoto } from '../middleware/upload';
import * as authValidators from '../validators/authValidators';
import * as userValidators from '../validators/userValidators';
import * as missionValidators from '../validators/missionValidators';
import * as paymentValidators from '../validators/paymentValidators';
import * as notificationValidators from '../validators/notificationValidators';
import * as authController from '../controllers/authController';
import * as usersController from '../controllers/usersController';
import * as missionsController from '../controllers/missionsController';
import * as paymentsController from '../controllers/paymentsController';
import * as notificationsController from '../controllers/notificationsController';
import * as adminController from '../controllers/adminController';
import { UserRole } from '../types';

const router = Router();

// —— Auth (public) ——
router.post('/auth/register', validate(authValidators.registerValidator), authController.register);
router.post('/auth/login', validate(authValidators.loginValidator), authController.login);
router.post('/auth/verify-email', validate(authValidators.verifyEmailValidator), authController.verifyEmail);

// —— Users (authenticated) ——
router.get('/users/profile', requireAuth, usersController.getProfile);
router.put('/users/profile', requireAuth, validate(userValidators.updateProfileValidator), usersController.updateProfile);

// —— Missions ——
router.post(
  '/missions',
  requireAuth,
  requireRole('client'),
  uploadPackagePhoto,
  validate(missionValidators.createMissionValidator),
  missionsController.create
);
router.get('/missions', requireAuth, missionsController.list);
router.get('/missions/:id', requireAuth, validate(missionValidators.missionIdValidator), missionsController.getById);
router.put(
  '/missions/:id/accept',
  requireAuth,
  requireRole('partner'),
  validate(missionValidators.missionIdValidator),
  missionsController.accept
);
router.put(
  '/missions/:id/collect',
  requireAuth,
  requireRole('partner'),
  validate(missionValidators.collectValidator),
  missionsController.collect
);
router.put(
  '/missions/:id/deliver',
  requireAuth,
  requireRole('partner'),
  validate(missionValidators.missionIdValidator),
  missionsController.deliver
);
router.put(
  '/missions/:id/cancel',
  requireAuth,
  validate(missionValidators.missionIdValidator),
  missionsController.cancel
);
router.put(
  '/missions/:id/status',
  requireAuth,
  requireRole('partner'),
  validate(missionValidators.statusValidator),
  missionsController.updateStatus
);

// —— Payments ——
router.post(
  '/payments/create-checkout',
  requireAuth,
  validate(paymentValidators.createCheckoutValidator),
  paymentsController.createCheckout
);
router.get('/payments/earnings', requireAuth, requireRole('partner'), paymentsController.earnings);
router.post('/payments/payout', requireAuth, requireRole('partner'), paymentsController.payout);

// —— Notifications ——
router.get('/notifications', requireAuth, notificationsController.list);
router.put(
  '/notifications/:id/read',
  requireAuth,
  validate(notificationValidators.notificationIdValidator),
  notificationsController.markRead
);
router.post(
  '/notifications/send',
  requireAuth,
  requireRole('admin'),
  validate(notificationValidators.sendNotificationValidator),
  notificationsController.send
);

// —— Admin ——
router.get('/admin/stats', requireAuth, requireRole('admin'), adminController.stats);
router.get('/admin/users', requireAuth, requireRole('admin'), adminController.listUsers);
router.get('/admin/missions', requireAuth, requireRole('admin'), adminController.listMissions);
router.get('/admin/disputes', requireAuth, requireRole('admin'), adminController.listDisputes);

export default router;
