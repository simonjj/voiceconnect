/* istanbul ignore file*/

const path = require('path');
const express = require('express');

module.exports = express.static(path.resolve(__dirname, '../../assets'));
