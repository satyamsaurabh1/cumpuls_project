import Asset from '../models/Asset.js';

// @desc    Create a new asset
// @route   POST /api/assets
// @access  Private
export const createAsset = async (req, res) => {
  try {
    const { title = '', mediaType, mediaUrl, visibility = 'public' } = req.body;

    if (!mediaType || !['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ message: 'Valid mediaType is required (image or video)' });
    }

    if (!mediaUrl || typeof mediaUrl !== 'string') {
      return res.status(400).json({ message: 'mediaUrl is required' });
    }

    if (!['public', 'private', 'unlisted'].includes(visibility)) {
      return res.status(400).json({ message: 'Invalid visibility value' });
    }

    const asset = await Asset.create({
      owner: req.user._id,
      title: title.trim(),
      mediaType,
      mediaUrl,
      visibility
    });

    const populatedAsset = await Asset.findById(asset._id).populate('owner', 'name avatar');
    res.status(201).json(populatedAsset);
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get public assets
// @route   GET /api/assets/public
// @access  Public
export const getPublicAssets = async (req, res) => {
  try {
    const assets = await Asset.find({ visibility: 'public' })
      .populate('owner', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(assets);
  } catch (error) {
    console.error('Get public assets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current user's assets
// @route   GET /api/assets/mine
// @access  Private
export const getMyAssets = async (req, res) => {
  try {
    const assets = await Asset.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(assets);
  } catch (error) {
    console.error('Get my assets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
