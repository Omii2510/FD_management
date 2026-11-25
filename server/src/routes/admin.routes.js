import { Router } from 'express';
import { protect, restrictTo } from '../middleware/auth.middleware.js';
import {
  getAdminDashboard,
  getAdminApplication,
  getAdminUser,
  createManagedBank,
  listAdminApplications,
  listAdminAuditLogs,
  listAdminUsers,
  notifyBankVerification,
  resetBankUserPassword,
  updateAdminUserStatus,
} from '../controllers/admin.controller.js';

const router = Router();

router.use(protect, restrictTo('admin'));

router.get('/dashboard', getAdminDashboard);
router.post('/banks', createManagedBank);
router.get('/applications', listAdminApplications);
router.get('/applications/:applicationId', getAdminApplication);
router.get('/users', listAdminUsers);
router.get('/users/:userId', getAdminUser);
router.patch('/users/:userId/status', updateAdminUserStatus);
router.patch('/bank-users/:userId/password', resetBankUserPassword);
router.get('/audit-logs', listAdminAuditLogs);
router.post('/banks/:bankId/notify-verification', notifyBankVerification);

export default router;
