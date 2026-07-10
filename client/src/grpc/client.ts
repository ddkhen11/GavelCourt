import { DuelServicePromiseClient } from "duel-protos/duel_grpc_web_pb";

// Single shared unary/server-streaming client. The app always talks to
// grpcwebproxy on :8080, never to the gRPC server on :50051 directly.
// (StreamDuel is the exception — see streamDuel.ts for the websocket path.)
export const PROXY_URL = "http://localhost:8080";

export const duelClient = new DuelServicePromiseClient(PROXY_URL);
