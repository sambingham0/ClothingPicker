module.exports = {
  apps: [
    {
      name: "clothingpicker-server",
      script: "./scripts/server.js",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    }
  ],
};