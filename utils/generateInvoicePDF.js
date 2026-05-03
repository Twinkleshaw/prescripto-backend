import puppeteer from "puppeteer";

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

  const paymentStatusLabel = paymentStatus === "paid" ? "PAID" : "UNPAID";
  const paymentStatusColor = paymentStatus === "paid" ? "#16a34a" : "#dc2626";

  const consultationFee = doctor.fees || 0;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; font-size: 13px; }

        .header { text-align: center; margin-bottom: 28px; }
        .header h1 { font-size: 26px; font-weight: 700; color: #1a1a1a; }
        .header p { font-size: 11px; color: #666; margin-top: 2px; }
        .invoice-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
        .invoice-id { font-size: 12px; color: #555; margin-bottom: 16px; }

        .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }

        .section { margin-bottom: 18px; }
        .section-title { font-size: 12px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .section-title::before { content: ''; display: inline-block; width: 3px; height: 14px; background: #6366f1; border-radius: 2px; }

        .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .info-label { color: #666; font-size: 12px; }
        .info-value { font-weight: 500; font-size: 12px; text-align: right; }

        .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .table th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #374151; }
        .table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
        .table .amount { text-align: right; font-weight: 600; }

        .total-row { display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #1a1a1a; margin-top: 8px; }
        .total-label { font-size: 14px; font-weight: 700; }
        .total-amount { font-size: 16px; font-weight: 700; }

        .payment-badge { display: inline-block; padding: 6px 18px; border-radius: 20px; font-size: 13px; font-weight: 700; letter-spacing: 1px; color: ${paymentStatusColor}; border: 2px solid ${paymentStatusColor}; margin-top: 16px; }

        .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #9ca3af; line-height: 1.6; }
        .footer .signature { border-top: 1px solid #d1d5db; display: inline-block; padding-top: 6px; margin-bottom: 10px; min-width: 160px; font-size: 11px; color: #374151; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="invoice-title">Official Invoice</div>
        <div class="invoice-id">Invoice ID: ${invoiceNumber}</div>
        <h1>Prescripto</h1>
        <p>Clinical Excellence &amp; Care · Digital Health Records Division</p>
      </div>

      <hr class="divider" />

      <!-- Patient Info -->
      <div class="section">
        <div class="section-title">Patient Information</div>
        <div class="info-row">
          <span class="info-label">Full Name</span>
          <span class="info-value">${patientName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Age</span>
          <span class="info-value">${patientAge} Years</span>
        </div>
      </div>

      <hr class="divider" />

      <!-- Doctor Info -->
      <div class="section">
        <div class="section-title">Doctor Information</div>
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
          <span class="info-value">${doctor.address?.city || ""}, ${doctor.address?.state || ""}</span>
        </div>
      </div>

      <hr class="divider" />

      <!-- Appointment Details -->
      <div class="section">
        <div class="section-title">Appointment Details</div>
        <div class="info-row">
          <span class="info-label">Date</span>
          <span class="info-value">${new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Time</span>
          <span class="info-value">${time}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Token Number</span>
          <span class="info-value">#${tokenNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Type</span>
          <span class="info-value">${paymentType === "pay_at_clinic" ? "Pay at Clinic" : "Online"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">SL Number</span>
          <span class="info-value">UID-${String(_id).slice(-6).toUpperCase()}</span>
        </div>
      </div>

      <hr class="divider" />

      <!-- Payment Summary -->
      <div class="section">
        <div class="section-title">Payment Summary</div>
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${doctor.speciality || "General"} Consultation<br/><span style="color:#888;font-size:11px">Specialist Consultation Fee</span></td>
              <td class="amount">₹${consultationFee.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div class="total-row">
          <span class="total-label">Total ${paymentStatus === "paid" ? "Paid" : "Due"}</span>
          <span class="total-amount">₹${consultationFee.toFixed(2)}</span>
        </div>
      </div>

      <div style="text-align:center">
        <div class="payment-badge">⊙ PAYMENT STATUS: ${paymentStatusLabel}</div>
      </div>

      <div class="footer">
        <div class="signature">AUTHORISED SIGNATURE</div>
        <p>This is a computer-generated document. No physical signature is required for validity.</p>
        <p>Please keep this invoice for your own future use. Valid for 30 Days from issue.</p>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return pdfBuffer;
  } finally {
    await browser.close(); // always closes even if error
  }
};
