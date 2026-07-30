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

// Safety Officer — recipient for minutes/recommendations upload
const TO_RECIPIENTS = [
  "ssharma@jindalpower.com"
].join(",");

const CC_RECIPIENTS = [
  "sanjeev.dubey@jindalpower.com",
  "govind.kumar@jindalpower.com",
].join(",");

// Meeting-specific details (update per month's meeting)
const meetingDetails = {
  mineName: "Gare Palma IV/2&3 Coal Mine",
  meetingDate: "18.07.2026",
  uploadLink: "https://complitrack.netlify.app",
};

const getEmailHTML = (details) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
    <div style="background: #1a73e8; padding: 24px; text-align: center;">
      <h2 style="color: white; margin: 0;">CompliTrack</h2>
      <p style="color: #e8f0fe; margin: 4px 0 0; font-size: 13px;">JPL Mines — Safety Committee Meeting</p>
    </div>
    <div style="padding: 24px; background: #fff;">
      <p style="color: #333; font-size: 14px;">Dear Sir,</p>
      <p style="color: #555; font-size: 14px;">
        The Safety Committee Meeting for the <strong>${details.mineName}</strong>, held on
        <strong>${details.meetingDate}</strong>, has concluded.
      </p>
      <p style="color: #555; font-size: 14px;">
        You are requested to upload the <strong>Minutes of Meeting</strong> and the
        <strong>Recommendations</strong> of the said meeting. 
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${details.uploadLink}" style="background: #1a73e8; color: white; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; display: inline-block;">
          Upload Minutes & Recommendations
        </a>
      </div>
    </div>
    <div style="background: #f1f3f4; padding: 12px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #999;">This is an automated reminder from CompliTrack | JPL Mines</p>
    </div>
  </div>
`;

const sendMinutesReminder = async () => {
  try {
    await transporter.sendMail({
      from: `"CompliTrack" <${process.env.EMAIL_USER}>`,
      to: TO_RECIPIENTS,
      cc: CC_RECIPIENTS,
      subject: `Upload Minutes of meeting & Recommendations — Safety Committee Meeting held on ${meetingDetails.meetingDate}`,
      html: getEmailHTML(meetingDetails),
    });
    console.log(`Minutes reminder sent for SCM held on ${meetingDetails.meetingDate}`);
  } catch (err) {
    console.error("Failed to send minutes reminder:", err.message);
  }
};

// Runs on the 19th of every month, 9:00 AM IST (day after the meeting)
cron.schedule("0 9 19 * *", sendMinutesReminder, { timezone: "Asia/Kolkata" });

module.exports = { sendMinutesReminder };