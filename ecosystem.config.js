const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

const { EXEC_SECRET, LINEAR_API_KEY } = process.env;

if (!EXEC_SECRET || !LINEAR_API_KEY) {
  throw new Error("Missing EXEC_SECRET or LINEAR_API_KEY in .env");
}

module.exports = {
  apps: [
    {
      name: "linear-engine-api",
      script: "dist/api/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: Number(process.env.PORT || 3001),
        EXEC_SECRET,
        LINEAR_API_KEY,
      },
    },
  ],
};
