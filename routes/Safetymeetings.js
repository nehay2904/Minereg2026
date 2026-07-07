const express = require("express");
const router = express.Router();
const SafetyMeeting = require("../models/SafetyMeeting");
const { protect, adminOnly } = require("../middleware/auth");

// GET /api/safety-meetings/observations/mine
// Any logged-in user — flattened list of observations assigned to them,
// for their Tasks page. NOT the SCM page (that's admin-only below).
// NOTE: this route must be declared before "/:meetingId..." routes so
// Express doesn't try to treat "observations" as a meetingId.
router.get("/observations/mine", protect, async (req, res) => {
  try {
    const meetings = await SafetyMeeting.find({
      "observations.assignedTo": req.user._id,
    }).select("month meetingDate observations");

    const myObservations = [];
    meetings.forEach((meeting) => {
      meeting.observations
        .filter((obs) => obs.assignedTo?.toString() === req.user._id.toString())
        .forEach((obs) => {
          myObservations.push({
            _id: obs._id,
            meetingId: meeting._id,
            month: meeting.month,
            meetingDate: meeting.meetingDate,
            description: obs.description,
            location: obs.location,
            severity: obs.severity,
            targetDate: obs.targetDate,
            status: obs.status,
            solution: obs.solution,
            solutionSubmittedAt: obs.solutionSubmittedAt,
          });
        });
    });

    res.json(myObservations);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your tasks" });
  }
});

// GET /api/safety-meetings — SCM page, admin only
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const meetings = await SafetyMeeting.find()
      .sort({ meetingDate: -1 })
      .populate("observations.assignedTo", "name email dept");
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch meetings" });
  }
});

// GET /api/safety-meetings/:meetingId — single meeting, admin only
router.get("/:meetingId", protect, adminOnly, async (req, res) => {
  try {
    const meeting = await SafetyMeeting.findById(req.params.meetingId)
      .populate("observations.assignedTo", "name email dept");
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch meeting" });
  }
});

// POST /api/safety-meetings — schedule a new meeting, admin only
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const meeting = await SafetyMeeting.create(req.body);
    res.status(201).json(meeting);
  } catch (err) {
    res.status(400).json({ message: "Failed to create meeting" });
  }
});

// POST /api/safety-meetings/:meetingId/observations — admin logs + assigns an observation
router.post("/:meetingId/observations", protect, adminOnly, async (req, res) => {
  try {
    const meeting = await SafetyMeeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    meeting.observations.push(req.body);
    await meeting.save();
    const populated = await meeting.populate("observations.assignedTo", "name email dept");
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: "Failed to add observation" });
  }
});

// PATCH /api/safety-meetings/:meetingId/observations/:obsId
// Admin: can edit anything (reassign, edit description, close, etc.)
// Assigned user: can ONLY update status + solution, and only on their own observation
router.patch("/:meetingId/observations/:obsId", protect, async (req, res) => {
  try {
    const meeting = await SafetyMeeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const obs = meeting.observations.id(req.params.obsId);
    if (!obs) return res.status(404).json({ message: "Observation not found" });

    const isAdmin = req.user.role === "admin";
    const isOwner = obs.assignedTo?.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to update this observation" });
    }

    let updates = req.body;
    if (!isAdmin) {
      // Non-admin (assigned user) may only touch status + solution
      const { status, solution } = req.body;
      updates = {};
      if (status !== undefined) updates.status = status;
      if (solution !== undefined) updates.solution = solution;
    }

    Object.assign(obs, updates);
    if (updates.status === "Closed" && !obs.solutionSubmittedAt) {
      obs.solutionSubmittedAt = new Date();
    }

    await meeting.save();
    const populated = await meeting.populate("observations.assignedTo", "name email dept");
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update observation" });
  }
});

module.exports = router;