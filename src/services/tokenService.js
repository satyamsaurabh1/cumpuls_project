import User from '../models/User.js';

export const deductToken = async (userId, amount = 1) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  user.tokens -= amount;
  if (user.tokens < 0) {
    user.tokens = 0; // Ensure tokens don't go negative
  }
  await user.save();
  return user.tokens;

}