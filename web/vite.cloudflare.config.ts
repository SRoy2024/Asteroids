import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// Independent deployment: no ChatGPT login, connectors, or hosting manifest.
export default defineConfig({
  plugins: [vinext(), cloudflare({
    configPath: "wrangler.cloudflare.json",
    viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    inspectorPort: false,
  })],
});
