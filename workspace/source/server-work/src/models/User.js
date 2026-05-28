const shortid = require('shortid');
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const UserSchema = new Schema(
    {
        initials: {
            type: String,
            trim: true,
            default: null
        },
        email: {
            type: String,
            unique: true
        },
        firstName: {
            type: String,
            trim: true
        },
        lastName: {
            type: String,
            trim: true
        },
        source: {
            type: Object,
            select: false
        },
        orgCompany: {
            type: String
        },
        department: {
            type: String
        },
        team: {
            type: Types.ObjectId,
            ref: 'Team'
        },
        active: Boolean,
        doorOpen: {
            type: Boolean,
            default: true
        },
        firstVisit: {
            type: Boolean,
            default: true
        },
        defaultDoor: {
            type: Boolean,
            default: null
        },
        isKnockRequired: {
            type: Boolean,
            default: false
        },
        avatarColor: {
            type: String,
            default: '#ffa500b3'
        },
        muted: {
            type: Boolean,
            default: false
        },
        online: {
            type: Boolean,
            default: false
        },
        lastLogin: {
            type: Date,
            default: Date.now
        },
        code: {
            type: String,
            default: shortid.generate
        },
        machineID: {
            type: String
        },
        appVersion: {
            type: String
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true }
    }
);

UserSchema.virtual('defaultInitials').get(function() {
    let initials = this.initials || '';

    if (!initials) {
        if (this.firstName) initials = this.firstName.substr(0, 1);
        if (this.lastName) initials += this.lastName.substr(0, 1);
    } else if (initials.length === 3) {
        initials = initials[0] + initials[initials.length - 1];
    }

    return initials.toUpperCase();
});

module.exports = mongoose.model('User', UserSchema);
