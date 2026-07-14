import type { CardStats } from "duel-protos";

// Classic starting-five labels as hints for the empty seats — the draft does
// not enforce positions, it's just flavor.
const SEAT_HINTS = ["PG", "SG", "SF", "PF", "C"];

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
  const impact = players.reduce((sum, p) => sum + p.lakerScore, 0);

  return (
    <section className="panel lineup" data-testid={testId}>
      <header className="lineup-head">
        <h3 className="lineup-title">
          {title}{" "}
          <span className="lineup-count tnum">
            ({players.length}/{rosterSize})
          </span>
        </h3>
        <p className="lineup-impact">
          <span className="hud-label">impact</span>{" "}
          <strong className="tnum">{impact.toFixed(1)}</strong>
        </p>
      </header>
      <ul className="lineup-slots">
        {Array.from({ length: rosterSize }, (_, i) => {
          const p = players[i];
          return p ? (
            <li
              key={p.playerId}
              className="mini-card"
              data-testid={`${testId}-player`}
            >
              <span className="mini-name">{p.playerName}</span>
              <span className="mini-meta">
                {p.season} · {p.position}
              </span>
              <span className="mini-score tnum">{p.lakerScore.toFixed(1)}</span>
            </li>
          ) : (
            <li key={`empty-${i}`} className="mini-slot" aria-hidden="true">
              <span className="mini-hint">{SEAT_HINTS[i] ?? "—"}</span>
              <span className="mini-hint-label">seat {i + 1}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
