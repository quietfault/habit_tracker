import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes asset paths relative, so the build works under
// https://<user>.github.io/<repo>/ without hardcoding the repo name.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
