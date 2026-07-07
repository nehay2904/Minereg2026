const express = require("express");
const router = express.Router();
const SafetyMeeting = require("../models/SafetyMeeting");
const { protect, adminOnly } = require("../middleware/auth");

// GET /api/safety-meetings — admin only (SCM page, full data)
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

// GET /api/safety-meetings/observations/mine — logged-in user's own assigned observations (Tasks page)
router.get("/observations/mine", protect, async (req, res) => {
  try {
    const meetings = await SafetyMeeting.find(
      { "observations.assignedTo": req.user._id },
      { month: 1, meetingDate: 1, status: 1, observations: 1 }
    );

    // Flatten to just the observations assigned to this user, fields directly on each item
    const myObservations = [];
    meetings.forEach((meeting) => {
      meeting.observations.forEach((obs) => {
        if (obs.assignedTo && obs.assignedTo.toString() === req.user._id.toString()) {
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
        }
      });
    });

    res.json(myObservations);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your observations" });
  }
});

// POST /api/safety-meetings — schedule a new meeting (admin only)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const meeting = await SafetyMeeting.create(req.body);
    res.status(201).json(meeting);
  } catch (err) {
    res.status(400).json({ message: "Failed to create meeting" });
  }
});

// POST /api/safety-meetings/:meetingId/observations — admin logs observation + assigns it
router.post("/:meetingId/observations", protect, adminOnly, async (req, res) => {
  try {
    const meeting = await SafetyMeeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    meeting.observations.push(req.body);
    await meeting.save();
    res.status(201).json(meeting);
  } catch (err) {
    res.status(400).json({ message: "Failed to add observation" });
  }
});

// PATCH /api/safety-meetings/:meetingId/observations/:obsId
// Admin can update anything. Assigned user can only update their own (status/solution),
// intended to be called from their Tasks page, not the SCM page.
router.patch("/:meetingId/observations/:obsId", protect, async (req, res) => {
  try {
    const meeting = await SafetyMeeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const obs = meeting.observations.id(req.params.obsId);
    if (!obs) return res.status(404).json({ message: "Observation not found" });

    const isAdmin = req.user.role === "admin";
    const isOwner = obs.assignedTo && obs.assignedTo.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to update this observation" });
    }

    // Non-admin (the assigned user) can only touch status/solution, not reassign or edit description
    if (!isAdmin) {
      const { status, solution } = req.body;
      if (status !== undefined) obs.status = status;
      if (solution !== undefined) obs.solution = solution;
    } else {
      Object.assign(obs, req.body);
    }

    if (obs.status === "Closed" && !obs.solutionSubmittedAt) {
      obs.solutionSubmittedAt = new Date();
    }

    await meeting.save();
    res.json(meeting);
  } catch (err) {
    res.status(400).json({ message: "Failed to update observation" });
  }
});

module.exports = router;
