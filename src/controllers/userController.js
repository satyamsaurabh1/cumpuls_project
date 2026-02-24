import User from '../models/User.js';
import Connection from '../models/connection.js';

// @desc    Get all users (except current user)
// @route   GET /api/users
// @access  Private
export const getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {
      _id: { $ne: req.user._id }
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('name email avatar bio')
      .limit(50);

    // Get connection status for each user
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const connection = await Connection.findOne({
          $or: [
            { requester: req.user._id, recipient: user._id },
            { requester: user._id, recipient: req.user._id }
          ]
        });

        let status = 'none';
        if (connection) {
          if (connection.status === 'accepted') {
            status = 'connected';
          } else if (connection.status === 'pending') {
            status = connection.requester.equals(req.user._id) ? 'pending' : 'received';
          }
        }

        return {
          ...user.toJSON(),
          connectionStatus: status
        };
      })
    );

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email avatar bio connections')
      .populate('connections', 'name email avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;

    const user = await User.findById(req.user._id);
    
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Send connection request
// @route   POST /api/users/connect/:userId
// @access  Private
export const sendConnectionRequest = async (req, res) => {
  try {
    const recipientId = req.params.userId;

    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot connect with yourself' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { requester: req.user._id, recipient: recipientId },
        { requester: recipientId, recipient: req.user._id }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({ message: 'Connection request already exists' });
    }

    // Create connection request
    const connection = await Connection.create({
      requester: req.user._id,
      recipient: recipientId,
      status: 'pending'
    });

    // Add to pending requests
    await User.findByIdAndUpdate(recipientId, {
      $addToSet: { pendingRequests: req.user._id }
    });

    res.json({ message: 'Connection request sent' });
  } catch (error) {
    console.error('Send connection error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Accept connection request
// @route   PUT /api/users/accept/:userId
// @access  Private
export const acceptConnectionRequest = async (req, res) => {
  try {
    const requesterId = req.params.userId;

    const connection = await Connection.findOne({
      requester: requesterId,
      recipient: req.user._id,
      status: 'pending'
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found' });
    }

    connection.status = 'accepted';
    connection.updatedAt = Date.now();
    await connection.save();

    // Add to connections for both users
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { connections: requesterId },
      $pull: { pendingRequests: requesterId }
    });

    await User.findByIdAndUpdate(requesterId, {
      $addToSet: { connections: req.user._id }
    });

    res.json({ message: 'Connection accepted' });
  } catch (error) {
    console.error('Accept connection error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reject connection request
// @route   PUT /api/users/reject/:userId
// @access  Private
export const rejectConnectionRequest = async (req, res) => {
  try {
    const requesterId = req.params.userId;

    const connection = await Connection.findOneAndDelete({
      requester: requesterId,
      recipient: req.user._id,
      status: 'pending'
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found' });
    }

    // Remove from pending requests
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pendingRequests: requesterId }
    });

    res.json({ message: 'Connection rejected' });
  } catch (error) {
    console.error('Reject connection error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get connection requests
// @route   GET /api/users/requests
// @access  Private
export const getConnectionRequests = async (req, res) => {
  try {
    const requests = await Connection.find({
      recipient: req.user._id,
      status: 'pending'
    }).populate('requester', 'name email avatar bio');

    res.json(requests.map(req => req.requester));
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
