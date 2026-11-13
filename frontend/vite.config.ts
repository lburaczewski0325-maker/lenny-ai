import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Boss AI",
        short_name: "Boss AI",
        description: "Lenny's own AI — free models fused into one. Chat, images, research.",
        theme_color: "#05070d",
        background_color: "#05070d",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/lenny-ai-ur2d\.onrender\.com\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
