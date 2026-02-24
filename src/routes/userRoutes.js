import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getUsers,
  getUserById,
  updateProfile,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  getConnectionRequests
} from '../controllers/userController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', getUsers);
router.get('/requests', getConnectionRequests);
router.get('/:id', getUserById);
router.put('/profile', updateProfile);
router.post('/connect/:userId', sendConnectionRequest);
router.put('/accept/:userId', acceptConnectionRequest);
router.put('/reject/:userId', rejectConnectionRequest);

export default router;