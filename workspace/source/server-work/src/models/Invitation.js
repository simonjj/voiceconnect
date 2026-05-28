const mongoose = require('mongoose');
const shortid = require('shortid');
const { Schema } = mongoose;

const InvitationSchema = new Schema({
    receiver: {
        type: String,
        required: true
    },
    sender: {
        type: String,
        required: true
    },
    sentDate: {
        type: Date,
        default: Date.now
    },
    isAccepted: {
        type: Boolean,
        default: false
    },
    acceptanceCode: {
        type: String,
        unique: true,
        default: shortid.generate
    },
    message: {
        type: String
    }
});

module.exports = mongoose.model('Invitation', InvitationSchema);
