const cron = require("node-cron");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
});

const SAFETY_ALERT_EMAIL = "neha.yednurwar@jindalpower.com";

const getCurrentMonthIST = () =>
  new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

const getEmailHTML = (monthLabel) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
    <div style="background: #1a73e8; padding: 24px; text-align: center;">
      <h2 style="color: white; margin: 0;">CompliTrack</h2>
      <p style="color: #e8f0fe; margin: 4px 0 0; font-size: 13px;">JPL Mines — Safety Committee Meeting</p>
    </div>
    <div style="padding: 24px; background: #fff;">
      <p style="color: #333; font-size: 14px;">Dear Team,</p>
      <p style="color: #555; font-size: 14px;">
        The Safety Committee Meeting for <strong>${monthLabel}</strong> is scheduled as follows:
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 16px;">
        <tr>
          <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Date</td>
          <td style="padding: 10px; border: 1px solid #e0e0e0;">11th ${monthLabel}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Time</td>
          <td style="padding: 10px; border: 1px solid #e0e0e0;">4:00 PM</td>
        </tr>
        <tr>
          <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Venue</td>
          <td style="padding: 10px; border: 1px solid #e0e0e0;">CHP Conference Hall</td>
        </tr>
      </table>
    </div>
    <div style="background: #f1f3f4; padding: 12px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #999;">This is an automated reminder from CompliTrack | JPL Mines</p>
    </div>
  </div>
`;

const sendSafetyMeetingReminder = async () => {
  const monthLabel = getCurrentMonthIST();
  try {
    await transporter.sendMail({
      from: `"CompliTrack" <${process.env.EMAIL_USER}>`,
      to: SAFETY_ALERT_EMAIL,
      subject: `Safety Committee Meeting Scheduled — ${monthLabel}`,
      html: getEmailHTML(monthLabel),
    });
    console.log(`Safety committee reminder sent for ${monthLabel}`);
  } catch (err) {
    console.error("Failed to send safety committee reminder:", err.message);
  }
};

// Runs on the 10th of every month, 9:00 AM IST
cron.schedule("0 9 10 * *", sendSafetyMeetingReminder, { timezone: "Asia/Kolkata" });

module.exports = { sendSafetyMeetingReminder };