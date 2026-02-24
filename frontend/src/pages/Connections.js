import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import { FiMessageCircle, FiUserMinus, FiUserPlus, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../config/api';
import './Connections.css';

const Connections = () => {
  const { isOnline } = useSocket();
  const [connections, setConnections] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      const users = response.data || [];
      setGlobalUsers(users);
      setConnections(users.filter((u) => u.connectionStatus === 'connected'));
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (userId) => {
    try {
      await api.post(`/users/connect/${userId}`);
      toast.success('Connection request sent!');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async (userId) => {
    try {
      await api.put(`/users/accept/${userId}`);
      toast.success('Connection accepted!');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      await api.put(`/users/reject/${userId}`);
      toast.success('Request rejected');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const renderAction = (user) => {
    switch (user.connectionStatus) {
      case 'connected':
        return (
          <Link to={`/messages/${user._id}`} className="connection-action message-action">
            <FiMessageCircle />
            <span>Message</span>
          </Link>
        );
      case 'pending':
        return (
          <button className="connection-action pending-action" disabled>
            <FiUserPlus />
            <span>Pending</span>
          </button>
        );
      case 'received':
        return (
          <div className="inline-request-actions">
            <button onClick={() => handleAcceptRequest(user._id)} className="mini-action accept">
              <FiCheck />
            </button>
            <button onClick={() => handleRejectRequest(user._id)} className="mini-action reject">
              <FiX />
            </button>
          </div>
        );
      default:
        return (
          <button onClick={() => handleConnect(user._id)} className="connection-action connect-action">
            <FiUserPlus />
            <span>Connect</span>
          </button>
        );
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading connections...</p>
      </div>
    );
  }

  return (
    <div className="connections-page fade-in">
      <div className="connections-header">
        <h1 className="page-title">Connections Hub</h1>
        <p className="page-subtitle">
          Connected: {connections.length} | Global Creators: {globalUsers.length}
        </p>
      </div>

      <div className="connections-two-column">
        <section className="connections-column">
          <h2 className="column-title">Connected Users</h2>
          {connections.length === 0 ? (
            <div className="no-connections">
              <div className="no-connections-content">
                <FiUserMinus className="no-connections-icon" />
                <h3>No Connections Yet</h3>
                <p>Connect with creators from the Global Users section.</p>
              </div>
            </div>
          ) : (
            <div className="connections-grid">
              {connections.map((connection) => (
                <div key={connection._id} className="connection-card">
                  <div className="connection-card-header">
                    <img src={connection.avatar} alt={connection.name} className="connection-avatar" />
                    <div className={`connection-status ${isOnline(connection._id) ? 'online' : ''}`}>
                      {isOnline(connection._id) ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  <div className="connection-info">
                    <h3 className="connection-name">{connection.name}</h3>
                    <p className="connection-email">{connection.email}</p>
                    {connection.bio && <p className="connection-bio">{connection.bio}</p>}
                  </div>
                  <div className="connection-actions">{renderAction(connection)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="connections-column">
          <h2 className="column-title">All Global Users</h2>
          {globalUsers.length === 0 ? (
            <div className="no-users">
              <p>No global users found.</p>
            </div>
          ) : (
            <div className="connections-grid">
              {globalUsers.map((globalUser) => (
                <div key={globalUser._id} className="connection-card">
                  <div className="connection-card-header">
                    <img src={globalUser.avatar} alt={globalUser.name} className="connection-avatar" />
                    <div className={`connection-status ${isOnline(globalUser._id) ? 'online' : ''}`}>
                      {isOnline(globalUser._id) ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  <div className="connection-info">
                    <h3 className="connection-name">{globalUser.name}</h3>
                    <p className="connection-email">{globalUser.email}</p>
                    {globalUser.bio && <p className="connection-bio">{globalUser.bio}</p>}
                  </div>
                  <div className="connection-actions">{renderAction(globalUser)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Connections;
