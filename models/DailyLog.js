const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dateUTC: { type: String, required: true }, // YYYY-MM-DD
    promptIndex: { type: Number, required: true },
    promptResponse: { type: String, required: true, trim: true },
    workedOn: { type: String, required: true, trim: true },
    learned: { type: String, required: true, trim: true },
    sessionRating: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true }
);

// Enforce one log per user per day at DB level
dailyLogSchema.index({ userId: 1, dateUTC: 1 }, { unique: true });

module.exports = mongoose.model('DailyLog', dailyLogSchema);
