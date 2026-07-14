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

// 5 seat squares on the scorebug, filled as a side drafts
function Slots({ n, filled }: { n: number; filled: number }) {
  return (
    <span className="sb-slots" aria-label={`${filled} of ${n} seats filled`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={"slot" + (i < filled ? " slot-filled" : "")} />
      ))}
    </span>
  );
}

// Rolls 0 -> value like a flipping scoreboard; renders the final number
// immediately under prefers-reduced-motion.
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf: number;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 600);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toFixed(1)}</>;
}

// Latest stream errors as print-correction slips; they linger 4s after the
// most recent error, then hide (the element stays for the testid).
function ErrorSlips({ errors }: { errors: string[] }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [errors]);
  return (
    <div
      className={"error-slips" + (visible ? "" : " error-slips-hidden")}
      data-testid="duel-errors"
    >
      {errors.slice(-2).map((e, i) => (
        <p key={`${errors.length}-${i}`} className="error-slip">
          {e}
        </p>
      ))}
    </div>
  );
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

  // +/- steppers clamp to [0, maxBid]; an unparsable box counts as 0.
  const step = (d: number) => {
    const max = state.bidWindow?.maxBid ?? 0;
    const cur = amount !== "" && Number.isInteger(parsedBid) ? parsedBid : 0;
    setAmount(String(Math.min(max, Math.max(0, cur + d))));
  };

  const resolve = state.lastResolve;

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
    <section className="board">
      <div className="scorebug" data-testid="credits">
        <div className="sb-side sb-you">
          <span className="sb-team">You</span>
          <span className="sb-credits tnum">{state.credits}</span>
          <Slots n={state.rosterSize} filled={state.myDrafted} />
        </div>
        <span className="sb-vs">vs</span>
        <div className="sb-side sb-opp">
          <Slots n={state.rosterSize} filled={state.oppDrafted} />
          <span className="sb-credits tnum">{state.opponentCredits}</span>
          <span className="sb-team">Opp</span>
        </div>
      </div>
      <p className="board-meta" data-testid="game-started">
        {state.boardSize}-card board · {state.rosterSize} seats a side · blind
        bids
      </p>

      {state.card && (
        <div
          key={state.card.number}
          data-testid="card"
          className={
            `pcard pcard-${(TIER_NAMES[state.card.tier] ?? "c").toLowerCase()}` +
            (state.card.isPity ? " pcard-foil" : "")
          }
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
        <div data-testid="bid-window" className="bidbar">
          <div
            className="countdown"
            key={state.card?.number}
            aria-hidden="true"
          >
            <div
              className="countdown-fill"
              style={{ animationDuration: `${state.bidWindow!.seconds}s` }}
            />
          </div>
          <p className="bidbar-line">
            Window open ({state.bidWindow!.seconds}s) — max bid{" "}
            <strong className="tnum" data-testid="max-bid">
              {state.bidWindow!.maxBid}
            </strong>
          </p>
          <div className="bid-stepper">
            <button
              type="button"
              className="step-btn"
              aria-label="decrease bid"
              onClick={() => step(-1)}
            >
              −
            </button>
            <input
              className="bid-input tnum"
              data-testid="bid-amount"
              type="number"
              min={0}
              max={state.bidWindow!.maxBid}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              type="button"
              className="step-btn"
              aria-label="increase bid"
              onClick={() => step(1)}
            >
              +
            </button>
          </div>
          <div className="bid-chips">
            <button type="button" className="chip" onClick={() => setAmount("1")}>
              min 1
            </button>
            <button
              type="button"
              className="chip"
              onClick={() =>
                setAmount(
                  String(Math.max(1, Math.floor(state.bidWindow!.maxBid / 2))),
                )
              }
            >
              half {Math.max(1, Math.floor(state.bidWindow!.maxBid / 2))}
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => setAmount(String(state.bidWindow!.maxBid))}
            >
              max {state.bidWindow!.maxBid}
            </button>
          </div>
          <div className="bid-actions">
            <button
              className="bid-go"
              data-testid="place-bid"
              disabled={!bidValid}
              onClick={() => sendBid(parsedBid)}
            >
              Bid
            </button>
            <button className="bid-pass" data-testid="pass" onClick={sendPass}>
              Pass
            </button>
          </div>
        </div>
      )}
      {bidding && full && (
        <p className="board-notice" data-testid="roster-full">
          Roster full — auto-passing
        </p>
      )}

      {resolve && (
        <div
          key={resolve.stats.playerId}
          className={
            "resolve-slip " + (resolve.youWon ? "resolve-win" : "resolve-lose")
          }
        >
          <span className="resolve-stamp" aria-hidden="true">
            {resolve.youWon ? "Sold to you" : "Sold to opp"}
          </span>
          <p data-testid="resolve">
            {resolve.youWon ? "You won" : "Opponent won"}{" "}
            {resolve.stats.playerName} for{" "}
            <span className="tnum">{resolve.winningBid}</span> (you{" "}
            {resolve.yourBid}, opp {resolve.opponentBid}) — LAKER{" "}
            <strong className="resolve-score tnum">
              <CountUp value={resolve.stats.lakerScore} />
            </strong>
          </p>
        </div>
      )}

      {state.consecutivePasses > 0 && (
        <p className="board-notice" data-testid="passes">
          Pass streak: {state.consecutivePasses} — keep passing and a premium
          card gets pulled
        </p>
      )}

      {state.errors.length > 0 && <ErrorSlips errors={state.errors} />}
    </section>
  );
}
