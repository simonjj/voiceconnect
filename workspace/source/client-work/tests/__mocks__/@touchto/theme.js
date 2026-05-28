/* eslint-disable react/prop-types, no-unused-vars */
import React from 'react';

const mockComponent = ({
    className,
    children,
    renderWith,
    justifyContent,
    ...props
}) => (
    <div className={className} {...props}>
        {children}
    </div>
);

const Theme = (props) => mockComponent(props);

const Button = (props) => mockComponent(props);

const FlexLayout = (props) => mockComponent(props);

const Heading = (props) => mockComponent(props);

const Logo = (props) => mockComponent(props);

const Nav = (props) => mockComponent(props);

export default Theme;
export { Button, FlexLayout, Heading, Logo, Nav };
