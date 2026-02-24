import React, { createContext, useState, useContext, useEffect } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user, isAuthenticated } = useAuth();
  const seenMessageIdsRef = React.useRef(new Set());

  useEffect(() => {
    if (isAuthenticated && user) {
      const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
      
      const newSocket = io(SOCKET_URL, {
        auth: {
          token: localStorage.getItem('token')
        }
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
      });

      newSocket.on('user:online', (users) => {
        setOnlineUsers(users);
      });

      newSocket.on('user:offline', (userId) => {
        setOnlineUsers(prev => prev.filter(id => id !== userId));
      });

      newSocket.on('message:received', (message) => {
        const messageId = message?._id;
        const senderId = message?.sender?._id?.toString?.() || '';
        const receiverId = message?.receiver?._id?.toString?.() || '';
        const currentUserId = user?._id?.toString?.() || '';

        // Prevent duplicate notifications from multi-emits and only notify receiver.
        if (!messageId || seenMessageIdsRef.current.has(messageId)) return;
        seenMessageIdsRef.current.add(messageId);
        if (seenMessageIdsRef.current.size > 300) {
          // Keep memory bounded in long sessions.
          seenMessageIdsRef.current.clear();
          seenMessageIdsRef.current.add(messageId);
        }

        const isIncomingForCurrentUser =
          receiverId === currentUserId && senderId && senderId !== currentUserId;
        if (!isIncomingForCurrentUser) return;

        toast.success(
          <div>
            <div>New message</div>
            <div>{message.content}</div>
          </div>,
          {
          duration: 4000
          }
        );
      });

      newSocket.on('error', (error) => {
        toast.error(error.message);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [isAuthenticated, user]);

  const joinConversation = (userId) => {
    if (socket) {
      socket.emit('conversation:join', { userId });
    }
  };

  const sendMessage = (receiverId, content) => {
    if (socket) {
      socket.emit('message:send', { receiverId, content });
    }
  };

  const startTyping = (receiverId) => {
    if (socket) {
      socket.emit('typing:start', { receiverId });
    }
  };

  const stopTyping = (receiverId) => {
    if (socket) {
      socket.emit('typing:stop', { receiverId });
    }
  };

  const value = {
    socket,
    onlineUsers,
    joinConversation,
    sendMessage,
    startTyping,
    stopTyping,
    isOnline: (userId) => onlineUsers.includes(userId)
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
