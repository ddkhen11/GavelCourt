import { useCallback, useEffect, useRef, useState } from "react";
import { grpc } from "@improbable-eng/grpc-web";
import {
  BidAction,
  CardStats,
  GameEvent,
  PassAction,
  PlayerAction,
  ReadyAction,
} from "duel-protos";
import { StreamDuelMethod } from "../grpc/streamDuel";
import { PROXY_URL } from "./useMatch";
import type { Identity } from "./useMatch";

export interface CurrentCard {
  number: number;
  remaining: number;
  playerId: string;
  name: string;
  season: string;
  team: string;
  position: string;
  tier: number;
  isPity: boolean;
}

export interface LastResolve {
  youWon: boolean;
  winningBid: number;
  yourBid: number;
  opponentBid: number;
  stats: CardStats.AsObject;
}

export interface GameEnd {
  result: number;
  yourScore: number;
  opponentScore: number;
  eloChange: number;
  byForfeit: boolean;
  yourLineup: CardStats.AsObject[];
  opponentLineup: CardStats.AsObject[];
  yourTotals: { impact: number; bonus: number; total: number };
  opponentTotals: { impact: number; bonus: number; total: number };
}

export interface DuelState {
  connected: boolean;
  started: boolean;
  boardSize: number;
  rosterSize: number;
  credits: number;
  opponentCredits: number;
  myDrafted: number;
  oppDrafted: number;
  lineup: CardStats.AsObject[];
  card: CurrentCard | null;
  bidWindow: { seconds: number; maxBid: number } | null;
  lastResolve: LastResolve | null;
  consecutivePasses: number;
  ended: GameEnd | null;
  errors: string[];
}

const initialState: DuelState = {
  connected: false,
  started: false,
  boardSize: 0,
  rosterSize: 5,
  credits: 0,
  opponentCredits: 0,
  myDrafted: 0,
  oppDrafted: 0,
  lineup: [],
  card: null,
  bidWindow: null,
  lastResolve: null,
  consecutivePasses: 0,
  ended: null,
  errors: [],
};

function applyEvent(prev: DuelState, ev: GameEvent, pityPending: { flag: boolean }): DuelState {
  switch (ev.getEventCase()) {
    case GameEvent.EventCase.GAME_STARTED: {
      const e = ev.getGameStarted()!;
      return {
        ...prev,
        started: true,
        boardSize: e.getBoardSize(),
        rosterSize: e.getRosterSize(),
        credits: e.getYourCredits(),
        opponentCredits: e.getYourCredits(),
      };
    }
    case GameEvent.EventCase.PITY_TRIGGERED: {
      pityPending.flag = true;
      return prev;
    }
    case GameEvent.EventCase.CARD_FLIPPED: {
      const e = ev.getCardFlipped()!;
      const c = e.getCard()!;
      const isPity = pityPending.flag;
      pityPending.flag = false;
      return {
        ...prev,
        bidWindow: null,
        lastResolve: null,
        card: {
          number: e.getCardNumber(),
          remaining: e.getCardsRemaining(),
          playerId: c.getPlayerId(),
          name: c.getPlayerName(),
          season: c.getSeason(),
          team: c.getTeam(),
          position: c.getPosition(),
          tier: e.getTier(),
          isPity,
        },
      };
    }
    case GameEvent.EventCase.BID_WINDOW_OPEN: {
      const e = ev.getBidWindowOpen()!;
      return {
        ...prev,
        bidWindow: { seconds: e.getDurationSeconds(), maxBid: e.getYourMaxBid() },
      };
    }
    case GameEvent.EventCase.BID_RESOLVED: {
      const e = ev.getBidResolved()!;
      const stats = e.getRevealedStats()!.toObject();
      return {
        ...prev,
        bidWindow: null,
        consecutivePasses: 0,
        credits: e.getYourCreditsRemaining(),
        opponentCredits: e.getOpponentCreditsRemaining(),
        myDrafted: e.getYourPlayersDrafted(),
        oppDrafted: e.getOpponentPlayersDrafted(),
        lineup: e.getYouWon() ? [...prev.lineup, stats] : prev.lineup,
        lastResolve: {
          youWon: e.getYouWon(),
          winningBid: e.getWinningBid(),
          yourBid: e.getYourBid(),
          opponentBid: e.getOpponentBid(),
          stats,
        },
      };
    }
    case GameEvent.EventCase.CARD_PASSED: {
      const e = ev.getCardPassed()!;
      return {
        ...prev,
        bidWindow: null,
        consecutivePasses: e.getConsecutivePasses(),
      };
    }
    case GameEvent.EventCase.GAME_ENDED: {
      const e = ev.getGameEnded()!;
      const mine = e.getYourLineup();
      const theirs = e.getOpponentLineup();
      return {
        ...prev,
        bidWindow: null,
        ended: {
          result: e.getResult(),
          yourScore: e.getYourScore(),
          opponentScore: e.getOpponentScore(),
          eloChange: e.getEloChange(),
          byForfeit: e.getByForfeit(),
          yourLineup: mine ? mine.getPlayersList().map((p) => p.toObject()) : [],
          opponentLineup: theirs
            ? theirs.getPlayersList().map((p) => p.toObject())
            : [],
          yourTotals: mine
            ? { impact: mine.getImpactScore(), bonus: mine.getBonus(), total: mine.getTotalScore() }
            : { impact: 0, bonus: 0, total: 0 },
          opponentTotals: theirs
            ? { impact: theirs.getImpactScore(), bonus: theirs.getBonus(), total: theirs.getTotalScore() }
            : { impact: 0, bonus: 0, total: 0 },
        },
      };
    }
    case GameEvent.EventCase.ERROR: {
      const e = ev.getError()!;
      return { ...prev, errors: [...prev.errors, `${e.getCode()}: ${e.getMessage()}`] };
    }
    default:
      return prev;
  }
}

export function useDuel(identity: Identity | null, matchId: string | null) {
  const [state, setState] = useState<DuelState>(initialState);
  const clientRef = useRef<grpc.Client<PlayerAction, GameEvent> | null>(null);
  const pityRef = useRef({ flag: false });

  // Open the stream once we know who we are and what match we're in.
  useEffect(() => {
    if (!identity || !matchId || clientRef.current) return;

    const client = grpc.client<PlayerAction, GameEvent, typeof StreamDuelMethod>(
      StreamDuelMethod,
      {
        host: PROXY_URL,
        transport: grpc.WebsocketTransport(),
      },
    );
    client.onMessage((ev: GameEvent) => {
      setState((prev) => applyEvent(prev, ev, pityRef.current));
    });
    client.onEnd((code, msg) => {
      setState((prev) => ({
        ...prev,
        connected: false,
        errors:
          code === grpc.Code.OK
            ? prev.errors
            : [...prev.errors, `stream closed: ${msg || grpc.Code[code]}`],
      }));
      clientRef.current = null;
    });

    const md = new grpc.Metadata();
    md.set("player-id", identity.playerId);
    md.set("auth-token", identity.authToken);
    client.start(md);
    clientRef.current = client;
    setState((prev) => ({ ...prev, connected: true }));

    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [identity, matchId]);

  const sendReady = useCallback(() => {
    const a = new PlayerAction();
    a.setReady(new ReadyAction());
    clientRef.current?.send(a);
  }, []);

  const sendBid = useCallback((amount: number) => {
    const bid = new BidAction();
    bid.setAmount(amount);
    const a = new PlayerAction();
    a.setBid(bid);
    clientRef.current?.send(a);
  }, []);

  const sendPass = useCallback(() => {
    const a = new PlayerAction();
    a.setPass(new PassAction());
    clientRef.current?.send(a);
  }, []);

  return { state, sendReady, sendBid, sendPass };
}
