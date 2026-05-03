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

    const doc = new PDFDocument({ size: "A4", margin: 0 });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 595;
    const H = 842;
    const MARGIN = 32;
    const CONTENT_W = W - MARGIN * 2;

    // ── Colors ──
    const TEAL = "#0d9488";
    const TEAL_DARK = "#0f766e";
    const TEAL_LIGHT = "#ccfbf1";
    const WHITE = "#ffffff";
    const DARK = "#111827";
    const GRAY = "#6b7280";
    const LIGHT_BG = "#f9fafb";
    const BORDER = "#e5e7eb";
    const GREEN = "#16a34a";
    const GREEN_BG = "#dcfce7";
    const RED = "#dc2626";
    const RED_BG = "#fee2e2";

    // ── Helpers ──
    const hr = (y, color = BORDER, lw = 0.5) => {
      doc
        .moveTo(MARGIN, y)
        .lineTo(W - MARGIN, y)
        .strokeColor(color)
        .lineWidth(lw)
        .stroke();
    };

    const roundedRect = (x, y, w, h, r, fill, stroke) => {
      doc.roundedRect(x, y, w, h, r);
      if (fill && stroke) {
        doc.fillAndStroke(fill, stroke);
      } else if (fill) {
        doc.fillColor(fill).fill();
      } else if (stroke) {
        doc.strokeColor(stroke).stroke();
      }
    };

    // ── HEADER (teal background) ──
    doc.rect(0, 0, W, 130).fillColor(TEAL).fill();

    // Subtle top pattern dots
    for (let i = 0; i < 8; i++) {
      doc
        .circle(30 + i * 75, 20, 28)
        .fillColor(TEAL_DARK)
        .fillOpacity(0.3)
        .fill();
    }
    doc.fillOpacity(1);

    // Print PDF + Download buttons area (decorative, top right)
    roundedRect(W - 180, 12, 75, 26, 6, null, WHITE);
    doc
      .fontSize(8)
      .fillColor(WHITE)
      .font("Helvetica-Bold")
      .text("⎙  Print PDF", W - 178, 19, { width: 71, align: "center" });

    roundedRect(W - 98, 12, 78, 26, 6, WHITE, WHITE);
    doc
      .fontSize(8)
      .fillColor(TEAL)
      .font("Helvetica-Bold")
      .text("↓  Download", W - 96, 19, { width: 74, align: "center" });

    // "Official Invoice" label
    doc
      .fontSize(9)
      .fillColor(TEAL_LIGHT)
      .font("Helvetica")
      .text("Official Invoice", MARGIN, 48, {
        width: CONTENT_W,
        align: "center",
      });

    // Invoice ID
    doc
      .fontSize(8)
      .fillColor(TEAL_LIGHT)
      .font("Helvetica")
      .text(`Invoice ID: ${invoiceNumber}`, MARGIN, 62, {
        width: CONTENT_W,
        align: "center",
      });

    // Brand name
    doc
      .fontSize(26)
      .fillColor(WHITE)
      .font("Helvetica-Bold")
      .text("Prescripto", MARGIN, 76, { width: CONTENT_W, align: "center" });

    // Tagline
    doc
      .fontSize(8)
      .fillColor(TEAL_LIGHT)
      .font("Helvetica")
      .text(
        "Clinical Excellence & Care  ·  Digital Health Records Division",
        MARGIN,
        106,
        {
          width: CONTENT_W,
          align: "center",
        },
      );

    let y = 140;

    // ── CARD BACKGROUND ──
    doc
      .rect(0, y - 10, W, H - (y - 10))
      .fillColor(LIGHT_BG)
      .fill();

    // ── Helper: section card ──
    const sectionCard = (iconLabel, title, startY) => {
      const cardY = startY;
      roundedRect(MARGIN, cardY, CONTENT_W, 14, 0, null, null);

      // Icon circle
      doc
        .circle(MARGIN + 14, cardY + 7, 10)
        .fillColor(TEAL_LIGHT)
        .fill();
      doc
        .fontSize(9)
        .fillColor(TEAL)
        .font("Helvetica-Bold")
        .text(iconLabel, MARGIN + 8, cardY + 2, { width: 13, align: "center" });

      // Section title
      doc
        .fontSize(10)
        .fillColor(TEAL_DARK)
        .font("Helvetica-Bold")
        .text(title, MARGIN + 30, cardY + 1);

      return cardY + 20;
    };

    // ── Helper: white info card ──
    const startCard = (y, height) => {
      roundedRect(MARGIN, y, CONTENT_W, height, 10, WHITE, BORDER);
      doc.lineWidth(0.5);
      return y + 16;
    };

    // ── Helper: info row inside card ──
    const infoRow = (label, value, y, valueColor = DARK) => {
      doc
        .fontSize(9)
        .fillColor(GRAY)
        .font("Helvetica")
        .text(label, MARGIN + 16, y);
      doc
        .fontSize(9)
        .fillColor(valueColor)
        .font("Helvetica-Bold")
        .text(value, MARGIN, y, { align: "right", width: CONTENT_W - 16 });
      return y + 18;
    };

    // ══════════════════════════════
    // PATIENT INFORMATION
    // ══════════════════════════════
    y = sectionCard("♦", "Patient Information", y);
    const patientCardH = 62;
    let cy = startCard(y, patientCardH);
    cy = infoRow("Full Name", patientName, cy);
    cy = infoRow("Age", `${patientAge} Years`, cy);
    cy = infoRow(
      "Patient ID",
      `#P-${String(_id).slice(-5).toUpperCase()}`,
      cy,
      TEAL,
    );
    y += patientCardH + 14;

    // ══════════════════════════════
    // DOCTOR INFORMATION
    // ══════════════════════════════
    y = sectionCard("✚", "Doctor Information", y);
    const doctorCardH = 62;
    cy = startCard(y, doctorCardH);
    cy = infoRow("Practitioner", doctor.name, cy);
    cy = infoRow("Speciality", doctor.speciality || "General", cy);
    cy = infoRow(
      "Clinic Address",
      `${doctor.address?.city || ""}, ${doctor.address?.state || ""}`,
      cy,
    );
    y += doctorCardH + 14;

    // ══════════════════════════════
    // APPOINTMENT DETAILS
    // ══════════════════════════════
    y = sectionCard("◷", "Appointment Details", y);
    const apptCardH = 100;
    cy = startCard(y, apptCardH);

    // Date + Time side by side
    const colW = (CONTENT_W - 32) / 2;

    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("DATE", MARGIN + 16, cy);
    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("TIME", MARGIN + 16 + colW + 16, cy);
    cy += 12;

    const formattedDate = new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    doc
      .fontSize(10)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(formattedDate, MARGIN + 16, cy);
    doc
      .fontSize(10)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(time, MARGIN + 16 + colW + 16, cy);
    cy += 18;

    hr(cy, BORDER);
    cy += 10;

    // Token + SL Number side by side
    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("TOKEN NUMBER", MARGIN + 16, cy);
    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("SL NUMBER", MARGIN + 16 + colW + 16, cy);
    cy += 12;
    doc
      .fontSize(10)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(`#${tokenNumber}`, MARGIN + 16, cy);
    doc
      .fontSize(10)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(
        `UID-${String(_id).slice(-6).toUpperCase()}`,
        MARGIN + 16 + colW + 16,
        cy,
      );
    cy += 18;

    y += apptCardH + 14;

    // ══════════════════════════════
    // PAYMENT SUMMARY
    // ══════════════════════════════
    y = sectionCard("₹", "Payment Summary", y);
    const payCardH = 130;
    cy = startCard(y, payCardH);

    // Table header
    doc
      .rect(MARGIN, cy - 4, CONTENT_W, 22)
      .fillColor("#f3f4f6")
      .fill();
    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica-Bold")
      .text("DESCRIPTION", MARGIN + 16, cy + 2);
    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica-Bold")
      .text("AMOUNT", MARGIN, cy + 2, {
        align: "right",
        width: CONTENT_W - 16,
      });
    cy += 22;

    // Service row
    doc
      .fontSize(10)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(`${doctor.speciality || "General"} Consultation`, MARGIN + 16, cy);
    doc
      .fontSize(10)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(`Rs. ${consultationFee.toFixed(2)}`, MARGIN, cy, {
        align: "right",
        width: CONTENT_W - 16,
      });
    cy += 14;
    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("Specialist Consultation Fee", MARGIN + 16, cy);
    cy += 16;

    hr(cy, BORDER);
    cy += 8;

    // Subtotal
    doc
      .fontSize(9)
      .fillColor(GRAY)
      .font("Helvetica")
      .text("Subtotal", MARGIN + 16, cy);
    doc
      .fontSize(9)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(`Rs. ${consultationFee.toFixed(2)}`, MARGIN, cy, {
        align: "right",
        width: CONTENT_W - 16,
      });
    cy += 14;

    // Total Paid row (teal background)
    doc
      .rect(MARGIN, cy - 2, CONTENT_W, 26)
      .fillColor(TEAL_LIGHT)
      .fill();
    doc
      .fontSize(12)
      .fillColor(TEAL_DARK)
      .font("Helvetica-Bold")
      .text("Total Paid", MARGIN + 16, cy + 4);
    doc
      .fontSize(14)
      .fillColor(TEAL_DARK)
      .font("Helvetica-Bold")
      .text(`Rs. ${consultationFee.toFixed(2)}`, MARGIN, cy + 3, {
        align: "right",
        width: CONTENT_W - 16,
      });

    y += payCardH + 16;

    // ══════════════════════════════
    // PAYMENT STATUS BADGE
    // ══════════════════════════════
    const badgeW = 200;
    const badgeX = (W - badgeW) / 2;
    const badgeColor = isPaid ? GREEN : RED;
    const badgeBg = isPaid ? GREEN_BG : RED_BG;
    const badgeText = isPaid
      ? "✓  PAYMENT STATUS: PAID"
      : "✗  PAYMENT STATUS: UNPAID";

    roundedRect(badgeX, y, badgeW, 30, 15, badgeBg, badgeColor);
    doc.lineWidth(1.5);
    doc
      .fontSize(9)
      .fillColor(badgeColor)
      .font("Helvetica-Bold")
      .text(badgeText, badgeX, y + 10, { width: badgeW, align: "center" });

    y += 50;

    // ══════════════════════════════
    // FOOTER
    // ══════════════════════════════
    const footerY = Math.max(y, 760);

    // Signature line
    const sigX = (W - 160) / 2;
    doc
      .moveTo(sigX, footerY)
      .lineTo(sigX + 160, footerY)
      .strokeColor(BORDER)
      .lineWidth(1)
      .stroke();
    doc
      .fontSize(8)
      .fillColor(GRAY)
      .font("Helvetica-Bold")
      .text("AUTHORISED SIGNATURE", MARGIN, footerY + 5, {
        align: "center",
        width: CONTENT_W,
      });

    doc
      .fontSize(7)
      .fillColor(GRAY)
      .font("Helvetica")
      .text(
        "This is a computer-generated document. No physical signature is required for validity.",
        MARGIN,
        footerY + 20,
        { align: "center", width: CONTENT_W },
      );
    doc
      .fontSize(7)
      .fillColor(GRAY)
      .font("Helvetica")
      .text(
        "Please keep this invoice for your own future use. Valid for 30 days from issue.",
        MARGIN,
        footerY + 32,
        { align: "center", width: CONTENT_W },
      );

    doc.end();
  });
};
