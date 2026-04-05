module.exports = {
  apps: [
    {
      name: "wohnly-api",
      cwd: "/var/www/wohnly/apps/api",
      script: "src/index.ts",
      interpreter: "node",
      node_args: "--env-file=.env --import tsx/esm",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
