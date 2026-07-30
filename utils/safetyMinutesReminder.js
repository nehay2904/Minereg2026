const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

// ---- CONFIG: adjust these ----
const SAFETY_OFFICER_EMAIL = "neha.yednurwar@jindalpower.com";
const MEETING_DAY_OF_MONTH = 18;          // day the SCM is held
const FOLLOWUP_OFFSET_DAYS = 1;           // send follow-up this many days after the meeting
const UPLOAD_LINK = process.env.MINUTES_UPLOAD_LINK || "https://complitrack.netlify.app";
// ------------------------------

// OAuth2 transporter (same setup as your existing alert crons)
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

async function createTransporter() {
  const accessToken = await oAuth2Client.getAccessToken();
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_USER,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN,
      accessToken,
    },
  });
}

// IST-safe "today" (matches your alertJob.js date handling)
function istNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

// The date the meeting was held (this month, on MEETING_DAY_OF_MONTH)
function meetingHeldDate() {
  const now = istNow();
  return new Date(now.getFullYear(), now.getMonth(), MEETING_DAY_OF_MONTH);
}

function formatDate(d) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  }); // -> "18 July 2026"
}

async function sendMinutesReminder() {
  const now = istNow();
  const held = meetingHeldDate();
  const followupDay = held.getDate() + FOLLOWUP_OFFSET_DAYS;

  // fire only on the follow-up day
  if (now.getDate() !== followupDay) return;

  const transporter = await createTransporter();
  const heldStr = formatDate(held);

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: SAFETY_OFFICER_EMAIL,
    subject: `Action Required: Upload Minutes & Recommendations — SCM held on ${heldStr}`,
    html: `
      <p>Dear Sir,</p>
      <p>The Safety Committee Meeting held on <b>${heldStr}</b> has concluded.</p>
      <p>You are requested to upload the <b>Minutes of Meeting</b> and the
      <b>Recommendations</b> of the said meeting. </p>
      <p>Regards,<br/>ComplITrack — JPL Mines</p>
    `,
  });

  console.log(`Minutes reminder sent to safety officer for SCM held on ${heldStr}`);
}

// Runs daily at 17:00 AM IST; the date check inside gates the actual send
cron.schedule("00 17 * * *", sendMinutesReminder, { timezone: "Asia/Kolkata" });

module.exports = { sendMinutesReminder };