// paymentController.js
import axios from "axios";
import crypto from "crypto";
import Appointment from "../models/Appointment.js";

function checksum(str, saltKey, saltIndex) {
  return (
    crypto
      .createHash("sha256")
      .update(str + saltKey)
      .digest("hex") +
    "###" +
    saltIndex
  );
}

export const initiatePayment = async (req, res) => {
  const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
  const SALT_KEY = process.env.PHONEPE_SALT_KEY;
  const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
  const BASE_URL = process.env.PHONEPE_BASE_URL;
  const REDIRECT_URL = process.env.PHONEPE_REDIRECT_URL;
  const CALLBACK_URL = process.env.PHONEPE_CALLBACK_URL;

  try {
    const { appointmentId } = req.body;
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }
    if (String(appointment.bookedBy) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not your appointment" });
    }
    if (appointment.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Already paid" });
    }

    const merchantTransactionId = `TXN${Date.now()}${crypto.randomBytes(4).toString("hex")}`;

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: String(req.user.id),
      amount: Math.round(appointment.amount * 100),
      redirectUrl: REDIRECT_URL,
      redirectMode: "REDIRECT",
      callbackUrl: CALLBACK_URL,
      paymentInstrument: { type: "PAY_PAGE" },
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
      "base64",
    );
    const xVerify = checksum(
      base64Payload + "/pg/v1/pay",
      SALT_KEY,
      SALT_INDEX,
    );

    const response = await axios.post(
      `${BASE_URL}/pg/v1/pay`,
      { request: base64Payload },
      { headers: { "Content-Type": "application/json", "X-VERIFY": xVerify } },
    );

    appointment.transactionId = merchantTransactionId;
    appointment.paymentProvider = "phonepe";
    await appointment.save();

    return res.json({
      success: true,
      redirectUrl: response.data?.data?.instrumentResponse?.redirectInfo?.url,
      appointmentId: appointment._id,
    });
  } catch (error) {
    console.error("INITIATE PAYMENT ERROR:", error?.response?.data || error);
    res
      .status(500)
      .json({ success: false, message: "Payment initiation failed" });
  }
};

export const phonePeCallback = async (req, res) => {
  const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
  const SALT_KEY = process.env.PHONEPE_SALT_KEY;
  const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
  const BASE_URL = process.env.PHONEPE_BASE_URL;

  try {
    const xVerifyHeader = req.headers["x-verify"];
    const base64Response = req.body?.response;

    if (!base64Response || !xVerifyHeader) {
      return res.status(400).json({ success: false });
    }

    const expected = checksum(base64Response, SALT_KEY, SALT_INDEX);
    console.log("RECEIVED X-VERIFY:", xVerifyHeader);
    console.log("COMPUTED EXPECTED:", expected);
    console.log(
      "SALT_KEY USED (masked):",
      SALT_KEY ? SALT_KEY.slice(0, 4) + "..." + SALT_KEY.slice(-4) : "MISSING",
    );
    if (expected !== xVerifyHeader) {
      console.warn("PhonePe callback signature mismatch");
      return res.status(400).json({ success: false });
    }

    const decoded = JSON.parse(
      Buffer.from(base64Response, "base64").toString(),
    );
    const merchantTransactionId = decoded?.data?.merchantTransactionId;

    const statusPath = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
    const statusVerify = checksum(statusPath, SALT_KEY, SALT_INDEX);
    const statusRes = await axios.get(`${BASE_URL}${statusPath}`, {
      headers: {
        "X-VERIFY": statusVerify,
        "X-MERCHANT-ID": MERCHANT_ID,
        "Content-Type": "application/json",
      },
    });

    const appointment = await Appointment.findOne({
      transactionId: merchantTransactionId,
    });
    if (!appointment) return res.status(404).json({ success: false });

    if (statusRes.data?.code === "PAYMENT_SUCCESS") {
      appointment.paymentStatus = "paid";
      appointment.paidAt = new Date();
      appointment.paymentResponse = statusRes.data;
      await appointment.save();
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("CALLBACK ERROR:", error?.response?.data || error);
    return res.status(500).json({ success: false });
  }
};

export const phonePeRedirect = async (req, res) => {
  const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
  const SALT_KEY = process.env.PHONEPE_SALT_KEY;
  const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
  const BASE_URL = process.env.PHONEPE_BASE_URL;

  try {
    console.log("REDIRECT QUERY:", req.query);
    console.log("REDIRECT BODY:", req.body);

    // adjust this once we see what PhonePe actually sends in the log above
    const merchantTransactionId =
      req.query?.merchantTransactionId || req.query?.transactionId;

    if (merchantTransactionId) {
      const statusPath = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
      const statusVerify = checksum(statusPath, SALT_KEY, SALT_INDEX);
      const statusRes = await axios.get(`${BASE_URL}${statusPath}`, {
        headers: {
          "X-VERIFY": statusVerify,
          "X-MERCHANT-ID": MERCHANT_ID,
          "Content-Type": "application/json",
        },
      });

      if (statusRes.data?.code === "PAYMENT_SUCCESS") {
        const appointment = await Appointment.findOne({
          transactionId: merchantTransactionId,
        });
        if (appointment && appointment.paymentStatus !== "paid") {
          appointment.paymentStatus = "paid";
          appointment.paidAt = new Date();
          appointment.paymentResponse = statusRes.data;
          await appointment.save();
        }
      }
    }

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:50px;">
        <h2>Payment completed. Returning to app...</h2>
      </body></html>
    `);
  } catch (error) {
    console.error("REDIRECT ERROR:", error?.response?.data || error);
    res.status(500).send("Something went wrong");
  }
};

export const getAppointmentPaymentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    if (String(appointment.bookedBy) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not your appointment" });
    }

    return res.json({
      success: true,
      paymentStatus: appointment.paymentStatus, // "pending" or "paid"
      amount: appointment.amount,
      paidAt: appointment.paidAt,
    });
  } catch (error) {
    console.error("STATUS ERROR:", error);
    res.status(500).json({ success: false });
  }
};
