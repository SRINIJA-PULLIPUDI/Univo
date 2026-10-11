const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    if (!transporter || transporter._customUser !== user) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      transporter._customUser = user;
      console.log(`[mailer] Configured active SMTP transporter with ${host}:${port} (${user})`);
    }
    return transporter;
  }

  if (!transporter || transporter._isSimulated !== true) {
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    transporter._isSimulated = true;
    console.log("[mailer] SMTP credentials not set in server/.env (using fallback mail logger)");
  }
  return transporter;
}

const DEFAULT_FROM = process.env.SMTP_FROM || '"Univo Academic Portal" <notifications@univo.edu>';

async function sendMail({ to, subject, html, text }) {
  if (!to) return null;
  const client = getTransporter();

  // If to is our target user or any user, attempt sending
  try {
    const info = await client.sendMail({
      from: DEFAULT_FROM,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, " "),
      html,
    });

    console.log(`📧 [mailer] Email sent to: ${to} | Subject: "${subject}"`);
    if (info?.message) {
      console.log(`   [mailer message details]: ${info.message.slice(0, 150)}...`);
    }
    return info;
  } catch (error) {
    console.warn(`⚠️ [mailer] Could not deliver email to ${to}: ${error.message}`);
    console.log(`   [mailer fallback] Subject: ${subject} | Preview: ${text || html.slice(0, 120)}`);
    return null;
  }
}

async function sendNotificationEmail({ to, name = "Student", title, message, category = "Academic Notice", link = "http://localhost:5173/app" }) {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 24px 32px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Univo Academic Portal</h1>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Centralized Campus Communication</p>
      </div>
      <div style="padding: 32px;">
        <span style="display: inline-block; background-color: #f5f3ff; color: #7c3aed; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; border: 1px solid #ddd6fe;">
          ${category}
        </span>
        <h2 style="margin: 8px 0 16px; font-size: 18px; color: #0f172a;">${title}</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 24px;">
          Hello ${name},<br/><br/>
          ${message}
        </p>
        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
          <a href="${link}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 8px;">
            Open in Univo Portal →
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
        This is an automated notification from Aditya University - Univo Platform.
      </div>
    </div>
  `;

  return sendMail({
    to,
    subject: `[Univo Notification] ${title}`,
    html,
  });
}

async function sendPasswordResetOtp({ to, name = "User", otp }) {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 24px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">Password Verification Code</h1>
      </div>
      <div style="padding: 32px; text-align: center;">
        <p style="font-size: 14px; color: #334155; margin: 0 0 20px;">
          Hello ${name}, you requested to reset your password for Univo.
        </p>
        <div style="margin: 24px 0; background-color: #f5f3ff; border: 2px dashed #7c3aed; border-radius: 12px; padding: 16px;">
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #6d28d9;">${otp}</span>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 0;">
          This verification code is valid for <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.
        </p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
        Aditya University · Univo Security
      </div>
    </div>
  `;

  return sendMail({
    to,
    subject: `[Univo Security] Your verification code is ${otp}`,
    html,
  });
}

async function sendPasswordChangedConfirmation({ to, name = "User" }) {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">Password Changed Successfully</h1>
      </div>
      <div style="padding: 32px;">
        <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
          Hello ${name},<br/><br/>
          Your password for your Univo Academic Portal account has just been updated successfully.
        </p>
        <p style="font-size: 13px; color: #e11d48; margin: 0 0 20px; line-height: 1.5;">
          If you did NOT perform this change, please contact your university system administrator immediately to protect your account.
        </p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
        Aditya University · Univo Security
      </div>
    </div>
  `;

  return sendMail({
    to,
    subject: `[Univo Security] Your password was changed`,
    html,
  });
}

module.exports = {
  sendMail,
  sendNotificationEmail,
  sendPasswordResetOtp,
  sendPasswordChangedConfirmation,
};
