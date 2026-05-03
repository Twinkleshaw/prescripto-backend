import PDFDocument from "pdfkit";

export const generateInvoicePDF = (appointment) => {
  return new Promise((resolve, reject) => {
    const {
      doctorId: doctor,
      patientName,
      patientAge,
      date,
      time,
      tokenNumber,
      paymentStatus,
      paymentType,
      _id,
    } = appointment;

    const invoiceNumber = `INV-${date.replace(/-/g, "")}-${String(_id).slice(-6).toUpperCase()}`;
    const consultationFee = doctor.fees || 0;
    const isPaid = paymentStatus === "paid";

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 595; // A4 width in points
    const MARGIN = 50;
    const CONTENT_W = W - MARGIN * 2;

    // ── Colors ──
    const PURPLE = "#6366f1";
    const DARK = "#1a1a1a";
    const GRAY = "#6b7280";
    const LIGHT_BG = "#f3f4f6";
    const GREEN = "#16a34a";
    const RED = "#dc2626";

    // ── Helper: horizontal rule ──
    const hr = (y, color = "#e5e7eb") => {
      doc
        .moveTo(MARGIN, y)
        .lineTo(W - MARGIN, y)
        .strokeColor(color)
        .lineWidth(1)
        .stroke();
    };

    // ── Helper: section title ──
    const sectionTitle = (text, y) => {
      doc.rect(MARGIN, y, 3, 14).fillColor(PURPLE).fill();
      doc
        .fontSize(9)
        .fillColor(PURPLE)
        .font("Helvetica-Bold")
        .text(text.toUpperCase(), MARGIN + 10, y + 1);
      return y + 22;
    };

    // ── Helper: info row ──
    const infoRow = (label, value, y) => {
      doc.fontSize(11).fillColor(GRAY).font("Helvetica").text(label, MARGIN, y);
      doc
        .fontSize(11)
        .fillColor(DARK)
        .font("Helvetica-Bold")
        .text(value, MARGIN, y, {
          align: "right",
          width: CONTENT_W,
        });
      return y + 20;
    };

    let y = MARGIN;

    // ═══════════════════════════════
    // HEADER
    // ═══════════════════════════════
    doc
      .fontSize(9)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("Official Invoice", MARGIN, y, {
        align: "center",
        width: CONTENT_W,
      });
    y += 16;

    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica")
      .text(`Invoice ID: ${invoiceNumber}`, MARGIN, y, {
        align: "center",
        width: CONTENT_W,
      });
    y += 20;

    doc
      .fontSize(22)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text("Prescripto", MARGIN, y, { align: "center", width: CONTENT_W });
    y += 28;

    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica")
      .text(
        "Clinical Excellence & Care  ·  Digital Health Records Division",
        MARGIN,
        y,
        {
          align: "center",
          width: CONTENT_W,
        },
      );
    y += 24;

    hr(y);
    y += 16;

    // ═══════════════════════════════
    // PATIENT INFO
    // ═══════════════════════════════
    y = sectionTitle("Patient Information", y);
    y = infoRow("Full Name", patientName, y);
    y = infoRow("Age", `${patientAge} Years`, y);

    y += 4;
    hr(y);
    y += 16;

    // ═══════════════════════════════
    // DOCTOR INFO
    // ═══════════════════════════════
    y = sectionTitle("Doctor Information", y);
    y = infoRow("Practitioner", doctor.name, y);
    y = infoRow("Speciality", doctor.speciality || "General", y);
    y = infoRow(
      "Clinic Address",
      `${doctor.address?.city || ""}, ${doctor.address?.state || ""}`,
      y,
    );

    y += 4;
    hr(y);
    y += 16;

    // ═══════════════════════════════
    // APPOINTMENT DETAILS
    // ═══════════════════════════════
    y = sectionTitle("Appointment Details", y);
    y = infoRow(
      "Date",
      new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      y,
    );
    y = infoRow("Time", time, y);
    y = infoRow("Token Number", `#${tokenNumber}`, y);
    y = infoRow(
      "Payment Type",
      paymentType === "pay_at_clinic" ? "Pay at Clinic" : "Online",
      y,
    );
    y = infoRow("SL Number", `UID-${String(_id).slice(-6).toUpperCase()}`, y);

    y += 4;
    hr(y);
    y += 16;

    // ═══════════════════════════════
    // PAYMENT SUMMARY TABLE
    // ═══════════════════════════════
    y = sectionTitle("Payment Summary", y);

    // Table header
    doc.rect(MARGIN, y, CONTENT_W, 24).fillColor(LIGHT_BG).fill();
    doc
      .fontSize(9)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text("Description", MARGIN + 10, y + 7)
      .text("Amount", MARGIN, y + 7, { align: "right", width: CONTENT_W - 10 });
    y += 24;

    // Table row
    doc
      .fontSize(11)
      .fillColor(DARK)
      .font("Helvetica")
      .text(
        `${doctor.speciality || "General"} Consultation`,
        MARGIN + 10,
        y + 8,
      );
    doc
      .fontSize(9)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("Specialist Consultation Fee", MARGIN + 10, y + 22);
    doc
      .fontSize(11)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(`Rs. ${consultationFee.toFixed(2)}`, MARGIN, y + 8, {
        align: "right",
        width: CONTENT_W - 10,
      });
    y += 44;

    hr(y);
    y += 8;

    // Subtotal row
    doc
      .fontSize(10)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("Subtotal", MARGIN, y);
    doc
      .fontSize(10)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(`Rs. ${consultationFee.toFixed(2)}`, MARGIN, y, {
        align: "right",
        width: CONTENT_W,
      });
    y += 20;

    // Total row
    hr(y, DARK);
    y += 10;
    doc
      .fontSize(13)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(`Total ${isPaid ? "Paid" : "Due"}`, MARGIN, y);
    doc
      .fontSize(14)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(`Rs. ${consultationFee.toFixed(2)}`, MARGIN, y, {
        align: "right",
        width: CONTENT_W,
      });
    y += 36;

    // ═══════════════════════════════
    // PAYMENT STATUS BADGE
    // ═══════════════════════════════
    const badgeColor = isPaid ? GREEN : RED;
    const badgeText = `PAYMENT STATUS: ${isPaid ? "PAID" : "UNPAID"}`;
    const badgeW = 220;
    const badgeX = (W - badgeW) / 2;

    doc
      .roundedRect(badgeX, y, badgeW, 28, 14)
      .strokeColor(badgeColor)
      .lineWidth(2)
      .stroke();
    doc
      .fontSize(10)
      .fillColor(badgeColor)
      .font("Helvetica-Bold")
      .text(badgeText, badgeX, y + 8, { align: "center", width: badgeW });
    y += 52;

    // ═══════════════════════════════
    // FOOTER
    // ═══════════════════════════════
    const footerY = 750;
    const sigLineX = (W - 160) / 2;
    doc
      .moveTo(sigLineX, footerY)
      .lineTo(sigLineX + 160, footerY)
      .strokeColor("#d1d5db")
      .lineWidth(1)
      .stroke();
    doc
      .fontSize(9)
      .fillColor(DARK)
      .font("Helvetica")
      .text("AUTHORISED SIGNATURE", MARGIN, footerY + 6, {
        align: "center",
        width: CONTENT_W,
      });

    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica")
      .text(
        "This is a computer-generated document. No physical signature is required for validity.\nPlease keep this invoice for your own future use. Valid for 30 days from issue.",
        MARGIN,
        footerY + 22,
        { align: "center", width: CONTENT_W, lineGap: 3 },
      );

    doc.end();
  });
};
