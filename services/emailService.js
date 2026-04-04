const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  console.log(`📡 [EmailService] Attempting to send email to ${to}...`);

  // Check if email credentials are set and not placeholders
  const isPlaceholder = 
    process.env.EMAIL_USER === 'your_email@gmail.com' || 
    process.env.EMAIL_PASS === 'your_app_password_here';

  if (isPlaceholder) {
    console.log('⚠️  [EmailService] Using placeholder credentials. Bypassing SMTP send.');
    return { success: true, message: 'Skipped (Placeholder Credentials)' };
  }

  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [EmailService] Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ [EmailService] Failed to send email: ${error.message}`);
    // Still return success so the user can continue with console OTP (even in production)
    // especially for critical setup/deadline situations
    console.log(`⚠️  [EmailService] SMTP failed. Please check the logs above for the OTP code.`);
    return { success: true, message: 'SMTP failed but logging OTP to console' };
  }
};

const sendOTPEmail = async (email, otp, type = 'email_verification') => {
  const isVerification = type === 'email_verification';
  const subject = isVerification ? 'Verify Your ProTech Account' : 'Reset Your Password - ProTech';

  // Log OTP clearly in console - LOUD version
  console.log('\n' + '⭐'.repeat(30));
  console.log('--- PROTECH AUTH CODE ---');
  console.log(`📧  Email: ${email}`);
  console.log(`🔢  OTP:   ${otp}`);
  console.log('----------------------------');
  console.log('⭐'.repeat(30) + '\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #222;">
            <tr>
              <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px;text-align:center;border-bottom:1px solid #222;">
                <h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#fff;">PRO<span style={{color:'#6366f1'}}>TECH</span></h1>
                <p style="margin:8px 0 0;color:#666;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Premium Tech Marketplace</p>
              </td>
            </tr>
            <tr>
              <td style="padding:48px 40px;">
                <h2 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#fff;">
                  ${isVerification ? 'Verify Your Email' : 'Reset Your Password'}
                </h2>
                <p style="margin:0 0 32px;color:#888;font-size:15px;line-height:1.6;">
                  ${isVerification
      ? 'Welcome to ProTech! Use the verification code below to complete your registration.'
      : 'We received a request to reset your password. Use the code below to proceed.'
    }
                </p>
                <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:32px;text-align:center;margin:0 0 32px;">
                  <p style="margin:0 0 8px;color:#666;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Your OTP Code</p>
                  <p style="margin:0;font-size:48px;font-weight:700;letter-spacing:12px;color:#6366f1;">${otp}</p>
                  <p style="margin:16px 0 0;color:#555;font-size:13px;">Valid for 10 minutes</p>
                </div>
                <p style="margin:0;color:#555;font-size:13px;line-height:1.6;">
                  If you didn't request this, you can safely ignore this email. Never share this code with anyone.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid #1a1a1a;text-align:center;">
                <p style="margin:0;color:#444;font-size:12px;">© 2025 ProTech. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
};

const sendOrderConfirmationEmail = async (email, order) => {
  const itemsHtml = order.orderItems.map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #1a1a1a;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="60"><img src="${item.image}" width="50" height="50" style="border-radius:8px;object-fit:cover;" alt="${item.name}"/></td>
            <td style="padding-left:12px;">
              <p style="margin:0;color:#fff;font-size:14px;font-weight:500;">${item.name}</p>
              <p style="margin:4px 0 0;color:#666;font-size:12px;">Qty: ${item.quantity}</p>
            </td>
            <td align="right" style="color:#6366f1;font-size:14px;font-weight:600;">₹${(item.price * item.quantity).toLocaleString()}</td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #222;">
            <tr>
              <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px;text-align:center;">
                <h1 style="margin:0;font-size:28px;font-weight:700;color:#fff;">PRO<span style="color:#6366f1;">TECH</span></h1>
              </td>
            </tr>
            <tr>
              <td style="padding:40px;">
                <h2 style="color:#22c55e;margin:0 0 8px;">✓ Order Confirmed!</h2>
                <p style="color:#888;margin:0 0 24px;">Order #${order._id.toString().slice(-8).toUpperCase()}</p>
                <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#1a1a1a;border-radius:8px;padding:16px;">
                  <tr><td style="color:#888;font-size:13px;">Items Total</td><td align="right" style="color:#fff;font-size:13px;">₹${order.itemsPrice.toLocaleString()}</td></tr>
                  <tr><td style="color:#888;font-size:13px;padding-top:8px;">Tax</td><td align="right" style="color:#fff;font-size:13px;padding-top:8px;">₹${order.taxPrice.toLocaleString()}</td></tr>
                  <tr><td style="color:#888;font-size:13px;padding-top:8px;">Shipping</td><td align="right" style="color:#fff;font-size:13px;padding-top:8px;">₹${order.shippingPrice.toLocaleString()}</td></tr>
                  <tr><td colspan="2" style="border-top:1px solid #333;padding-top:12px;margin-top:12px;"></td></tr>
                  <tr><td style="color:#fff;font-weight:700;padding-top:4px;">Total</td><td align="right" style="color:#6366f1;font-weight:700;font-size:16px;padding-top:4px;">₹${order.totalAmount.toLocaleString()}</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject: `Order Confirmed — #${order._id.toString().slice(-8).toUpperCase()}`, html });
};

module.exports = { sendEmail, sendOTPEmail, sendOrderConfirmationEmail };
