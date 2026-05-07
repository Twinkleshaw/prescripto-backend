import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
/**
 * Generates a polished invoice PDF using Puppeteer.
 * Returns a Buffer containing the PDF bytes.
 *
 * @param {Object} appointment - The appointment object (same shape as your existing code)
 * @returns {Promise<Buffer>}
 */
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

  const html = buildInvoiceHTML({
    invoiceNumber,
    consultationFee,
    isPaid,
    formattedDate,
    patientId,
    slNumber,
    doctor,
    patientName,
    patientAge,
    date,
    time,
    tokenNumber,
  });

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

// ─────────────────────────────────────────────
// HTML builder
// ─────────────────────────────────────────────
function buildInvoiceHTML(data) {
  const {
    invoiceNumber,
    consultationFee,
    isPaid,
    formattedDate,
    patientId,
    slNumber,
    doctor,
    patientName,
    patientAge,
    time,
    tokenNumber,
  } = data;

  const badgeColor = isPaid ? "#16a34a" : "#dc2626";
  const badgeBg = isPaid ? "#dcfce7" : "#fee2e2";
  const badgeBorder = isPaid ? "#bbf7d0" : "#fecaca";
  const badgeText = isPaid
    ? "✓  PAYMENT STATUS: PAID"
    : "✗  PAYMENT STATUS: UNPAID";

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<title>Invoice – ${invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
     font-family: 'Manrope', sans-serif;
    background: #f9fafb;
    color: #111827;
      display: flex;
  justify-content: center;   /* horizontal center */
  align-items: flex-start;   /* top aligned */
  }

  .page {
  width: 595px;   /* A4 width */
  min-height: 842px;
  background: #f9fafb;
}

  /* ── HEADER ── */
  .header {
    padding: 0;
    width: 100%;
    height: 150px;
    position: relative;
    overflow: hidden;
  }

  .header-dots {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
  }

  .header-dot {
    position: absolute;
    width: 56px; height: 56px;
    border-radius: 50%;
    background: #0f766e;
    opacity: 0.3;
    top: -8px;
  }

  .header-btns {
    position: absolute;
    top: 12px; right: 32px;
    display: flex; gap: 6px;
  }

  .btn-outline {
    border: 1.5px solid #fff;
    color: #fff;
    background: transparent;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .btn-solid {
    border: 1.5px solid #fff;
    color: #0d9488;
    background: #fff;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
.header-text {
  position: absolute;
  width: 100%;
  top: 40px;
  text-align: center;
}

/* BIG TITLE */
.header-subtitle {
  font-size: 20px;
  font-weight: 800;
  color: #006860;
  margin-bottom: 4px;
}

/* INVOICE ID */
.header-invoice-id {
  font-size: 14px;
  color: #3D4947;
  font-weight: 500;
  margin-bottom: 8px;
}

/* BRAND */
.header-brand {
  font-size: 16px;
  font-weight: 700;
  color: #134E4A;
  margin-bottom: 8px;
}

/* TAGLINE */
.header-tagline {
  font-size: 12px;
  font-weight: 400;
  color: #3D4947;
  line-height: 1.6;
}

  /* ── BODY ── */
  .body {
    background: #f9fafb;
    padding: 16px 32px 32px;
  }

  /* ── SECTION HEADER ── */
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    margin-top: 16px;
  }

.section-icon {
  background: transparent;   /* REMOVE BG */
  width: auto;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.section-icon svg {
  width: 16px;
  height: 16px;
  stroke: #0d9488;
}

  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: #0f766e;
    letter-spacing: 0.2px;
  }

  /* ── CARD ── */
.card {
  background: #f3f4f6;              /* light grey instead of white */
  border: 1px solid #e5e7eb;
  border-radius: 14px;              /* softer corners */
  padding: 18px 20px;               /* more breathing space */
  margin-bottom: 10px;
}

  /* ── INFO ROW ── */
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .info-row:last-child { margin-bottom: 0; }

  .info-label {
    font-size: 14px;
    color: #6b7280;
    font-weight: 500;
  }

  .info-value {
    font-size: 16px;
    color: #111827;
    font-weight: 600;
    text-align: right;
  }

  .info-value.teal { color: #0d9488; }

  /* ── APPOINTMENT COLUMNS ── */
  .appt-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
    margin-bottom: 12px;
  }

  .appt-col-label {
    font-size: 14px;
    color: #6b7280;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .appt-col-value {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .appt-divider {
    border: none;
    border-top: 0.5px solid #e5e7eb;
    margin: 10px 0;
  }

  /* ── PAYMENT TABLE ── */
  .pay-table-header {
    display: flex;
    justify-content: space-between;
    background: #f3f4f6;
    padding: 6px 0px;
    margin: -14px -16px 12px;
    padding-left: 16px;
    padding-right: 16px;
    border-radius: 10px 10px 0 0;
  }

  .pay-th {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pay-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .pay-desc { font-size: 12px; font-weight: 500; color: #111827; }
  .pay-amount { font-size: 12px; font-weight: 500; color: #111827; }
  .pay-subdesc { font-size: 10px; color: #6b7280; margin-bottom: 12px; }

  .pay-subtotal {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 0;
    padding-bottom: 10px;
    border-bottom: 0.5px solid #e5e7eb;
    margin-bottom: 10px;
  }

  .pay-subtotal-val {font-size: 12px; font-weight: 500; color: #111827; }

  .pay-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #ccfbf1;
    margin: 0 -16px -14px;
    padding: 10px 16px;
    border-radius: 0 0 10px 10px;
  }

  .pay-total-label {
    font-size: 12px;
    font-weight: 600;
    color: #0f766e;
  }

  .pay-total-amount {
    font-size: 14px;
    font-weight: 600;
    color: #0f766e;
  }

  /* ── STATUS BADGE ── */
  .badge-wrap {
    display: flex;
    justify-content: center;
    margin: 20px 0 16px;
  }

  .badge {
    display: inline-block;
    padding: 8px 28px;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  /* ── FOOTER ── */
  .footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 12px;
  }

  .sig-line {
    width: 160px;
    border-top: 1px solid #e5e7eb;
    margin: 0 auto 6px;
  }

  .footer-sig {
    font-size: 8px;
    font-weight: 700;
    color: #6b7280;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .footer-note {
    font-size: 10px;
    font-weight: 500;
    color: #9ca3af;
    line-height: 1.6;
  }
</style>
</head>
<body>

<div class="page">

<!-- HEADER -->
<div class="header">

  <div class="header-text">
    <div class="header-brand">Prescripto</div>
    <div class="header-invoice-id">Invoice ID: ${invoiceNumber}</div>
    
   <div class="header-tagline">
  Clinical Excellence &amp; Care<br/>
  Digital Health Records<br/>
  Division
</div>
  </div>
</div>

<!-- BODY -->
<div class="body">

  <!-- PATIENT INFO -->
  <div class="section-header">
    <div class="section-icon">
  <svg viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" width="16" height="16">
    <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5z"/>
    <path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6"/>
  </svg>
</div>
    <span class="section-title">Patient Information</span>
  </div>
  <div class="card">
    <div class="info-row">
      <span class="info-label">Full Name</span>
      <span class="info-value">${patientName}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Age</span>
      <span class="info-value">${patientAge} Years</span>
    </div>
    <div class="info-row">
      <span class="info-label">Patient ID</span>
      <span class="info-value teal">${patientId}</span>
    </div>
  </div>

  <!-- DOCTOR INFO -->
  <div class="section-header">
    <div class="section-icon">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
</div>
    <span class="section-title">Doctor Information</span>
  </div>
  <div class="card">
    <div class="info-row">
      <span class="info-label">Practitioner</span>
      <span class="info-value">${doctor.name}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Speciality</span>
      <span class="info-value">${doctor.speciality || "General"}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Clinic Address</span>
      <span class="info-value">
  ${doctor.address?.city || ""}, ${doctor.address?.state || ""} ${doctor.address?.pinCode || ""}
</span>
    </div>
  </div>

  <!-- APPOINTMENT DETAILS -->
  <div class="section-header">
    <div class="section-icon">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
</div>
    <span class="section-title">Appointment Details</span>
  </div>
  <div class="card">
    <div class="appt-cols">
      <div>
        <div class="appt-col-label">DATE</div>
        <div class="appt-col-value">${formattedDate}</div>
      </div>
      <div>
        <div class="appt-col-label">TIME</div>
        <div class="appt-col-value">${time}</div>
      </div>
    </div>
    <hr class="appt-divider" />
    <div class="appt-cols" style="margin-bottom:0">
      <div>
        <div class="appt-col-label">TOKEN NUMBER</div>
        <div class="appt-col-value">#${tokenNumber}</div>
      </div>
      <div>
        <div class="appt-col-label">SL NUMBER</div>
        <div class="appt-col-value">${slNumber}</div>
      </div>
    </div>
  </div>

  <!-- PAYMENT SUMMARY -->
  <div class="section-header">
    <div class="section-icon">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
</div>
    <span class="section-title">Payment Summary</span>
  </div>
  <div class="card">
    <div class="pay-table-header">
      <span class="pay-th">DESCRIPTION</span>
      <span class="pay-th">AMOUNT</span>
    </div>
    <div class="pay-row">
      <span class="pay-desc">${doctor.speciality || "General"} Consultation</span>
      <span class="pay-amount">Rs. ${consultationFee.toFixed(2)}</span>
    </div>
    <div class="pay-subdesc">Specialist Consultation Fee</div>
    <div class="pay-subtotal">
      <span>Subtotal</span>
      <span class="pay-subtotal-val">Rs. ${consultationFee.toFixed(2)}</span>
    </div>
    <div class="pay-total">
      <span class="pay-total-label">Total Paid</span>
      <span class="pay-total-amount">Rs. ${consultationFee.toFixed(2)}</span>
    </div>
  </div>

  <!-- STATUS BADGE -->
  <div class="badge-wrap">
    <span class="badge" style="background:${badgeBg}; color:${badgeColor}; border: 1.5px solid ${badgeBorder};">
      ${badgeText}
    </span>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="sig-line"></div>
    <div class="footer-sig">AUTHORISED SIGNATURE</div>
    <div class="footer-note">
      This is a computer-generated document. No physical signature is required for validity.<br/>
      Please keep this invoice for your own future use. Valid for 30 days from issue.
    </div>
  </div>

</div>
</div>
</body>
</html>`;
}
