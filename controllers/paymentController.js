import crypto from "crypto";
import Appointment from "../models/Appointment.js";
import {
  PhonePeConfigurationError,
  phonePeService,
} from "../services/phonePeService.js";

class PaymentVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PaymentVerificationError";
  }
}

const amountInPaise = (appointment) =>
  Math.round(Number(appointment.amount) * 100);

const providerError = (error) =>
  error.response?.data || { message: error.message };

const buildRedirectUrl = (appointmentId) => {
  const configuredUrl = process.env.PHONEPE_REDIRECT_URL?.trim();

  if (!configuredUrl) {
    throw new PhonePeConfigurationError(
      "PHONEPE_REDIRECT_URL is not configured",
    );
  }

  let redirectUrl;

  try {
    redirectUrl = new URL(configuredUrl);
  } catch {
    throw new PhonePeConfigurationError(
      "PHONEPE_REDIRECT_URL must be an absolute URL",
    );
  }

  if (
    (process.env.PHONEPE_ENV || "SANDBOX").toUpperCase() === "PRODUCTION" &&
    redirectUrl.protocol !== "https:"
  ) {
    throw new PhonePeConfigurationError(
      "PHONEPE_REDIRECT_URL must use HTTPS in production",
    );
  }

  redirectUrl.searchParams.set("appointmentId", String(appointmentId));
  return redirectUrl.toString();
};

const mergePaymentResponse = (appointment, source, response) => {
  const existing =
    appointment.paymentResponse &&
    typeof appointment.paymentResponse === "object"
      ? appointment.paymentResponse
      : {};

  appointment.paymentResponse = { ...existing, [source]: response };
  appointment.markModified("paymentResponse");
};

const verifyProviderAmount = (appointment, response) => {
  if (response.amount == null) return;

  if (Number(response.amount) !== amountInPaise(appointment)) {
    throw new PaymentVerificationError(
      "PhonePe amount does not match the appointment amount",
    );
  }
};

const applyProviderStatus = async (appointment, response, source) => {
  verifyProviderAmount(appointment, response);

  const state = response.state?.toUpperCase();

  if (!state) {
    throw new PaymentVerificationError(
      "PhonePe response did not include state",
    );
  }

  if (appointment.paymentStatus !== "paid" || state === "COMPLETED") {
    appointment.paymentState = state;
  }

  if (response.orderId) appointment.phonePeOrderId = response.orderId;

  if (state === "COMPLETED") {
    appointment.paymentStatus = "paid";
    appointment.paidAt ||= new Date();
    appointment.paymentCheckoutUrl = null;
  }

  mergePaymentResponse(appointment, source, response);
  await appointment.save();

  return state;
};

const sendGatewayError = (res, error, context) => {
  if (error instanceof PhonePeConfigurationError) {
    return res.status(503).json({
      success: false,
      message: "Payment gateway is not configured",
      detail: error.message,
    });
  }

  if (error instanceof PaymentVerificationError) {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error(`${context}:`, providerError(error));
  return res.status(502).json({
    success: false,
    message: "Payment provider request failed",
  });
};

export const initiatePayment = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Appointment ID is required" });
    }

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

    if (appointment.status !== "booked") {
      return res.status(400).json({
        success: false,
        message: `Payment cannot be started for a ${appointment.status} appointment`,
      });
    }

    if (appointment.paymentType === "pay_at_clinic") {
      return res.status(400).json({
        success: false,
        message: "This appointment is configured for payment at the clinic",
      });
    }

    if (appointment.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Already paid" });
    }

    const amount = amountInPaise(appointment);

    if (!Number.isSafeInteger(amount) || amount < 100) {
      return res.status(400).json({
        success: false,
        message: "Appointment amount must be at least INR 1.00",
      });
    }

    // A repeated click should return the same live checkout instead of
    // creating a second chargeable order.
    if (
      appointment.paymentCheckoutUrl &&
      appointment.paymentExpiresAt &&
      appointment.paymentExpiresAt > new Date()
    ) {
      return res.json({
        success: true,
        redirectUrl: appointment.paymentCheckoutUrl,
        appointmentId: appointment._id,
        merchantOrderId: appointment.transactionId,
        reused: true,
      });
    }

    // Reconcile an existing V2 order before permitting another attempt.
    if (appointment.transactionId && appointment.paymentState) {
      const currentStatus = await phonePeService.getOrderStatus(
        appointment.transactionId,
      );
      const state = await applyProviderStatus(
        appointment,
        currentStatus,
        "status",
      );

      if (state === "COMPLETED") {
        return res
          .status(400)
          .json({ success: false, message: "Already paid" });
      }

      if (state === "PENDING") {
        return res.status(409).json({
          success: false,
          message: "A payment is already in progress. Check its status first.",
        });
      }
    }

    const merchantOrderId = `APPT-${appointment._id}-${crypto.randomBytes(6).toString("hex")}`;
    const redirectUrl = buildRedirectUrl(appointment._id);
    const response = await phonePeService.createPayment({
      merchantOrderId,
      amount,
      redirectUrl,
      message: `Appointment payment ${appointment._id}`,
    });

    if (!response?.redirectUrl) {
      throw new PaymentVerificationError(
        "PhonePe did not return a checkout URL",
      );
    }

    appointment.transactionId = merchantOrderId;
    appointment.phonePeOrderId = response.orderId || null;
    appointment.paymentProvider = "phonepe";
    appointment.paymentType = "online";
    appointment.paymentState = (response.state || "PENDING").toUpperCase();
    appointment.paymentCheckoutUrl = response.redirectUrl;
    appointment.paymentExpiresAt = new Date(
      response.expireAt ||
        response.expiryAt ||
        Date.now() + phonePeService.getOrderExpirySeconds() * 1000,
    );
    mergePaymentResponse(appointment, "initiate", response);
    await appointment.save();

    return res.json({
      success: true,
      redirectUrl: response.redirectUrl,
      appointmentId: appointment._id,
      merchantOrderId,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointment ID" });
    }

    return sendGatewayError(res, error, "PHONEPE INITIATE ERROR");
  }
};

export const phonePeCallback = async (req, res) => {
  try {
    const authorization = req.get("authorization");

    if (!phonePeService.verifyWebhookAuthorization(authorization)) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid webhook signature" });
    }

    const { event, payload } = req.body || {};
    const merchantOrderId = payload?.merchantOrderId;

    if (!event || !merchantOrderId || !payload?.state) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid webhook payload" });
    }

    if (
      !["checkout.order.completed", "checkout.order.failed"].includes(event)
    ) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const appointment = await Appointment.findOne({
      transactionId: merchantOrderId,
    });

    if (!appointment) {
      console.warn(`PHONEPE WEBHOOK: unknown order ${merchantOrderId}`);
      return res.status(200).json({ success: true, ignored: true });
    }

    await applyProviderStatus(appointment, payload, "webhook");
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendGatewayError(res, error, "PHONEPE WEBHOOK ERROR");
  }
};

export const phonePeRedirect = async (req, res) => {
  try {
    const appointment = req.query.appointmentId
      ? await Appointment.findById(req.query.appointmentId)
      : req.query.merchantOrderId
        ? await Appointment.findOne({
            transactionId: req.query.merchantOrderId,
          })
        : null;

    if (!appointment || !appointment.transactionId) {
      return res.status(404).send("Payment order not found");
    }

    const statusResponse = await phonePeService.getOrderStatus(
      appointment.transactionId,
    );
    const state = await applyProviderStatus(
      appointment,
      statusResponse,
      "redirectStatus",
    );

    if (process.env.PHONEPE_RESULT_URL?.trim()) {
      const resultUrl = new URL(process.env.PHONEPE_RESULT_URL.trim());
      resultUrl.searchParams.set("appointmentId", String(appointment._id));
      resultUrl.searchParams.set("status", state.toLowerCase());
      return res.redirect(303, resultUrl.toString());
    }

    const successful = state === "COMPLETED";
    return res.status(200).send(`
      <!doctype html>
      <html lang="en">
        <head><meta charset="utf-8"><title>Payment status</title></head>
        <body style="font-family:sans-serif;text-align:center;margin-top:50px;">
          <h2>${successful ? "Payment completed successfully" : `Payment status: ${state}`}</h2>
          <p>You can safely return to the application.</p>
        </body>
      </html>
    `);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).send("Invalid payment order");
    }

    console.error("PHONEPE REDIRECT ERROR:", providerError(error));
    return res.status(502).send("Unable to verify payment status");
  }
};

export const getAppointmentPaymentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
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

    let providerState = appointment.paymentState || null;
    let verified = false;

    if (
      appointment.paymentType === "online" &&
      appointment.transactionId &&
      appointment.paymentState
    ) {
      const statusResponse = await phonePeService.getOrderStatus(
        appointment.transactionId,
      );
      providerState = await applyProviderStatus(
        appointment,
        statusResponse,
        "status",
      );
      verified = true;
    }

    return res.json({
      success: true,
      paymentStatus: appointment.paymentStatus,
      providerState,
      amount: appointment.amount,
      paidAt: appointment.paidAt,
      merchantOrderId: appointment.transactionId,
      verified,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointment ID" });
    }

    return sendGatewayError(res, error, "PHONEPE STATUS ERROR");
  }
};
