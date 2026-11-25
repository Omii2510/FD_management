import { Router } from 'express';
import { protect, restrictTo } from '../middleware/auth.middleware.js';
import {
  createBank,
  deleteBank,
  getMyBank,
  getPublicBank,
  listAllBanks,
  listPublicBanks,
  updateBank,
  updateBankStatus,
  updateMyBank,
} from '../controllers/bank.controller.js';
import { protect as protectPanel, restrictTo as restrictPanel, requireApprovedBank } from '../middleware/auth.middleware.js';
import {
  getBankDashboard,
  addBankApplicationNote,
  getBankApplication,
  listBankApplications,
  listBankUsers,
  updateBankApplicationStatus,
} from '../controllers/bankPanel.controller.js';

const router = Router();

router.get('/', listPublicBanks);
router.get('/me', protect, restrictTo('bank'), getMyBank);
router.patch('/me', protect, restrictTo('bank'), updateMyBank);
router.get('/admin/all', protect, restrictTo('admin'), listAllBanks);
router.get('/panel/dashboard', protectPanel, restrictPanel('bank'), requireApprovedBank, getBankDashboard);
router.get('/panel/applications', protectPanel, restrictPanel('bank'), requireApprovedBank, listBankApplications);
router.get('/panel/applications/:applicationId', protectPanel, restrictPanel('bank'), requireApprovedBank, getBankApplication);
router.patch('/panel/applications/:applicationId/status', protectPanel, restrictPanel('bank'), requireApprovedBank, updateBankApplicationStatus);
router.post('/panel/applications/:applicationId/notes', protectPanel, restrictPanel('bank'), requireApprovedBank, addBankApplicationNote);
router.get('/panel/users', protectPanel, restrictPanel('bank'), requireApprovedBank, listBankUsers);
router.post('/', protect, restrictTo('admin'), createBank);
router.patch('/:id/status', protect, restrictTo('admin'), updateBankStatus);
router.patch('/:id', protect, restrictTo('admin'), updateBank);
router.delete('/:id', protect, restrictTo('admin'), deleteBank);
router.get('/:id', getPublicBank);

export default router;
