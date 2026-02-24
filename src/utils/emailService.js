import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in environment variables');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  return transporter;
};

export const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: `"CreatorConnect" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your OTP for CreatorConnect Login',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">CreatorConnect OTP Verification</h2>
        <p>Your One-Time Password (OTP) for login is:</p>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; 
                    padding: 20px; 
                    text-align: center; 
                    font-size: 32px; 
                    letter-spacing: 5px;
                    border-radius: 10px;
                    margin: 20px 0;">
          <strong>${otp}</strong>
        </div>
        <p>This OTP is valid for 5 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">© 2025 CreatorConnect. All rights reserved.</p>
      </div>
    `
  };

  await getTransporter().sendMail(mailOptions);
};

export const sendWelcomeEmail = async (email, name) => {
  const mailOptions = {
    from: `"CreatorConnect" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to CreatorConnect!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Welcome to CreatorConnect, ${name}!</h2>
        <p>We're excited to have you on board. Start connecting with other creators today!</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/login" 
             style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;">
            Get Started
          </a>
        </div>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">© 2025 CreatorConnect. All rights reserved.</p>
      </div>
    `
  };

  await getTransporter().sendMail(mailOptions);
};
