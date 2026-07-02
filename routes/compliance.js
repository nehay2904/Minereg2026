const express = require('express');
const router = express.Router();
const Compliance = require('../models/Compliance');
const { protect, adminOnly } = require('../middleware/auth');

// GET all compliances
router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') filter.signingAuthority = { $in: [req.user._id] };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    const compliances = await Compliance.find(filter)
      .populate('signingAuthority', 'name email dept');
    res.json(compliances);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single compliance
router.get('/:id', protect, async (req, res) => {
  try {
    const compliance = await Compliance.findById(req.params.id)
      .populate('signingAuthority', 'name email dept');
    if (!compliance) return res.status(404).json({ message: 'Not found' });
    res.json(compliance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create compliance
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const compliance = await Compliance.create(req.body);
    res.status(201).json(compliance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update compliance
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const compliance = await Compliance.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    ).populate('signingAuthority', 'name email dept');
    res.json(compliance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE compliance
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Compliance.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH update status
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'Completed') update.completedDate = new Date();
    const compliance = await Compliance.findByIdAndUpdate(
      req.params.id, update, { new: true }
    );
    res.json(compliance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH assign user(s)
router.patch('/:id/assign', protect, adminOnly, async (req, res) => {
  try {
    const { userIds } = req.body; // expects an array of user IDs
    const compliance = await Compliance.findByIdAndUpdate(
      req.params.id,
      { signingAuthority: Array.isArray(userIds) ? userIds : [] },
      { new: true }
    ).populate('signingAuthority', 'name email dept');
    res.json(compliance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;