import * as grpcWeb from 'grpc-web';

import * as duel_pb from './duel_pb'; // proto import: "duel.proto"


export class DuelServiceClient {
  constructor (hostname: string,
               credentials?: null | { [index: string]: string; },
               options?: null | { [index: string]: any; });

  registerPlayer(
    request: duel_pb.RegisterPlayerRequest,
    metadata: grpcWeb.Metadata | undefined,
    callback: (err: grpcWeb.RpcError,
               response: duel_pb.RegisterPlayerResponse) => void
  ): grpcWeb.ClientReadableStream<duel_pb.RegisterPlayerResponse>;

  createMatch(
    request: duel_pb.CreateMatchRequest,
    metadata: grpcWeb.Metadata | undefined,
    callback: (err: grpcWeb.RpcError,
               response: duel_pb.CreateMatchResponse) => void
  ): grpcWeb.ClientReadableStream<duel_pb.CreateMatchResponse>;

  joinMatch(
    request: duel_pb.JoinMatchRequest,
    metadata: grpcWeb.Metadata | undefined,
    callback: (err: grpcWeb.RpcError,
               response: duel_pb.JoinMatchResponse) => void
  ): grpcWeb.ClientReadableStream<duel_pb.JoinMatchResponse>;

  findRankedMatch(
    request: duel_pb.FindRankedMatchRequest,
    metadata: grpcWeb.Metadata | undefined,
    callback: (err: grpcWeb.RpcError,
               response: duel_pb.FindRankedMatchResponse) => void
  ): grpcWeb.ClientReadableStream<duel_pb.FindRankedMatchResponse>;

  watchMatch(
    request: duel_pb.WatchMatchRequest,
    metadata?: grpcWeb.Metadata
  ): grpcWeb.ClientReadableStream<duel_pb.GameEvent>;

}

export class DuelServicePromiseClient {
  constructor (hostname: string,
               credentials?: null | { [index: string]: string; },
               options?: null | { [index: string]: any; });

  registerPlayer(
    request: duel_pb.RegisterPlayerRequest,
    metadata?: grpcWeb.Metadata
  ): Promise<duel_pb.RegisterPlayerResponse>;

  createMatch(
    request: duel_pb.CreateMatchRequest,
    metadata?: grpcWeb.Metadata
  ): Promise<duel_pb.CreateMatchResponse>;

  joinMatch(
    request: duel_pb.JoinMatchRequest,
    metadata?: grpcWeb.Metadata
  ): Promise<duel_pb.JoinMatchResponse>;

  findRankedMatch(
    request: duel_pb.FindRankedMatchRequest,
    metadata?: grpcWeb.Metadata
  ): Promise<duel_pb.FindRankedMatchResponse>;

  watchMatch(
    request: duel_pb.WatchMatchRequest,
    metadata?: grpcWeb.Metadata
  ): grpcWeb.ClientReadableStream<duel_pb.GameEvent>;

}

