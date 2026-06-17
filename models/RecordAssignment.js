const mongoose = require('mongoose');

const recordAssignmentSchema = new mongoose.Schema({
  recordId: { type: String, required: true },
  recordTitle: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['Pending', 'Reviewed'], default: 'Pending' },
  reviewedDate: { type: Date, default: null },
  proofs: [{
    fileName: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

recordAssignmentSchema.index({ recordId: 1, assignedTo: 1 }, { unique: true });

module.exports = mongoose.model('RecordAssignment', recordAssignmentSchema);
