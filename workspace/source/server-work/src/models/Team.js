const shortid = require('shortid');
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const TeamSchema = new Schema({
    name: String,
    code: {
        type: String,
        default: shortid.generate,
        unique: true
    },
    members: [
        {
            type: Types.ObjectId,
            ref: 'User'
        }
    ],
    owner: {
        type: Types.ObjectId,
        ref: 'User'
    },
    admins: [
        {
            type: Types.ObjectId,
            ref: 'User'
        }
    ],
    isPrivate: {
        type: Boolean,
        default: false
    },
    invitedMembers: [
        {
            type: Types.ObjectId,
            ref: 'User'
        }
    ]
});

module.exports = mongoose.model('Team', TeamSchema);
