const mongoose = require("mongoose");

// One observation raised at a meeting. "Overdue" is not stored — the
// frontend derives it from targetDate + status, same pattern used for
// compliance task overdue logic elsewhere in the app.
const observationSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    location: { type: String },
    severity: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    raisedBy: { type: String },
    targetDate: { type: Date },
    status: { type: String, enum: ["Pending", "Closed"], default: "Pending" },
    solution: { type: String, default: "" },
    solutionSubmittedAt: { type: Date },
  },
  { timestamps: true },
);

const safetyMeetingSchema = new mongoose.Schema(
  {
    month: { type: String, required: true }, // e.g. "August 2026"
    meetingDate: { type: Date, required: true },
    status: { type: String, enum: ["Scheduled", "Held"], default: "Scheduled" },
    chairperson: { type: String },
    attendees: [{ type: String }],
    observations: [observationSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("SafetyMeeting", safetyMeetingSchema);
