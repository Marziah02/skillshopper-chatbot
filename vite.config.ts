import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/skillshopper-chatbot/", // <-- this is important
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/index.js",
        assetFileNames: ({ name }) => {
          if (name && name.endsWith(".css")) {
            return "assets/index.css"; // Keep CSS in css folder
          }
          return "assets/[name].[ext]";
        },
      },
    },
  },
});
