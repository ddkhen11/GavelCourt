import { useEffect, useState } from "react";
import { CardTier } from "duel-protos";
import type { DuelState } from "../hooks/useDuel";

// Keyed off the generated enum so a proto renumber can't silently skew these.
const TIER_NAMES: Record<number, string> = {
  [CardTier.CARD_TIER_S]: "S",
  [CardTier.CARD_TIER_A]: "A",
  [CardTier.CARD_TIER_B]: "B",
  [CardTier.CARD_TIER_C]: "C",
};

interface BoardProps {
  state: DuelState;
  sendReady: () => void;
  sendBid: (amount: number) => void;
  sendPass: () => void;
}

export default function Board({ state, sendReady, sendBid, sendPass }: BoardProps) {
  const [amount, setAmount] = useState("");
  const bidding = state.bidWindow !== null;

  // uint32 on the wire: a fractional/negative/oversized amount would make the
  // protobuf serializer throw inside send(), so gate the button on validity.
  const parsedBid = Number(amount);
  const bidValid =
    amount !== "" &&
    Number.isInteger(parsedBid) &&
    parsedBid >= 0 &&
    (state.bidWindow === null || parsedBid <= state.bidWindow.maxBid);

  // Clear the bid box whenever a new window opens.
  useEffect(() => {
    if (bidding) setAmount("");
  }, [bidding, state.card?.number]);

  if (!state.started) {
    return (
      <section>
        <p data-testid="duel-connected">
          {state.connected ? "connected" : "disconnected"}
        </p>
        <button data-testid="ready" onClick={sendReady}>
          Ready
        </button>
        <p>Waiting for both players…</p>
      </section>
    );
  }

  const full = state.myDrafted >= state.rosterSize;

  return (
    <section>
      <p data-testid="game-started">
        board={state.boardSize} credits={state.credits}
      </p>
      <p data-testid="credits">
        You: {state.credits} cr, {state.myDrafted}/{state.rosterSize} — Opponent:{" "}
        {state.opponentCredits} cr, {state.oppDrafted}/{state.rosterSize}
      </p>

      {state.card && (
        <div
          key={state.card.number}
          data-testid="card"
          className={`pcard pcard-${(
            TIER_NAMES[state.card.tier] ?? "c"
          ).toLowerCase()}`}
        >
          {state.card.isPity && (
            <p className="pcard-pity" data-testid="pity">
              Pity card — S/A guaranteed
            </p>
          )}
          <div className="pcard-head">
            <span>{state.card.team}</span>
            <span className="tnum">{state.card.season}</span>
          </div>
          <h3 className="pcard-name" data-testid="card-flipped">
            {state.card.name}
            <span className="visually-hidden">
              {" "}
              ({state.card.season} {state.card.position})
            </span>
          </h3>
          <div className="pcard-meta">
            <span className="pcard-pos">{state.card.position}</span>
            <strong className="pcard-tier-badge" data-testid="card-tier">
              {TIER_NAMES[state.card.tier] ?? "?"}
            </strong>
          </div>
          <p className="pcard-foot">
            <span>
              card no. <span className="tnum" data-testid="card-number">{state.card.number}</span>
            </span>
            <span>
              <span className="tnum">{state.card.remaining}</span> to come
            </span>
          </p>
        </div>
      )}

      {bidding && !full && (
        <div data-testid="bid-window">
          <p>
            Bid window open ({state.bidWindow!.seconds}s) — max bid{" "}
            <strong data-testid="max-bid">{state.bidWindow!.maxBid}</strong>
          </p>
          <input
            data-testid="bid-amount"
            type="number"
            min={0}
            max={state.bidWindow!.maxBid}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            data-testid="place-bid"
            disabled={!bidValid}
            onClick={() => sendBid(parsedBid)}
          >
            Bid
          </button>
          <button data-testid="pass" onClick={sendPass}>
            Pass
          </button>
        </div>
      )}
      {bidding && full && <p data-testid="roster-full">Roster full — auto-passing</p>}

      {state.lastResolve && (
        <p data-testid="resolve">
          {state.lastResolve.youWon ? "You won" : "Opponent won"}{" "}
          {state.lastResolve.stats.playerName} for {state.lastResolve.winningBid} (you{" "}
          {state.lastResolve.yourBid}, opp {state.lastResolve.opponentBid}) — LAKER{" "}
          {state.lastResolve.stats.lakerScore.toFixed(1)}
        </p>
      )}

      {state.consecutivePasses > 0 && (
        <p data-testid="passes">Consecutive passes: {state.consecutivePasses}</p>
      )}

      {state.errors.length > 0 && (
        <p data-testid="duel-errors">{state.errors.join(" | ")}</p>
      )}
    </section>
  );
}
