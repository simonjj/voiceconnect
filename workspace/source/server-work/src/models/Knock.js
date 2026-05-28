const mongoose = require('mongoose');

const KnockSchema = new mongoose.Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    member: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    team: {
        type: mongoose.Types.ObjectId,
        ref: 'Team'
    },
    active: { type: Boolean, default: true },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
KnockSchema.index({ createdAt: 1 }, { expireAfterSeconds: 10 });

module.exports = mongoose.model('Knock', KnockSchema);
