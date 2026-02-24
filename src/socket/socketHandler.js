import Message from '../models/message.js';
import { verifyToken } from '../utils/generateToken.js';
import User from '../models/User.js';

const onlineUsers = new Map();

export const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Invalid token'));
      }

      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name}`);
    
    // Add user to online users
    onlineUsers.set(socket.user._id.toString(), socket.id);
    
    // Broadcast online status to all connected users
    io.emit('user:online', Array.from(onlineUsers.keys()));

    // Join user's personal room
    socket.join(`user:${socket.user._id}`);

    // Handle joining a conversation
    socket.on('conversation:join', ({ userId }) => {
      const roomId = getConversationRoomId(socket.user._id, userId);
      socket.join(roomId);
    });

    // Handle sending a message
    socket.on('message:send', async ({ receiverId, content }) => {
      try {
        // Check if users are connected
        const areConnected = socket.user.connections.some(
          (connectionId) => connectionId.toString() === receiverId.toString()
        );
        if (!areConnected) {
          socket.emit('error', { message: 'You can only message connected users' });
          return;
        }

        // Save message to database
        const message = await Message.create({
          sender: socket.user._id,
          receiver: receiverId,
          content
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email avatar')
          .populate('receiver', 'name email avatar');

        // Emit to sender's room
        socket.emit('message:received', populatedMessage);

        // Emit to receiver's room if online
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message:received', populatedMessage);
        }

        // Emit to conversation room
        const roomId = getConversationRoomId(socket.user._id, receiverId);
        io.to(roomId).emit('message:received', populatedMessage);

        // Update conversation list
        io.to(`user:${receiverId}`).emit('conversation:updated');
      } catch (error) {
        console.error('Socket message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing:start', ({ receiverId }) => {
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:start', {
          userId: socket.user._id,
          name: socket.user.name
        });
      }
    });

    socket.on('typing:stop', ({ receiverId }) => {
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:stop', {
          userId: socket.user._id
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);
      onlineUsers.delete(socket.user._id.toString());
      io.emit('user:offline', socket.user._id.toString());
    });
  });
};

const getConversationRoomId = (userId1, userId2) => {
  return [userId1, userId2].sort().join(':');
};
