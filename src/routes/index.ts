/**
 * API routes – mount under /api
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { uploadPackagePhoto } from '../middleware/upload';
import { registerValidator as authRegisterValidator, loginValidator as authLoginValidator, verifyEmailValidator as authVerifyEmailValidator} from '../validators/authValidators';
import { updateProfileValidator } from '../validators/userValidators';
import { createMissionValidator, missionIdValidator, collectValidator, statusValidator} from '../validators/missionValidators';
import { createCheckoutValidator } from '../validators/paymentValidators';
import { notificationIdValidator, sendNotificationValidator } from '../validators/notificationValidators';
import { register as authRegister, login as authLogin, verifyEmail as authVerifyEmail } from '../controllers/authController';
import { getProfile, updateProfile } from '../controllers/usersController';
import { create as missionCreate, list as missionList, getById as missionGetById, accept as missionAccept, collect as missionCollect, deliver as missionDeliver, cancel as missionCancel, updateStatus as missionUpdateStatus} from '../controllers/missionsController';
import { history as paymentsHistory, createCheckout as paymentsCreateCheckout, earnings as paymentsEarnings, payout as paymentsPayout } from '../controllers/paymentsController';
import { list as notificationsList, markRead as notificationsMarkRead, send as notificationsSend } from '../controllers/notificationsController';
import { stats as adminStats, listUsers as adminListUsers, listMissions as adminListMissions, listDisputes as adminListDisputes } from '../controllers/adminController';

const router = Router();

// —— Auth (public) ——
router.post('/auth/register', validate(authRegisterValidator), authRegister);
router.post('/auth/login', validate(authLoginValidator), authLogin);
router.post('/auth/verify-email', validate(authVerifyEmailValidator), authVerifyEmail);

// —— Users (authenticated) ——
router.get('/users/profile', requireAuth, getProfile);
router.put('/users/profile', requireAuth, validate(updateProfileValidator), updateProfile);

// —— Missions ——
router.post(
  '/missions',
  requireAuth,
  requireRole('client'),
  uploadPackagePhoto,
  validate(createMissionValidator),
  missionCreate
);
router.get('/missions', requireAuth, missionList);
router.get('/missions/:id', requireAuth, validate(missionIdValidator), missionGetById);
router.put(
  '/missions/:id/accept',
  requireAuth,
  requireRole('partner'),
  validate(missionIdValidator),
  missionAccept
);
router.put(
  '/missions/:id/collect',
  requireAuth,
  requireRole('partner'),
  validate(collectValidator),
  missionCollect
);
router.put(
  '/missions/:id/deliver',
  requireAuth,
  requireRole('partner'),
  validate(missionIdValidator),
  missionDeliver
);
router.put(
  '/missions/:id/cancel',
  requireAuth,
  validate(missionIdValidator),
  missionCancel
);
router.put(
  '/missions/:id/status',
  requireAuth,
  requireRole('partner'),
  validate(statusValidator),
  missionUpdateStatus
);

// —— Payments ——
router.get('/payments', requireAuth, requireRole('client'), paymentsHistory);
router.post(
  '/payments/create-checkout',
  requireAuth,
  validate(createCheckoutValidator),
  paymentsCreateCheckout
);
router.get('/payments/earnings', requireAuth, requireRole('partner'), paymentsEarnings);
router.post('/payments/payout', requireAuth, requireRole('partner'), paymentsPayout);

// —— Notifications ——
router.get('/notifications', requireAuth, notificationsList);
router.put(
  '/notifications/:id/read',
  requireAuth,
  validate(notificationIdValidator),
  notificationsMarkRead
);
router.post(
  '/notifications/send',
  requireAuth,
  requireRole('admin'),
  validate(sendNotificationValidator),
  notificationsSend
);

// —— Admin ——
router.get('/admin/stats', requireAuth, requireRole('admin'), adminStats);
router.get('/admin/users', requireAuth, requireRole('admin'), adminListUsers);
router.get('/admin/missions', requireAuth, requireRole('admin'), adminListMissions);
router.get('/admin/disputes', requireAuth, requireRole('admin'), adminListDisputes);

export default router;
