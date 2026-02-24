import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createPaymentOrder,
  getPaymentHistory,
  getTokenPackages,
  handleRazorpayWebhook,
  verifyPaymentAndAddTokens
} from '../controllers/paymentController.js';

const router = express.Router();

router.post('/webhook', handleRazorpayWebhook);

router.get('/packages', getTokenPackages);

router.use(protect);

router.get('/history', getPaymentHistory);
router.post('/create-order', createPaymentOrder);
router.post('/verify', verifyPaymentAndAddTokens);

export default router;
