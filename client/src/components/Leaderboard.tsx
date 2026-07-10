import { useEffect, useState } from "react";
import { GetLeaderboardRequest, LeaderboardEntry } from "duel-protos";
import { duelClient as client } from "../grpc/client";

export default function Leaderboard() {
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
    <section data-testid="leaderboard">
      <h2>Leaderboard</h2>
      {error && <p data-testid="leaderboard-error">{error}</p>}
      <ol>
        {entries.map((e, i) => (
          <li key={`${e.username}-${i}`} data-testid="leaderboard-entry">
            {e.username} — {e.elo} ({e.wins}W/{e.losses}L)
          </li>
        ))}
      </ol>
    </section>
  );
}
