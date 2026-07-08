import type { CardStats } from "duel-protos";

export default function Lineup({
  players,
  rosterSize,
  title = "Your lineup",
  testId = "lineup",
}: {
  players: CardStats.AsObject[];
  rosterSize: number;
  title?: string;
  testId?: string;
}) {
  return (
    <section data-testid={testId}>
      <h3>
        {title} ({players.length}/{rosterSize})
      </h3>
      <ul>
        {players.map((p) => (
          <li key={p.playerId} data-testid={`${testId}-player`}>
            {p.playerName} ({p.season} {p.position}) — LAKER {p.lakerScore.toFixed(1)}
          </li>
        ))}
      </ul>
    </section>
  );
}
