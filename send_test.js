require('dotenv').config();
const { sendOTPEmail } = require('./services/emailService');

(async () => {
  try {
    console.log('Sending test email...');
    await sendOTPEmail('karthikraj9000@gmail.com', '123456', 'email_verification');
    console.log('Test email sent successfully!');
  } catch (error) {
    console.error('Test email failed:', error.message);
  }
})();
