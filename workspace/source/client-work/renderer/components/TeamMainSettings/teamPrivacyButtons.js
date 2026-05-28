import React from 'react';
import propTypes from 'prop-types';
import { updatePrivacyState } from '../../requests';
import loadable from '@loadable/component';

const Button = loadable(() =>
    import(/* webpackChunkName: "Button" */ '@material-ui/core/Button')
);

const TeamPrivacyButtons = ({ appState, isUserOwner, classes, teamCode }) => {
    const isPrivate = appState.team.isPrivate;
    const owner = appState.team.owner;

    return (
        <div className={classes.teamStatusBlock}>
            {!isPrivate
                ? isUserOwner && (
                      <Button
                          className="mdl-button mdl-button--raised  mdl-button--colored"
                          onClick={() =>
                              updatePrivacyState(owner, teamCode, !isPrivate)
                          }
                      >
                          Mark a team private
                      </Button>
                  )
                : isUserOwner && (
                      <Button
                          className="mdl-button mdl-button--raised  mdl-button--colored"
                          onClick={() =>
                              updatePrivacyState(owner, teamCode, !isPrivate)
                          }
                      >
                          Mark a team public
                      </Button>
                  )}
        </div>
    );
};

TeamPrivacyButtons.propTypes = {
    appState: propTypes.object,
    isUserOwner: propTypes.bool,
    classes: propTypes.object,
    teamCode: propTypes.string
};
export default TeamPrivacyButtons;
