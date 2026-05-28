const Invitation = require('../../models/Invitation');
const config = require('../../../config/default');

const getInvitations = async (req, res) => {
    const invitations = await Invitation.find();
    res.json(invitations);
};

const createInvitations = async (req, res) => {
    try {
        const invitationInfo = req.body;
        const invitations = [];

        invitationInfo.receivers.forEach((receiver) => {
            invitations.push({
                receiver,
                sender: req.user.email,
                message: invitationInfo.message || null
            });
        });

        await Invitation.insertMany(invitations);

        res.send('OK');
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

const acceptInvitation = async (req, res) => {
    try {
        const acceptanceCode = req.params.acceptanceCode;
        await Invitation.findOneAndUpdate(
            { acceptanceCode },
            { isAccepted: true }
        );
        res.redirect(config.app.invitationURL);
    } catch (error) {
        return res.status(400).json({
            error: 'something_went_wrong',
            message: error.message
        });
    }
};

// const removeInvitation = async (req, res) => {
//   await Invitation.deleteMany({sender: req.user.email});
//   res.send('OK');
// };

module.exports = {
    getInvitations,
    createInvitations,
    acceptInvitation
    //removeInvitation
};
