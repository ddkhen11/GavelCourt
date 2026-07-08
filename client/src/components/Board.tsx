import { useEffect, useState } from "react";
import type { DuelState } from "../hooks/useDuel";

const TIER_NAMES: Record<number, string> = { 1: "S", 2: "A", 3: "B", 4: "C" };

interface BoardProps {
  state: DuelState;
  sendReady: () => void;
  sendBid: (amount: number) => void;
  sendPass: () => void;
}

export default function Board({ state, sendReady, sendBid, sendPass }: BoardProps) {
  const [amount, setAmount] = useState("");
  const bidding = state.bidWindow !== null;

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
        <div data-testid="card">
          {state.card.isPity && <p data-testid="pity">PITY CARD — S/A guaranteed</p>}
          <h3 data-testid="card-flipped">
            {state.card.name} ({state.card.season} {state.card.position})
          </h3>
          <p>
            #<span data-testid="card-number">{state.card.number}</span> ·{" "}
            {state.card.team} · tier{" "}
            <strong data-testid="card-tier">
              {TIER_NAMES[state.card.tier] ?? "?"}
            </strong>{" "}
            · {state.card.remaining} cards left
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
            disabled={amount === ""}
            onClick={() => sendBid(Number(amount))}
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
