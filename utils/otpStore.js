const otpStore = new Map();

export const saveOTP = (phone, otp) => {
  otpStore.set(phone, otp);
};

export const verifyOTP = (phone, otp) => {
  return otpStore.get(phone) === otp;
};