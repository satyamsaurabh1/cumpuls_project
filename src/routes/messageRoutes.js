import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  sendMessage,
  getConversation,
  getConversations,
  markAsRead
} from '../controllers/messageController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/', sendMessage);
router.get('/conversations', getConversations);
router.get('/:userId', getConversation);
router.put('/read/:userId', markAsRead);

export default router;