import axios from "axios";

export const sendOtpSms = async (phone, otp) => {
  //   const message = `Your OTP for login is ${otp}. Do not share this OTP with anyone. Regards, SAMMON.`;
  const message = `Dear Client your code is ${otp},Thank you for visiting our website for testing ${otp} for SMS Service`;

  const response = await axios.get("https://softsms.in/app/smsapi/index.php", {
    params: {
      key: process.env.SOFTSMS_API_KEY,
      type: "text",
      contacts: phone.replace("+91", ""),
      senderid: process.env.SOFTSMS_SENDER_ID,
      peid: process.env.SOFTSMS_PE_ID,
      templateid: process.env.SOFTSMS_TEMPLATE_ID,
      msg: message,
    },
  });

  return response.data;
};
