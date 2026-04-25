const otpStore = new Map();

export const saveOTP = (phone, otp) => {
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
  });
};

export const verifyOTP = (phone, otp) => {
  const record = otpStore.get(phone);

  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return false;
  }

  if (record.otp !== otp) return false;

  otpStore.delete(phone); // one-time use
  return true;
};