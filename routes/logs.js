const express = require('express');
const DailyLog = require('../models/DailyLog');
const { protect } = require('../middleware/auth');
const { getTodayUTC, updateStreak, freezeAvailable } = require('../utils/streak');
const { getTodayPrompt } = require('../utils/prompts');

const router = express.Router();

// 1. Specific static GET routes
// GET /api/logs/today
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

// 2. Collection GET route
// GET /api/logs
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

// 3. Dynamic / Wildcard GET route (MUST be last for GETs)
// GET /api/logs/:date
router.get('/:date', protect, async (req, res) => {
  try {
    const log = await DailyLog.findOne({ userId: req.user._id, dateUTC: req.params.date });
    if (!log) return res.status(404).json({ message: 'No log for this date' });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/logs
router.post('/', protect, async (req, res) => {
  try {
    const { promptIndex, promptResponse, workedOn, learned, sessionRating } = req.body;
    const today = getTodayUTC();
    const user = req.user;

    if (!promptResponse || !workedOn || !learned) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (promptResponse.trim().length < 10 || workedOn.trim().length < 10 || learned.trim().length < 10) {
      return res.status(400).json({ message: 'Please write meaningful responses (at least a few words each)' });
    }

    const existingLog = await DailyLog.findOne({ userId: user._id, dateUTC: today });
    if (existingLog) {
      existingLog.promptResponse = promptResponse.trim();
      existingLog.workedOn = workedOn.trim();
      existingLog.learned = learned.trim();
      if (sessionRating) existingLog.sessionRating = sessionRating;
      await existingLog.save();
      return res.json({ log: existingLog, user: user.toJSON(), streakUpdated: false });
    }

    const log = await DailyLog.create({
      userId: user._id,
      dateUTC: today,
      promptIndex: promptIndex ?? 0,
      promptResponse: promptResponse.trim(),
      workedOn: workedOn.trim(),
      learned: learned.trim(),
      sessionRating: sessionRating || null,
    });

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

module.exports = router;