import { Router } from 'express';
import { calculateFDPlan, compareFDPlans } from '../controllers/fdCalculator.controller.js';

const router = Router();

router.post('/calculate', calculateFDPlan);
router.post('/compare', compareFDPlans);

export default router;
