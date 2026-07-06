const express = require("express");
const router = express.Router();
const SafetyMeeting = require("../models/SafetyMeeting");

// GET /api/safety-meetings — most recent meeting first
router.get("/", async (req, res) => {
  try {
    const meetings = await SafetyMeeting.find().sort({ meetingDate: -1 });
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch meetings" });
  }
});

// POST /api/safety-meetings — schedule a new meeting
router.post("/", async (req, res) => {
  try {
    const meeting = await SafetyMeeting.create(req.body);
    res.status(201).json(meeting);
  } catch (err) {
    res.status(400).json({ message: "Failed to create meeting" });
  }
});

// POST /api/safety-meetings/:meetingId/observations — safety officer logs an observation
router.post("/:meetingId/observations", async (req, res) => {
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

// PATCH /api/safety-meetings/:meetingId/observations/:obsId — responsible authority submits solution / updates status
router.patch("/:meetingId/observations/:obsId", async (req, res) => {
  try {
    const meeting = await SafetyMeeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const obs = meeting.observations.id(req.params.obsId);
    if (!obs) return res.status(404).json({ message: "Observation not found" });

    Object.assign(obs, req.body);
    if (req.body.status === "Closed" && !obs.solutionSubmittedAt) {
      obs.solutionSubmittedAt = new Date();
    }

    await meeting.save();
    res.json(meeting);
  } catch (err) {
    res.status(400).json({ message: "Failed to update observation" });
  }
});

module.exports = router;
