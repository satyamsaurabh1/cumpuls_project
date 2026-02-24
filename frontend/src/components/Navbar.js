import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiHome,
  FiUsers,
  FiMessageSquare,
  FiUser,
  FiLogOut,
  FiMenu,
  FiSearch,
  FiBell,
  FiPlus,
  FiX,
  FiCreditCard,
  FiClock
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../config/api';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [createAssetOpen, setCreateAssetOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [visibility, setVisibility] = React.useState('public');
  const [uploading, setUploading] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState('');
  const [mediaType, setMediaType] = React.useState('');
  const [mediaUrl, setMediaUrl] = React.useState('');

  const navItems = [
    { to: '/', icon: <FiHome className="sidebar-icon" />, label: 'Home', active: location.pathname === '/' },
    {
      to: '/connections',
      icon: <FiUsers className="sidebar-icon" />,
      label: 'Connections',
      active: location.pathname === '/connections'
    },
    {
      to: '/messages',
      icon: <FiMessageSquare className="sidebar-icon" />,
      label: 'Messages',
      active: location.pathname.includes('/messages')
    },
    {
      to: '/profile',
      icon: <FiUser className="sidebar-icon" />,
      label: 'Profile',
      active: location.pathname === '/profile'
    },
    {
      to: '/buy-tokens',
      icon: <FiCreditCard className="sidebar-icon" />,
      label: 'Buy Tokens',
      active: location.pathname === '/buy-tokens'
    },
    {
      to: '/payment-history',
      icon: <FiClock className="sidebar-icon" />,
      label: 'History',
      active: location.pathname === '/payment-history'
    }
  ];

  const resetAssetForm = () => {
    setTitle('');
    setVisibility('public');
    setSelectedFileName('');
    setMediaType('');
    setMediaUrl('');
  };

  const handleLogout = () => {
    setMobileSidebarOpen(false);
    logout();
    navigate('/login');
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      toast.error('Please upload an image or video file');
      event.target.value = '';
      return;
    }

    // Keep payload well under 25mb JSON limit after base64 overhead.
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('File is too large. Please choose a file under 10MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setMediaUrl(reader.result?.toString() || '');
      setMediaType(isImage ? 'image' : 'video');
      setSelectedFileName(file.name);
    };
    reader.onerror = () => {
      toast.error('Failed to read selected file');
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAsset = async (event) => {
    event.preventDefault();
    if (!mediaUrl || !mediaType) {
      toast.error('Please select an image or video');
      return;
    }

    setUploading(true);
    try {
      await api.post('/assets', {
        title,
        visibility,
        mediaType,
        mediaUrl
      });
      toast.success('Asset uploaded successfully');
      setCreateAssetOpen(false);
      resetAssetForm();
      window.dispatchEvent(new Event('assets:updated'));
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to upload asset');
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <header className="yt-topbar">
        <div className="yt-topbar-left">
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setMobileSidebarOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <FiMenu />
          </button>
          <Link to="/" className="navbar-logo">
            <span className="logo-gradient">CreatorConnect</span>
          </Link>
        </div>

        <div className="yt-search-wrap">
          <div className="yt-search-box">
            <FiSearch className="yt-search-icon" />
            <input className="yt-search-input" placeholder="Search creators, messages, connections" />
          </div>
        </div>

        <div className="yt-topbar-right">
          <Link to="/buy-tokens" className="token-chip" onClick={() => setMobileSidebarOpen(false)}>
            Tokens: {user?.tokens || 0}
          </Link>
          <button className="create-asset-btn" type="button" onClick={() => setCreateAssetOpen(true)}>
            <FiPlus />
            <span>Create Asset</span>
          </button>
          <button className="yt-icon-btn" type="button" aria-label="Notifications">
            <FiBell />
          </button>
          <Link to="/profile" className="user-chip" onClick={() => setMobileSidebarOpen(false)}>
            <img
              src={user?.avatar || 'https://via.placeholder.com/40'}
              alt={user?.name || 'User avatar'}
              className="user-avatar"
            />
            <span className="user-name">{user?.name}</span>
          </Link>
        </div>
      </header>

      <aside className={`yt-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <nav className="yt-sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`yt-nav-item ${item.active ? 'active' : ''}`}
              onClick={() => setMobileSidebarOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <button onClick={handleLogout} className="yt-logout-btn">
          <FiLogOut className="logout-icon" />
          <span>Logout</span>
        </button>
      </aside>

      {mobileSidebarOpen && <div className="yt-overlay" onClick={() => setMobileSidebarOpen(false)}></div>}

      {createAssetOpen && (
        <>
          <div className="asset-modal-overlay" onClick={() => setCreateAssetOpen(false)}></div>
          <div className="asset-modal">
            <div className="asset-modal-header">
              <h3>Create Asset</h3>
              <button
                className="asset-close-btn"
                type="button"
                onClick={() => {
                  setCreateAssetOpen(false);
                  resetAssetForm();
                }}
                aria-label="Close create asset modal"
              >
                <FiX />
              </button>
            </div>

            <form className="asset-form" onSubmit={handleCreateAsset}>
              <label>
                Title
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Optional title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <label>
                Upload Image/Video
                <input type="file" accept="image/*,video/*" onChange={handleFileChange} />
              </label>
              {selectedFileName && <p className="asset-file-name">{selectedFileName}</p>}

              <label>
                Visibility
                <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </label>

              <button type="submit" className="asset-submit-btn" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload Asset'}
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;
