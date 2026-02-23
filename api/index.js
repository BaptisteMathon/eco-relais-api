/**
 * Vercel serverless entry: export the Express app so all routes are handled.
 * Requires build (npm run build) to have run so dist/app.js exists.
 */
const app = require('../dist/app').default;
module.exports = app;
