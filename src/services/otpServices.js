import Otp from "../models/Otp.js";

export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveOtp = async (email, otp) => {
  await Otp.deleteMany({ email });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const res = await Otp.create({
    email,
    otp,
    expiresAt
  });
  
  console.log("otp created", res);
};

export const verifyOtpService = async (email, otp) => {
  const record = await Otp.findOne({ email, otp });

  if (!record) {
    throw new Error("Invalid OTP");
  }

  if (record.expiresAt < new Date()) {
    throw new Error("OTP expired");
  }

  await Otp.deleteMany({ email });

  return true;
};
