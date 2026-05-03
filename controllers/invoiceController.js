import Appointment from "../models/Appointment.js";
import { generateInvoicePDF } from "../utils/generateInvoicePDF.js";

export const downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user.id;

    // Fetch appointment — only allow the owner patient to download
    const appointment = await Appointment.findOne({
      _id: id,
      patientId,
    }).populate("doctorId", "-password");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Allow both paid and unpaid — just show different status on invoice
    const pdfBuffer = await generateInvoicePDF(appointment);

    const invoiceNumber = `INV-${appointment.date.replace(/-/g, "")}-${String(appointment._id).slice(-6).toUpperCase()}`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Invoice generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate invoice",
    });
  }
};
