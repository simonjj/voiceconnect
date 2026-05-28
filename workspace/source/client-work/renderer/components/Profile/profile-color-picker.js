import React from 'react';
import propTypes from 'prop-types';

const COLORS = [
    '#ffa500b3',
    '#00bfffb3',
    '#cd5c5cb3',
    '#ffa07ab3',
    '#48d1ccb3',
    '#87ceebb3',
    '#ffdeadb3'
];

const ColorBlock = ({ color, initialColor, onColorChange }) => {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)')
        .matches;
    return (
        <div
            className="profile-container__color-picker__vars-block"
            style={{
                backgroundColor: `${color}`,
                borderColor:
                    initialColor && initialColor === color
                        ? isDarkMode
                            ? '#ffffff'
                            : `#000`
                        : 'transparent'
            }}
            onClick={() => onColorChange({ avatarColor: color })}
        />
    );
};

const UserDemo = ({ initials, initialColor }) => {
    return (
        <div
            className="profile-container__color-picker-demo"
            style={{ backgroundColor: initialColor ? initialColor : '#e74c3c' }}
        >
            <span>{initials}</span>
        </div>
    );
};

export const ProfileColorPicker = ({
    initials,
    initialColor,
    onColorChange
}) => {
    return (
        <div className="profile-container__color-picker">
            <div className="profile-container__color-picker__vars">
                {COLORS.map((color, index) => {
                    return (
                        <ColorBlock
                            key={`color-settings-${index}-${color}`}
                            color={color}
                            initialColor={initialColor}
                            onColorChange={onColorChange}
                        />
                    );
                })}
            </div>
            <UserDemo initials={initials} initialColor={initialColor} />
        </div>
    );
};

ColorBlock.propTypes = {
    color: propTypes.string,
    initialColor: propTypes.string,
    onColorChange: propTypes.func
};

UserDemo.propTypes = {
    initials: propTypes.string,
    initialColor: propTypes.string
};

ProfileColorPicker.propTypes = {
    initials: propTypes.string,
    initialColor: propTypes.string,
    onColorChange: propTypes.func
};
