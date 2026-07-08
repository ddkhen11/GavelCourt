import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server pinned to port 3000 per SPEC. The app talks to grpcwebproxy on
// :8080, never to the gRPC server on :50051 directly.
// duel-protos is a linked local package (client/protos) of generated CommonJS
// stubs; forcing it through dep prebundling gives it ESM interop so named
// imports work in the browser.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["duel-protos", "duel-protos/duel_grpc_web_pb"],
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
