import { useEffect, useState } from "react";
import { GetLeaderboardRequest, LeaderboardEntry } from "duel-protos";
import { duelClient as client } from "../grpc/client";

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
      <h2 className="lb-title">The Standings</h2>
      {error && (
        <p className="lobby-error" data-testid="leaderboard-error">
          {error}
        </p>
      )}
      {!error && entries.length === 0 && (
        <p className="lb-empty">
          Nothing in the books yet — win a ranked duel and make the page.
        </p>
      )}
      <div className="lb-head" aria-hidden="true">
        <span>no.</span>
        <span>player</span>
        <span>elo</span>
        <span>w–l</span>
      </div>
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
            <span
              className={"lb-rank" + (i < 3 ? " lb-rank-top" : "")}
              aria-hidden="true"
            >
              {i < 3 ? `no.${i + 1}` : i + 1}
            </span>
            <span className="lb-name">{e.username}</span>
            {/* hidden separators keep the machine-readable "name — elo (record)"
                text shape the leaderboard e2e gate parses */}
            <span className="visually-hidden">{" — "}</span>
            <span className="lb-elo tnum">{e.elo}</span>
            <span className="lb-record tnum">
              <span className="visually-hidden">{" ("}</span>
              {e.wins}–{e.losses}
              <span className="visually-hidden">{")"}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
