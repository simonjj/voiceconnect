const shortid = require('shortid');
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ConversationSchema = new Schema({
    code: {
        type: String,
        default: shortid.generate
    },
    team: {
        type: Types.ObjectId,
        ref: 'Team'
    },
    private: {
        type: Boolean,
        default: false
    },
    isBroadcast: {
        type: Boolean,
        default: false
    },
    members: [
        {
            type: Types.ObjectId,
            ref: 'User'
        }
    ]
});

module.exports = mongoose.model('Conversation', ConversationSchema);
