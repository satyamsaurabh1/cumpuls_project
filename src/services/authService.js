import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { generateOtp, saveOtp } from "./otpServices.js";
import { sendOTPEmail, sendWelcomeEmail } from "../utils/emailService.js";

export const registerUser = async ({ name, email, password }) => {
  if (!name || !email || !password) {
    throw new Error("All fields are required");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email already exists");
  }

  const user = await User.create({
    name,
    email,
    // Password hashing is handled by User model pre-save middleware.
    password
  });

  if (user) {
    try {
      await sendWelcomeEmail(email, name);
    } catch (err) {
      console.error("Welcome email failed", err);
    }
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified
    };
  } else {
    throw new Error("User not created");
  }
};

export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error("All fields are required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  // Generate and send OTP for verification
  const otp = generateOtp();
  await saveOtp(email, otp);

  await sendOTPEmail(email, otp);

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    message: "OTP sent to your email. Please verify to complete login."
  };
};

export const sendOTP = async (email) => {
  if (!email) {
    throw new Error("Email is required");
  }

  // Find existing user or create a new one
  let user = await User.findOne({ email });

  // If user doesn't exist, create a new one with a default name
  if (!user) {
    user = await User.create({
      name: email.split('@')[0], // Use part before @ as default name
      email,
      // Schema requires a minimum length password.
      password: Math.random().toString(36).slice(-10),
      isVerified: false
    });
  }

  const otp = generateOtp();

  await saveOtp(email, otp);

  await sendOTPEmail(email, otp);

  return { message: "OTP sent successfully" };
};

export const verifyOTP = async (email, otp) => {
  if (!email || !otp) {
    throw new Error("Email and OTP are required");
  }

  const { verifyOtpService } = await import("./otpServices.js");

  const isValid = await verifyOtpService(email, otp);

  if (isValid) {
    const user = await User.findOne({ email });

    if (user) {
      user.isVerified = true;
      await user.save();
    }

    return {
      message: "OTP verified successfully",
      token: generateToken(user._id)
    };
  }

  throw new Error("Invalid OTP");
};
