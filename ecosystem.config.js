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
        EXEC_SECRET: "GcUqWhAo2QP1RDwkQKcK2wlisa98Q0OS",
        LINEAR_API_KEY: "lin_api_7blho0sEGW5nnXlEkHXh6x1YWMcWMYHY7VzN2RTs",
      },
    },
  ],
};
