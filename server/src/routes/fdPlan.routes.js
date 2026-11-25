import { Router } from 'express';
import { protect, restrictTo, requireApprovedBank } from '../middleware/auth.middleware.js';
import {
  createFDPlan,
  deactivateFDPlan,
  getPublicFDPlan,
  listAllFDPlans,
  listMyFDPlans,
  listPublicFDPlans,
  reviewFDPlan,
  submitFDPlan,
  updateFDPlan,
} from '../controllers/fdPlan.controller.js';

const router = Router();

router.get('/', listPublicFDPlans);
router.get('/mine', protect, restrictTo('bank'), requireApprovedBank, listMyFDPlans);
router.get('/admin/all', protect, restrictTo('admin'), listAllFDPlans);
router.post('/', protect, restrictTo('bank', 'admin'), createFDPlan);
router.post('/:id/submit', protect, restrictTo('bank'), requireApprovedBank, submitFDPlan);
router.patch('/:id/review', protect, restrictTo('admin'), reviewFDPlan);
router.patch('/:id', protect, restrictTo('bank', 'admin'), updateFDPlan);
router.delete('/:id', protect, restrictTo('bank', 'admin'), deactivateFDPlan);
router.get('/:id', getPublicFDPlan);

export default router;
