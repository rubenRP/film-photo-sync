import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";

function authPlugin(): Plugin {
  let authPassword: string | undefined;

  return {
    name: "auth-plugin",
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, "");
      authPassword = env.AUTH_PASSWORD;
    },
    configureServer(server) {
      server.middlewares.use("/api/auth", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const { password } = JSON.parse(body);

            if (!authPassword) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Auth not configured" }));
              return;
            }

            if (password === authPassword) {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 401;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Invalid password" }));
            }
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid request" }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [authPlugin()],
});
