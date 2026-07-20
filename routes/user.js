const express = require('express');
const { protect } = require('../middleware/auth');
const { freezeAvailable } = require('../utils/streak');

const router = express.Router();

// GET /api/user/me
router.get('/me', protect, (req, res) => {
  const user = req.user;
  res.json({
    user: {
      ...user.toJSON(),
      freezeAvailable: freezeAvailable(user),
    },
  });
});

// PATCH /api/user/me
router.patch('/me', protect, async (req, res) => {
  try {
    const { name, domain } = req.body;
    const user = req.user;

    if (name) user.name = name.trim();
    if (domain) user.domain = domain.trim();

    await user.save();
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
