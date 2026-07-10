import { useState } from "react";
import type { useMatch } from "../hooks/useMatch";

export default function Lobby({ match }: { match: ReturnType<typeof useMatch> }) {
  const [username, setUsername] = useState("");
  const [joinMatchId, setJoinMatchId] = useState("");
  const [joinCode, setJoinCode] = useState("");

  return (
    <section>
      {!match.identity ? (
        <div>
          <input
            data-testid="username"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            data-testid="register"
            disabled={!username}
            onClick={() => void match.register(username)}
          >
            Register
          </button>
        </div>
      ) : (
        <div>
          <p data-testid="identity">
            Playing as <strong>{match.identity.username}</strong>
          </p>
          <button
            data-testid="find-ranked"
            disabled={match.status === "searching"}
            onClick={() => void match.findRankedMatch()}
          >
            {match.status === "searching" ? "Searching…" : "Find Ranked Match"}
          </button>
          <button
            data-testid="create-challenge"
            onClick={() => void match.createChallenge()}
          >
            Create Challenge
          </button>
          <div>
            <input
              data-testid="join-match-id"
              placeholder="match id"
              value={joinMatchId}
              onChange={(e) => setJoinMatchId(e.target.value)}
            />
            <input
              data-testid="join-code"
              placeholder="join code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button
              data-testid="join-challenge"
              disabled={!joinMatchId || !joinCode}
              onClick={() => void match.joinChallenge(joinMatchId, joinCode)}
            >
              Join Challenge
            </button>
          </div>
        </div>
      )}
      <p data-testid="status">{match.status}</p>
      {match.error && <p data-testid="error">{match.error}</p>}
    </section>
  );
}
