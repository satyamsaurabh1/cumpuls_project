import express from 'express';
import { protect } from '../middleware/auth.js';
import { createAsset, getMyAssets, getPublicAssets } from '../controllers/assetController.js';

const router = express.Router();

router.get('/public', getPublicAssets);

router.use(protect);

router.post('/', createAsset);
router.get('/mine', getMyAssets);

export default router;
