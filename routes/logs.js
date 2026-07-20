const express = require('express');
const DailyLog = require('../models/DailyLog');
const { protect } = require('../middleware/auth');
const { getTodayUTC, updateStreak, freezeAvailable } = require('../utils/streak');
const { getTodayPrompt } = require('../utils/prompts');

const router = express.Router();

// GET /api/logs/today
// Returns today's prompt + whether user has already logged today
router.get('/today', protect, async (req, res) => {
  try {
    const today = getTodayUTC();
    const prompt = getTodayPrompt();
    const existingLog = await DailyLog.findOne({ userId: req.user._id, dateUTC: today });

    res.json({
      today,
      prompt,
      alreadyLogged: !!existingLog,
      log: existingLog || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/logs
// Submit today's log and update streak
router.post('/', protect, async (req, res) => {
  try {
    const { promptIndex, promptResponse, workedOn, learned, sessionRating } = req.body;
    const today = getTodayUTC();
    const user = req.user;

    // Validate required fields
    if (!promptResponse || !workedOn || !learned) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (promptResponse.trim().length < 10 || workedOn.trim().length < 10 || learned.trim().length < 10) {
      return res.status(400).json({ message: 'Please write meaningful responses (at least a few words each)' });
    }

    // Check for existing log today
    const existingLog = await DailyLog.findOne({ userId: user._id, dateUTC: today });
    if (existingLog) {
      // Allow editing the same day — update the log but don't re-increment streak
      existingLog.promptResponse = promptResponse.trim();
      existingLog.workedOn = workedOn.trim();
      existingLog.learned = learned.trim();
      if (sessionRating) existingLog.sessionRating = sessionRating;
      await existingLog.save();
      return res.json({ log: existingLog, user: user.toJSON(), streakUpdated: false });
    }

    // Create the log
    const log = await DailyLog.create({
      userId: user._id,
      dateUTC: today,
      promptIndex: promptIndex ?? 0,
      promptResponse: promptResponse.trim(),
      workedOn: workedOn.trim(),
      learned: learned.trim(),
      sessionRating: sessionRating || null,
    });

    // Update streak
    updateStreak(user);
    await user.save();

    res.status(201).json({
      log,
      user: {
        ...user.toJSON(),
        freezeAvailable: freezeAvailable(user),
      },
      streakUpdated: true,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Already logged today' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/logs
// Get log history for heatmap and history page
router.get('/', protect, async (req, res) => {
  try {
    const { limit = 90 } = req.query;
    const logs = await DailyLog.find({ userId: req.user._id })
      .sort({ dateUTC: -1 })
      .limit(Number(limit));

    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/logs/:date — get a specific date's log
router.get('/:date', protect, async (req, res) => {
  try {
    const log = await DailyLog.findOne({ userId: req.user._id, dateUTC: req.params.date });
    if (!log) return res.status(404).json({ message: 'No log for this date' });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/logs/today-count
router.get('/today-count', async (req, res) => {
  try {
    const today = getTodayUTC();
    const count = await DailyLog.countDocuments({ dateUTC: today });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
