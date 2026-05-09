import PDFDocument from "pdfkit";

export const generateInvoicePDF = async (appointment) => {
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

  const formattedDate = new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const patientId = `#P-${String(_id).slice(-5).toUpperCase()}`;
  const slNumber = `UID-${String(_id).slice(-6).toUpperCase()}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
    });

    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const W = 595.28; // A4 width in points
    const teal = "#0d9488";
    const darkTeal = "#0f766e";
    const deepTeal = "#134E4A";
    const lightGray = "#f3f4f6";
    const borderGray = "#e5e7eb";
    const textGray = "#6b7280";
    const darkText = "#111827";
    const bgGray = "#f9fafb";

    // ── BACKGROUND ──
    doc.rect(0, 0, W, 841.89).fill(bgGray);

    // ── HEADER BACKGROUND ──
    doc.rect(0, 0, W, 130).fill("#f0fdfa");

    // ── DECORATIVE CIRCLES ──
    doc.circle(-20, -20, 60).fillOpacity(0.15).fill(teal);
    doc.circle(60, -10, 45).fillOpacity(0.1).fill(teal);
    doc
      .circle(W + 20, -20, 60)
      .fillOpacity(0.15)
      .fill(teal);
    doc
      .circle(W - 60, 10, 40)
      .fillOpacity(0.1)
      .fill(teal);
    doc.fillOpacity(1);

    // ── HEADER TEXT ──
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(deepTeal)
      .text("Prescripto", 0, 28, { align: "center", width: W });

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#3D4947")
      .text(`Invoice ID: ${invoiceNumber}`, 0, 52, {
        align: "center",
        width: W,
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#3D4947")
      .text(
        "Clinical Excellence & Care  |  Digital Health Records Division",
        0,
        72,
        {
          align: "center",
          width: W,
        },
      );

    // ── DIVIDER ──
    doc
      .moveTo(40, 100)
      .lineTo(W - 40, 100)
      .strokeColor(borderGray)
      .lineWidth(0.5)
      .stroke();

    let y = 115;
    const PX = 40; // page horizontal padding
    const CW = W - PX * 2; // content width

    // ── HELPER FUNCTIONS ──

    const sectionHeader = (label, iconType, yPos) => {
      // Icon circle
      doc.circle(PX + 8, yPos + 8, 8).fill("#ccfbf1");

      // Simple icon inside circle
      doc.strokeColor(teal).lineWidth(1.5);
      if (iconType === "person") {
        doc.circle(PX + 8, yPos + 5, 3).stroke();
        doc
          .moveTo(PX + 3, yPos + 14)
          .quadraticCurveTo(PX + 8, yPos + 11, PX + 13, yPos + 14)
          .stroke();
      } else if (iconType === "plus") {
        doc
          .moveTo(PX + 8, yPos + 5)
          .lineTo(PX + 8, yPos + 11)
          .stroke();
        doc
          .moveTo(PX + 5, yPos + 8)
          .lineTo(PX + 11, yPos + 8)
          .stroke();
      } else if (iconType === "clock") {
        doc.circle(PX + 8, yPos + 8, 4).stroke();
        doc
          .moveTo(PX + 8, yPos + 5)
          .lineTo(PX + 8, yPos + 8)
          .lineTo(PX + 10, yPos + 8)
          .stroke();
      } else if (iconType === "dollar") {
        doc
          .moveTo(PX + 8, yPos + 4)
          .lineTo(PX + 8, yPos + 12)
          .stroke();
        doc
          .moveTo(PX + 5, yPos + 6)
          .quadraticCurveTo(PX + 8, yPos + 5, PX + 11, yPos + 6)
          .stroke();
        doc
          .moveTo(PX + 5, yPos + 10)
          .quadraticCurveTo(PX + 8, yPos + 11, PX + 11, yPos + 10)
          .stroke();
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(darkTeal)
        .text(label, PX + 22, yPos + 2);

      return yPos + 24;
    };

    const card = (yPos, height) => {
      doc
        .roundedRect(PX, yPos, CW, height, 10)
        .fillAndStroke(lightGray, borderGray);
      doc.strokeColor(borderGray).lineWidth(0.5);
    };

    const infoRow = (label, value, yPos, valueColor = darkText) => {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(textGray)
        .text(label, PX + 16, yPos);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(valueColor)
        .text(value, PX + 16, yPos, {
          align: "right",
          width: CW - 32,
        });
    };

    // ── PATIENT INFO ──
    y = sectionHeader("Patient Information", "person", y);
    y += 4;
    card(y, 82);
    infoRow("Full Name", patientName, y + 12);
    doc
      .moveTo(PX + 10, y + 30)
      .lineTo(PX + CW - 10, y + 30)
      .strokeColor(borderGray)
      .lineWidth(0.3)
      .stroke();
    infoRow("Age", `${patientAge} Years`, y + 38);
    doc
      .moveTo(PX + 10, y + 56)
      .lineTo(PX + CW - 10, y + 56)
      .strokeColor(borderGray)
      .lineWidth(0.3)
      .stroke();
    infoRow("Patient ID", patientId, y + 62, teal);
    y += 96;

    // ── DOCTOR INFO ──
    y = sectionHeader("Doctor Information", "plus", y);
    y += 4;
    card(y, 82);
    infoRow("Practitioner", doctor.name, y + 12);
    doc
      .moveTo(PX + 10, y + 30)
      .lineTo(PX + CW - 10, y + 30)
      .strokeColor(borderGray)
      .lineWidth(0.3)
      .stroke();
    infoRow("Speciality", doctor.speciality || "General", y + 38);
    doc
      .moveTo(PX + 10, y + 56)
      .lineTo(PX + CW - 10, y + 56)
      .strokeColor(borderGray)
      .lineWidth(0.3)
      .stroke();
    const address =
      `${doctor.address?.city || ""}, ${doctor.address?.state || ""} ${doctor.address?.pinCode || ""}`.trim();
    infoRow("Clinic Address", address, y + 62);
    y += 96;

    // ── APPOINTMENT DETAILS ──
    y = sectionHeader("Appointment Details", "clock", y);
    y += 4;
    card(y, 90);

    // Two columns
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(textGray)
      .text("DATE", PX + 16, y + 12);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(darkText)
      .text(formattedDate, PX + 16, y + 24);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(textGray)
      .text("TIME", PX + CW / 2 + 8, y + 12);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(darkText)
      .text(time, PX + CW / 2 + 8, y + 24);

    doc
      .moveTo(PX + 10, y + 44)
      .lineTo(PX + CW - 10, y + 44)
      .strokeColor(borderGray)
      .lineWidth(0.3)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(textGray)
      .text("TOKEN NUMBER", PX + 16, y + 54);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(darkText)
      .text(`#${tokenNumber}`, PX + 16, y + 66);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(textGray)
      .text("SL NUMBER", PX + CW / 2 + 8, y + 54);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(darkText)
      .text(slNumber, PX + CW / 2 + 8, y + 66);

    y += 104;

    // ── PAYMENT SUMMARY ──
    y = sectionHeader("Payment Summary", "dollar", y);
    y += 4;
    card(y, 100);

    // Table header inside card
    doc.rect(PX, y, CW, 24).fill("#e5e7eb");
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(textGray)
      .text("DESCRIPTION", PX + 16, y + 8);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(textGray)
      .text("AMOUNT", PX + 16, y + 8, {
        align: "right",
        width: CW - 32,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(darkText)
      .text(`${doctor.speciality || "General"} Consultation`, PX + 16, y + 32);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(darkText)
      .text(`Rs. ${consultationFee.toFixed(2)}`, PX + 16, y + 32, {
        align: "right",
        width: CW - 32,
      });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(textGray)
      .text("Specialist Consultation Fee", PX + 16, y + 46);

    doc
      .moveTo(PX + 10, y + 60)
      .lineTo(PX + CW - 10, y + 60)
      .strokeColor(borderGray)
      .lineWidth(0.3)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(textGray)
      .text("Subtotal", PX + 16, y + 68);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(darkText)
      .text(`Rs. ${consultationFee.toFixed(2)}`, PX + 16, y + 68, {
        align: "right",
        width: CW - 32,
      });

    // Total bar
    doc.roundedRect(PX, y + 82, CW, 24, 10).fill("#ccfbf1");
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(darkTeal)
      .text("Total Paid", PX + 16, y + 89);
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(darkTeal)
      .text(`Rs. ${consultationFee.toFixed(2)}`, PX + 16, y + 89, {
        align: "right",
        width: CW - 32,
      });

    y += 116;

    // ── STATUS BADGE ──
    const badgeColor = isPaid ? "#16a34a" : "#dc2626";
    const badgeBg = isPaid ? "#dcfce7" : "#fee2e2";
    const badgeBorder = isPaid ? "#bbf7d0" : "#fecaca";
    const badgeText = isPaid
      ? "✓  PAYMENT STATUS: PAID"
      : "✗  PAYMENT STATUS: UNPAID";
    const badgeW = 180;
    const badgeX = (W - badgeW) / 2;

    doc
      .roundedRect(badgeX, y + 10, badgeW, 24, 12)
      .fillAndStroke(badgeBg, badgeBorder);
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(badgeColor)
      .text(badgeText, badgeX, y + 17, {
        align: "center",
        width: badgeW,
      });

    y += 48;

    // ── FOOTER ──
    const sigLineX = (W - 120) / 2;
    doc
      .moveTo(sigLineX, y + 20)
      .lineTo(sigLineX + 120, y + 20)
      .strokeColor(borderGray)
      .lineWidth(0.5)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(textGray)
      .text("AUTHORISED SIGNATURE", 0, y + 26, {
        align: "center",
        width: W,
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#9ca3af")
      .text(
        "This is a computer-generated document. No physical signature is required for validity.\nPlease keep this invoice for your own future use. Valid for 30 days from issue.",
        PX,
        y + 40,
        { align: "center", width: CW, lineGap: 3 },
      );

    doc.end();
  });
};
