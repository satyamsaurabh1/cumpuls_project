import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { generateToken } from '../utils/generateToken.js';
import { sendOTPEmail, sendWelcomeEmail } from '../utils/emailService.js';

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(email, name);
    } catch (emailError) {
      console.error('Welcome email failed:', emailError);
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      tokens: user.tokens,
      isVerified: user.isVerified,
      token
    });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection issue. Please check server logs and walkthrough.',
        error: 'DATABASE_DISCONNECTED'
      });
    }
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate and send OTP
    const otp = generateOTP();

    // Remove older OTPs for this email before creating a new one
    await Otp.deleteMany({ email });

    // Save OTP to database
    await Otp.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    // Send OTP email
    try {
      console.log('Sending OTP to:', email);
      await sendOTPEmail(email, otp);
      console.log('OTP email sent successfully');
    } catch (emailError) {
      console.error('OTP email failed:', emailError.message);

      // In development, allow login flow to continue even if mail config is missing.
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`DEV OTP for ${email}: ${otp}`);
        return res.json({
          message: 'OTP generated in development mode. Check server logs.',
          requiresOTP: true,
          email,
          devOtp: otp
        });
      }

      return res.status(500).json({
        message: 'Failed to send OTP email'
      });
    }

    res.json({
      message: 'OTP sent to your email',
      requiresOTP: true,
      email
    });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection issue. Please check server logs and walkthrough.',
        error: 'DATABASE_DISCONNECTED'
      });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, otp } = req.body;

    // Find OTP record
    const otpRecord = await Otp.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteMany({ email });
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Find user and mark as verified
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isVerified = true;
    await user.save();

    // Delete used OTP
    await Otp.deleteMany({ email });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      tokens: user.tokens,
      isVerified: true,
      token
    });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection issue. Please check server logs and walkthrough.',
        error: 'DATABASE_DISCONNECTED'
      });
    }
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old OTPs
    await Otp.deleteMany({ email });

    // Generate new OTP
    const otp = generateOTP();

    await Otp.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
    } catch (emailError) {
      console.error('OTP email failed:', emailError);
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`DEV OTP for ${email}: ${otp}`);
        return res.json({
          message: 'OTP regenerated in development mode. Check server logs.',
          devOtp: otp
        });
      }
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }

    res.json({ message: 'OTP resent successfully' });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection issue. Please check server logs and walkthrough.',
        error: 'DATABASE_DISCONNECTED'
      });
    }
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('connections', 'name email avatar')
      .populate('pendingRequests', 'name email avatar');

    res.json(user);
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection issue. Please check server logs and walkthrough.',
        error: 'DATABASE_DISCONNECTED'
      });
    }
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
