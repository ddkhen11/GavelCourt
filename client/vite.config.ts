import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server pinned to port 3000 per SPEC. The app talks to grpcwebproxy on
// :8080, never to the gRPC server on :50051 directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  },
});
