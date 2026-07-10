import { useCallback, useState } from "react";
import {
  CreateMatchRequest,
  FindRankedMatchRequest,
  JoinMatchRequest,
  MatchMode,
  RegisterPlayerRequest,
} from "duel-protos";
import { duelClient as client } from "../grpc/client";

const STORAGE_KEY = "duel.identity";

export interface Identity {
  playerId: string;
  authToken: string;
  username: string;
}

export type MatchStatus =
  | "idle"
  | "registering"
  | "searching"
  | "waiting" // challenge created, waiting for the opponent to join
  | "matched"
  | "error";

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function useMatch() {
  const [identity, setIdentity] = useState<Identity | null>(loadIdentity);
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => {
    setStatus("error");
    setError(e instanceof Error ? e.message : String(e));
  };

  const register = useCallback(async (username: string) => {
    setStatus("registering");
    setError(null);
    try {
      const req = new RegisterPlayerRequest();
      req.setUsername(username);
      const res = await client.registerPlayer(req);
      const id: Identity = {
        playerId: res.getPlayerId(),
        authToken: res.getAuthToken(),
        username,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
      setIdentity(id);
      setStatus("idle");
      return id;
    } catch (e) {
      fail(e);
      throw e;
    }
  }, []);

  const findRankedMatch = useCallback(async () => {
    if (!identity) throw new Error("register first");
    setStatus("searching");
    setError(null);
    try {
      const req = new FindRankedMatchRequest();
      req.setPlayerId(identity.playerId);
      const res = await client.findRankedMatch(req);
      setMatchId(res.getMatchId());
      setStatus("matched");
      return res.getMatchId();
    } catch (e) {
      fail(e);
      throw e;
    }
  }, [identity]);

  const createChallenge = useCallback(async () => {
    if (!identity) throw new Error("register first");
    setError(null);
    try {
      const req = new CreateMatchRequest();
      req.setPlayerId(identity.playerId);
      req.setMode(MatchMode.MATCH_MODE_CHALLENGE);
      const res = await client.createMatch(req);
      setMatchId(res.getMatchId());
      setJoinCode(res.getJoinCode());
      setStatus("waiting");
      return { matchId: res.getMatchId(), joinCode: res.getJoinCode() };
    } catch (e) {
      fail(e);
      throw e;
    }
  }, [identity]);

  const joinChallenge = useCallback(
    async (targetMatchId: string, code: string) => {
      if (!identity) throw new Error("register first");
      setError(null);
      try {
        const req = new JoinMatchRequest();
        req.setMatchId(targetMatchId);
        req.setPlayerId(identity.playerId);
        req.setJoinCode(code);
        const res = await client.joinMatch(req);
        setMatchId(res.getMatchId());
        setStatus("matched");
        return res.getMatchId();
      } catch (e) {
        fail(e);
        throw e;
      }
    },
    [identity],
  );

  // Back to the lobby after a match (identity is kept).
  const reset = useCallback(() => {
    setMatchId(null);
    setJoinCode(null);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    identity,
    status,
    matchId,
    joinCode,
    error,
    register,
    findRankedMatch,
    createChallenge,
    joinChallenge,
    reset,
  };
}
