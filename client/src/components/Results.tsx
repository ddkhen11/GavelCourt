import { GameResult } from "duel-protos";
import type { GameEnd } from "../hooks/useDuel";
import Lineup from "./Lineup";

// Keyed off the generated enum so a proto renumber can't silently skew these.
const RESULT_NAMES: Record<number, string> = {
  [GameResult.GAME_RESULT_WIN]: "You win!",
  [GameResult.GAME_RESULT_LOSS]: "You lose",
  [GameResult.GAME_RESULT_TIE]: "Tie",
};

export default function Results({
  ended,
  rosterSize,
  onPlayAgain,
}: {
  ended: GameEnd;
  rosterSize: number;
  onPlayAgain: () => void;
}) {
  return (
    <section data-testid="results">
      <h2 data-testid="result">{RESULT_NAMES[ended.result] ?? "Game over"}</h2>
      {ended.byForfeit && <p data-testid="forfeit">Won by forfeit</p>}
      <p data-testid="scores">
        You {ended.yourScore.toFixed(1)} (impact {ended.yourTotals.impact.toFixed(1)} +
        bonus {ended.yourTotals.bonus.toFixed(1)}) — Opponent{" "}
        {ended.opponentScore.toFixed(1)} (impact{" "}
        {ended.opponentTotals.impact.toFixed(1)} + bonus{" "}
        {ended.opponentTotals.bonus.toFixed(1)})
      </p>
      <p data-testid="elo-change">
        Elo {ended.eloChange >= 0 ? "+" : ""}
        {ended.eloChange}
      </p>
      <Lineup players={ended.yourLineup} rosterSize={rosterSize} testId="lineup" />
      <Lineup
        players={ended.opponentLineup}
        rosterSize={rosterSize}
        title="Opponent lineup"
        testId="opp-lineup"
      />
      <button data-testid="play-again" onClick={onPlayAgain}>
        Back to lobby
      </button>
    </section>
  );
}
