const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("production");

esbuild
  .build({
    entryPoints: ["main.ts"],
    bundle: true,
    format: "cjs",
    target: "ES2018",
    outdir: ".",
    outfile: "main.js",
    external: ["obsidian"],
    platform: "node",
    sourcemap: production ? false : "inline",
    minify: production,
    define: {
      "process.env.NODE_ENV": production ? '"production"' : '"development"',
    },
    plugins: [
      {
        name: "watch-plugin",
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length > 0) {
              console.log("❌ Build failed with errors:");
              result.errors.forEach((error) => {
                console.log(`${error.location?.file}:${error.location?.line}:${error.location?.column} - ${error.text}`);
              });
            } else {
              console.log("✅ Build succeeded");
            }
          });
        },
      },
    ],
  })
  .catch(() => {
    process.exit(1);
  });
