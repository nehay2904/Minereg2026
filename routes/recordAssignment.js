const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const RecordAssignment = require('../models/RecordAssignment');
const { protect, adminOnly } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// GET all assignments (admin only) - to populate the admin assign UI
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const assignments = await RecordAssignment.find()
      .populate('assignedTo', 'name email dept');
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET my assigned records (logged-in user)
router.get('/mine', protect, async (req, res) => {
  try {
    const assignments = await RecordAssignment.find({ assignedTo: req.user._id });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST assign a record to multiple users (admin only)
router.post('/assign', protect, adminOnly, async (req, res) => {
  try {
    const { recordId, recordTitle, userIds } = req.body;
    const results = [];
    for (const userId of userIds) {
      const assignment = await RecordAssignment.findOneAndUpdate(
        { recordId, assignedTo: userId },
        { recordId, recordTitle, assignedTo: userId },
        { upsert: true, new: true }
      );
      results.push(assignment);
    }
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE unassign a record from a user (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await RecordAssignment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Unassigned' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH mark as reviewed (the assigned user themself)
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'Reviewed') update.reviewedDate = new Date();
    const assignment = await RecordAssignment.findByIdAndUpdate(
      req.params.id, update, { new: true }
    );
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST upload weekly proof (the assigned user)
router.post('/:id/upload', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const assignment = await RecordAssignment.findByIdAndUpdate(
      req.params.id,
      { $push: { proofs: { fileName: req.file.filename } } },
      { new: true }
    );
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;