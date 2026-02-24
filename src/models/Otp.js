import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // TTL index: automatically delete after 5 minutes
  }
});

// Compound index for faster queries
otpSchema.index({ email: 1, otp: 1 });

const Otp = mongoose.model('Otp', otpSchema);
export default Otp;