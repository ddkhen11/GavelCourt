import { useEffect, useState } from "react";
import { GetLeaderboardRequest, LeaderboardEntry } from "duel-protos";
import { duelClient as client } from "../grpc/client";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({
  currentUsername,
}: {
  currentUsername?: string;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry.AsObject[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const req = new GetLeaderboardRequest();
    req.setLimit(0); // 0 -> server default
    client
      .getLeaderboard(req)
      .then((res) => setEntries(res.getEntriesList().map((e) => e.toObject())))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <section className="panel lb" data-testid="leaderboard">
      <h2 className="lb-title">Leaderboard</h2>
      {error && (
        <p className="lobby-error" data-testid="leaderboard-error">
          {error}
        </p>
      )}
      <ol className="lb-list">
        {entries.map((e, i) => (
          <li
            key={`${e.username}-${i}`}
            data-testid="leaderboard-entry"
            className={
              "lb-row" +
              (currentUsername && e.username === currentUsername
                ? " lb-row-me"
                : "")
            }
          >
            <span className="lb-rank tnum" aria-hidden="true">
              {MEDALS[i] ?? i + 1}
            </span>
            <span className="lb-name">{e.username}</span>
            {/* hidden separators keep the machine-readable "name — elo (WW/LL)"
                text shape the leaderboard e2e gate parses */}
            <span className="visually-hidden">{" — "}</span>
            <span className="lb-elo tnum">{e.elo}</span>
            <span className="lb-record tnum">
              <span className="visually-hidden">{" ("}</span>
              {e.wins}W/{e.losses}L
              <span className="visually-hidden">{")"}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
