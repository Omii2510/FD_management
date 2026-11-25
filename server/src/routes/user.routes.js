import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { createError } from '../middleware/errorHandler.js';
import { preventRoleAssignment, requireUser } from '../middleware/authorization.middleware.js';
import {
  addFavorite,
  cancelApplication,
  createApplication,
  getApplication,
  listApplications,
  listFavorites,
  listNotifications,
  markNotificationRead,
  removeFavorite,
} from '../controllers/userPanel.controller.js';

const router = Router();

router.use(protect);
router.use(requireUser);

router.get('/profile', (req, res) => {
  res.json({ success: true, data: { user: req.user.toJSON() } });
});

router.patch('/profile', preventRoleAssignment, async (req, res, next) => {
  try {
    const allowed = ['fullName', 'phone', 'profileImage'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.fullName !== undefined && (String(updates.fullName).trim().length < 2 || String(updates.fullName).length > 100)) {
      throw createError('fullName must contain between 2 and 100 characters.', 400);
    }

    Object.assign(req.user, updates);
    await req.user.save();
    res.json({ success: true, message: 'Profile updated.', data: { user: req.user.toJSON() } });
  } catch (error) {
    next(error);
  }
});

router.get('/favorites', listFavorites);
router.post('/favorites/:planId', addFavorite);
router.delete('/favorites/:planId', removeFavorite);
router.post('/applications', createApplication);
router.get('/applications', listApplications);
router.get('/applications/:applicationId', getApplication);
router.post('/applications/:applicationId/cancel', cancelApplication);
router.get('/notifications', listNotifications);
router.patch('/notifications/:notificationId/read', markNotificationRead);

export default router;
