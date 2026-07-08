import { grpc } from "@improbable-eng/grpc-web";
import { GameEvent, PlayerAction } from "duel-protos";

// Hand-written method descriptor for the one bidi RPC. google's grpc-web
// cannot express bidirectional streaming, so StreamDuel goes through
// Improbable's client over the websocket transport that grpcwebproxy
// exposes with --use_websockets. Message classes still come from the
// generated duel-protos package; only the descriptor lives here.
const DuelService = {
  serviceName: "duel.v1.DuelService",
};

export const StreamDuelMethod: grpc.MethodDefinition<PlayerAction, GameEvent> =
  {
    methodName: "StreamDuel",
    service: DuelService,
    requestStream: true,
    responseStream: true,
    requestType: PlayerAction,
    responseType: GameEvent,
  };
