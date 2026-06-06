import Appointment from "../models/Appointment.js";
import { generateInvoicePDF } from "../utils/generateInvoicePDF.js";

export const downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user.id;

    // Fetch appointment — only allow the owner patient to download
    let appointment;

    if (req.user.role === "admin") {
      appointment = await Appointment.findById(id).populate(
        "doctorId",
        "-password",
      );
    } else {
      appointment = await Appointment.findOne({
        _id: id,
        $or: [{ bookedBy: req.user.id }, { patientId: req.user.id }],
      }).populate("doctorId", "-password");
    }

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

export const getInvoices = async (req, res) => {
  try {
    const { search, paymentStatus } = req.query;

    let filter = {};

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      filter.patientName = {
        $regex: search,
        $options: "i",
      };
    }

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name speciality")
      .populate("bookedBy", "name phone")
      .sort({ createdAt: -1 });

    const invoices = appointments.map((appointment) => ({
      invoiceId: `INV-${String(appointment._id).slice(-6).toUpperCase()}`,

      appointmentId: appointment._id,

      patientName: appointment.patientName,

      doctorName: appointment.doctorId?.name,

      speciality: appointment.doctorId?.speciality,

      bookedBy: appointment.bookedBy?.name,

      amount: appointment.amount,

      paymentStatus: appointment.paymentStatus,

      serviceDate: appointment.date,

      createdAt: appointment.createdAt,
    }));

    return res.json({
      success: true,
      total: invoices.length,
      invoices,
    });
  } catch (error) {
    console.error("GET INVOICES ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};
