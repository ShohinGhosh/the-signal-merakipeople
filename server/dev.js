// Server launcher for preview tool
// Uses tsx/cjs/api to register TypeScript support, then loads the server in-process
const path = require('path');

process.env.PATH = `C:\\Program Files\\nodejs;${process.env.PATH || ''}`;

// Register tsx for CJS TypeScript resolution
const { register } = require(path.join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cjs', 'api', 'index.cjs'));
const api = register();

// Load the server entry point
require(path.join(__dirname, 'src', 'index.ts'));
