const mongoose = require('mongoose');

const complianceSchema = new mongoose.Schema({
  complianceId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['recurring', 'event'], required: true },
  act: { type: String },
  title: { type: String, required: true },
  detail: { type: String },
  recurrence: { type: String },
  signingAuthority: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submissionAuthority: { type: String },
  dueDate: { type: String },
  alertDate: { type: String },
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  completedDate: { type: Date, default: null },
  driveLink: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Compliance', complianceSchema);