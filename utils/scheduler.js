const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Compliance = require('../models/Compliance');
const AlertLog = require('../models/AlertLog');
const User = require('../models/User');

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);


const getEmailHTML = (compliance, type, assignedName) => {
  const color = type === 'overdue' ? '#E24B4A' : type === 'due' ? '#EF9F27' : '#1a73e8';
  const label = type === 'overdue' ? '🔴 OVERDUE' : type === 'due' ? '📅 DUE TODAY' : '🔔 REMINDER';
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
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; color: #666; width: 40%; border: 1px solid #e0e0e0;">Compliance ID</td>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #e0e0e0;">${compliance.complianceId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Title</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.title}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Act</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.act || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Due Date</td>
            <td style="padding: 10px; color: ${color}; font-weight: bold; border: 1px solid #e0e0e0;">${compliance.dueDate}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Submission Authority</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.submissionAuthority || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; color: #666; border: 1px solid #e0e0e0;">Status</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0;">${compliance.status}</td>
          </tr>
        </table>
        <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 4px; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #666;">Please log in to CompliTrack to update the status of this compliance.</p>
<div style="text-align: center; margin-top: 16px;">
  <a href="${process.env.APP_URL}/login"
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

const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const runAlertJob = async () => {
  console.log('Running alert job:', new Date().toISOString());
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const admins = await User.find({ role: 'admin' }).select('email name');
    const adminEmail = admins.map(a => a.email).join(',');

    const compliances = await Compliance.find({
      status: { $ne: 'Completed' },
      type: { $in: ['recurring', 'event'] }
    }).populate('signingAuthority', 'email name');

    let sentCount = 0;

    for (const compliance of compliances) {
      const alreadyAlerted = await AlertLog.findOne({
        complianceId: compliance.complianceId,
        sentAt: { $gte: today, $lte: todayEnd }
      });
      if (alreadyAlerted) continue;

      const assignedEmail = compliance.signingAuthority?.email || adminEmail;
      const assignedName = compliance.signingAuthority?.name || 'Admin';

      const dueDate = new Date(compliance.dueDate);
      const alertDate = new Date(compliance.alertDate);
      const isValidDue = !isNaN(dueDate.getTime());
      const isValidAlert = !isNaN(alertDate.getTime());

      let type = null;
      if (isValidDue && today > dueDate && !isSameDay(today, dueDate)) {
        type = 'overdue';
      } else if (isValidDue && isSameDay(today, dueDate)) {
        type = 'due';
      } else if (isValidAlert && isSameDay(today, alertDate)) {
        type = 'reminder';
      }

      if (!type) continue;

      const subject =
        type === 'overdue' ? `🔴 OVERDUE: ${compliance.complianceId} — ${compliance.title}` :
        type === 'due' ? `📅 DUE TODAY: ${compliance.complianceId} — ${compliance.title}` :
        `🔔 REMINDER: ${compliance.complianceId} — ${compliance.title}`;

      try {
        await resend.emails.send({
  from: 'CompliTrack <onboarding@resend.dev>',
  to: assignedEmail,
  subject,
  html: getEmailHTML(compliance, type, assignedName)
});
        console.log(`Email sent to ${assignedEmail}: ${subject}`);
        await AlertLog.create({
          complianceId: compliance.complianceId,
          complianceTitle: compliance.title,
          sentTo: assignedEmail,
          type: type === 'due' ? 'escalation' : type
        });
        sentCount++;
      } catch (emailErr) {
        console.error(`Email failed to ${assignedEmail}:`, emailErr.message);
      }
    }

    console.log(`Alert job done — Emails sent: ${sentCount}`);
  } catch (err) {
    console.error('Alert job error:', err.message);
  }
};

// Runs every day at 10:00 AM IST
cron.schedule('49 11 * * *', runAlertJob, {
  timezone: 'Asia/Kolkata'
});

 runAlertJob() 
module.exports = { runAlertJob };

