import { useEffect, useState } from "react";
import { DuelServicePromiseClient } from "duel-protos/duel_grpc_web_pb";
import { GetLeaderboardRequest, LeaderboardEntry } from "duel-protos";
import { PROXY_URL } from "../hooks/useMatch";

const client = new DuelServicePromiseClient(PROXY_URL);

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry.AsObject[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const req = new GetLeaderboardRequest();
    req.setLimit(20);
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
