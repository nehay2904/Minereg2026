const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema({
  complianceId: { type: String },
  complianceTitle: { type: String },
  sentAt: { type: Date, default: Date.now },
  sentTo: { type: String },
  type: { type: String, enum: ['reminder', 'escalation', 'overdue'] }
}, { timestamps: true });

module.exports = mongoose.model('AlertLog', alertLogSchema);
