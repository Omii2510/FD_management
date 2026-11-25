import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  googleLogin,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
  verifyEmail,
  me,
} from '../controllers/auth.controller.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';
import { createBankUser } from '../controllers/bankUser.controller.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts.' },
});

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/google', authLimiter, googleLogin);
router.post('/refresh', authLimiter, refresh);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/logout', protect, logout);
router.get('/me', protect, me);
router.post('/admin/bank-users', protect, restrictTo('admin'), createBankUser);

export default router;
