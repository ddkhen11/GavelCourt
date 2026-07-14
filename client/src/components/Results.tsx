import { GameResult } from "duel-protos";
import type { GameEnd } from "../hooks/useDuel";
import Lineup from "./Lineup";
import CountUp from "./CountUp";

// Keyed off the generated enum so a proto renumber can't silently skew these.
// The exact strings are asserted by gate_components — don't reword them.
const RESULT_NAMES: Record<number, string> = {
  [GameResult.GAME_RESULT_WIN]: "You win!",
  [GameResult.GAME_RESULT_LOSS]: "You lose",
  [GameResult.GAME_RESULT_TIE]: "Tie",
};

const VERDICT_CLASS: Record<number, string> = {
  [GameResult.GAME_RESULT_WIN]: "verdict-win",
  [GameResult.GAME_RESULT_LOSS]: "verdict-lose",
  [GameResult.GAME_RESULT_TIE]: "verdict-tie",
};

// One side's final line: label, impact+bonus bar segments, rolling total.
function ScoreRow({
  label,
  side,
  impact,
  bonus,
  total,
  max,
}: {
  label: string;
  side: "you" | "opp";
  impact: number;
  bonus: number;
  total: number;
  max: number;
}) {
  const pct = (v: number) => `${max > 0 ? (v / max) * 100 : 0}%`;
  return (
    <div className={`score-row score-${side}`}>
      <span className="score-label">{label}</span>
      <span className="score-track" aria-hidden="true">
        <span className="score-seg score-seg-impact" style={{ width: pct(impact) }} />
        <span className="score-seg score-seg-bonus" style={{ width: pct(bonus) }} />
      </span>
      <strong className="score-total tnum">
        <CountUp value={total} duration={900} />
      </strong>
      <span className="visually-hidden">
        (impact {impact.toFixed(1)} + bonus {bonus.toFixed(1)})
      </span>
    </div>
  );
}

export default function Results({
  ended,
  rosterSize,
  onPlayAgain,
}: {
  ended: GameEnd;
  rosterSize: number;
  onPlayAgain: () => void;
}) {
  const maxScore = Math.max(ended.yourScore, ended.opponentScore, 1);

  return (
    <section className="results" data-testid="results">
      <div className={`verdict panel ${VERDICT_CLASS[ended.result] ?? "verdict-tie"}`}>
        <p className="verdict-kicker hud-label">Final · official box score</p>
        <h2 className="verdict-title" data-testid="result">
          {RESULT_NAMES[ended.result] ?? "Game over"}
        </h2>
        {ended.byForfeit && (
          <p className="verdict-forfeit" data-testid="forfeit">
            Won by forfeit
          </p>
        )}
        <p className="verdict-elo tnum" data-testid="elo-change">
          Elo {ended.eloChange >= 0 ? "+" : ""}
          {ended.eloChange}
        </p>
      </div>

      <div className="score-box panel" data-testid="scores">
        <ScoreRow
          label="You"
          side="you"
          impact={ended.yourTotals.impact}
          bonus={ended.yourTotals.bonus}
          total={ended.yourScore}
          max={maxScore}
        />
        <ScoreRow
          label="Opp"
          side="opp"
          impact={ended.opponentTotals.impact}
          bonus={ended.opponentTotals.bonus}
          total={ended.opponentScore}
          max={maxScore}
        />
        <p className="score-legend" aria-hidden="true">
          <span className="legend-swatch legend-impact" /> impact
          <span className="legend-swatch legend-bonus" /> bonus
        </p>
      </div>

      <div className="lineup-compare">
        <Lineup players={ended.yourLineup} rosterSize={rosterSize} testId="lineup" />
        <Lineup
          players={ended.opponentLineup}
          rosterSize={rosterSize}
          title="Opponent lineup"
          testId="opp-lineup"
        />
      </div>

      <button className="play-again" data-testid="play-again" onClick={onPlayAgain}>
        Back to lobby
      </button>
    </section>
  );
}
