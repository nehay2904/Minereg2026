const cron = require("node-cron");
const nodemailer = require("nodemailer");
const Compliance = require("../models/Compliance");
const AlertLog = require("../models/AlertLog");
const User = require("../models/User");

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

const getEmailHTML = (compliance, type, assignedName) => {
  const color =
    type === "overdue" ? "#E24B4A" : type === "due" ? "#EF9F27" : "#1a73e8";
  const label =
    type === "overdue"
      ? "🔴 OVERDUE"
      : type === "due"
        ? "📅 DUE TODAY"
        : "🔔 REMINDER";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background: #1a73e8; padding: 24px; text-align: center;">
        <h2 style="color: white; margin: 0;">CompliTrack</h2>
        <p style="color: #e8f0fe; margin: 4px 0 0; font-size: 13px;">JPL Mines — Compliance Alert</p>
      </div>
      <div style="padding: 24px; background: #fff;">
        <div style="background: ${color}15; border-left: 4px solid ${color}; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
          <strong style="color: ${color}; font-size: 16px;">${label}</strong>
        </div>
        <p style="color: #333; font-size: 14px;">Dear <strong>${assignedName}</strong>,</p>
        <p style="color: #555; font-size: 14px;">You have a compliance task that requires your attention:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 16px;">
          <tr>
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Title</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.title}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Act</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.act || "—"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Due Date</td>
            <td style="padding: 10px; color: ${color}; font-weight: bold; border: 1px solid #e0e0e0;">${compliance.dueDate}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Submission Authority</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.submissionAuthority || "—"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Format</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.driveLink ? `<a href="${compliance.driveLink}" style="color: #1a73e8;">View Document</a>` : "—"}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Status</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.status}</td>
          </tr>
        </table>
        <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 4px; text-align: center;">
          <p style="margin: 0; font-size: 13px; color: #666;">Please log in to CompliTrack to update the status of this compliance.</p>
          <div style="text-align: center; margin-top: 16px;">
            <a href="${process.env.APP_URL}"
               style="display: inline-block; padding: 12px 32px; background: #1a73e8; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold;">
              Open CompliTrack →
            </a>
          </div>
        </div>
      </div>
      <div style="background: #f1f3f4; padding: 12px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #999;">This is an automated alert from CompliTrack | JPL Mines</p>
      </div>
    </div>
  `;
};

// Safely reduce a Date object or "YYYY-MM-DD" string to a plain YYYY-MM-DD string.
// Never uses local-timezone getters, so server TZ can't silently shift the calendar day.
const toDateOnly = (d) => {
  if (typeof d === "string") return d.slice(0, 10); // already "2026-07-10..."
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
};

// "Today" as seen in IST, regardless of what timezone the server itself runs in
const getTodayISTStr = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // en-CA = YYYY-MM-DD

// Exact whole-day difference between two YYYY-MM-DD strings
const daysBetween = (fromStr, toStr) => {
  const d1 = new Date(fromStr + "T00:00:00Z");
  const d2 = new Date(toStr + "T00:00:00Z");
  return Math.round((d2 - d1) / 86400000);
};

const runAlertJob = async () => {
  console.log("Running alert job:", new Date().toISOString());
  try {
    const todayStr = getTodayISTStr();
    const todayStart = new Date(todayStr + "T00:00:00+05:30");
    const todayEnd = new Date(todayStr + "T23:59:59+05:30");

    const admins = await User.find({ role: "admin" }).select("email name");
    const adminEmail = admins.map((a) => a.email).join(",");

    const compliances = await Compliance.find({
      status: { $ne: "Completed" },
      type: { $in: ["recurring", "event"] },
    }).populate("signingAuthority", "email name");

    let sentCount = 0;

    for (const compliance of compliances) {
      const alreadyAlerted = await AlertLog.findOne({
        complianceId: compliance.complianceId,
        sentAt: { $gte: todayStart, $lte: todayEnd },
      });
      if (alreadyAlerted) continue;

      console.log(
        "Checking compliance:",
        compliance.complianceId,
        "| signingAuthority:",
        compliance.signingAuthority,
        "| status:",
        compliance.status,
      );

      const assignedAuthorities = Array.isArray(compliance.signingAuthority)
        ? compliance.signingAuthority
        : [];
      const assignedEmail = assignedAuthorities.length
        ? assignedAuthorities.map((u) => u.email).filter(Boolean).join(",")
        : adminEmail;
      const assignedName = assignedAuthorities.length
        ? assignedAuthorities.map((u) => u.name).filter(Boolean).join(", ")
        : "Admin";

      const dueDateStr = compliance.dueDate
        ? toDateOnly(compliance.dueDate)
        : null;
      const alertDateStr = compliance.alertDate
        ? toDateOnly(compliance.alertDate)
        : null;
      const isValidDue =
        dueDateStr && !isNaN(new Date(dueDateStr).getTime());
      const isValidAlert =
        alertDateStr && !isNaN(new Date(alertDateStr).getTime());

      let type = null;

      if (isValidDue && todayStr > dueDateStr) {
        type = "overdue";
      } else if (isValidDue && todayStr === dueDateStr) {
        type = "due";
      } else if (isValidAlert && todayStr >= alertDateStr) {
        const daysSinceAlert = daysBetween(alertDateStr, todayStr);
        if (daysSinceAlert % 3 === 0) {
          type = "reminder"; // fires on alertDate itself, then every 3rd day (3, 6, 9...)
        }
      }

      if (!type) continue;

      const subject =
        type === "overdue"
          ? `🔴 OVERDUE:  ${compliance.title}`
          : type === "due"
            ? `📅 DUE TODAY:  ${compliance.title}`
            : `🔔 REMINDER:   ${compliance.title}`;

      try {
        await transporter.sendMail({
          from: `"CompliTrack JPL Mines" <${process.env.EMAIL_USER}>`,
          to: assignedEmail,
          cc: [process.env.MINES_AGENT_EMAIL, process.env.MINES_MANAGER_EMAIL]
            .filter(Boolean)
            .join(","),
          subject,
          html: getEmailHTML(compliance, type, assignedName),
        });
        console.log(
          `Email sent to ${assignedEmail}, CC: Mines Agent & Manager: ${subject}`,
        );
        await AlertLog.create({
          complianceId: compliance.complianceId,
          complianceTitle: compliance.title,
          sentTo: assignedEmail,
          type: type === "due" ? "escalation" : type,
        });
        sentCount++;
      } catch (emailErr) {
        console.error(`Email failed to ${assignedEmail}:`, emailErr.message);
      }
    }

    console.log(`Alert job done — Emails sent: ${sentCount}`);
  } catch (err) {
    console.error("Alert job error:", err.message);
  }
};

// Runs every day at 11:04 AM IST
cron.schedule("00 11 * * *", runAlertJob, {
  timezone: "Asia/Kolkata",
});

module.exports = { runAlertJob };