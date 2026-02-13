module.exports = {
  apps: [
    {
      name: "linear-engine-api",
      script: "dist/api/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        EXEC_SECRET: "atul_singh_linear_369"
      }
    }
  ]
};
