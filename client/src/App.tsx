import { useState } from "react";
import { useMatch } from "./hooks/useMatch";
import { useDuel } from "./hooks/useDuel";

export default function App() {
  const match = useMatch();
  const duel = useDuel(match.identity, match.matchId);
  const [username, setUsername] = useState("");
  const [joinMatchId, setJoinMatchId] = useState("");
  const [joinCode, setJoinCode] = useState("");

  return (
    <main>
      <h1>NBA Auction Draft</h1>

      {!match.identity ? (
        <section>
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
        </section>
      ) : (
        <section>
          <p data-testid="identity">
            Playing as <strong>{match.identity.username}</strong>
          </p>
          <button
            data-testid="find-ranked"
            onClick={() => void match.findRankedMatch()}
          >
            Find Ranked Match
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
        </section>
      )}

      <p data-testid="status">{match.status}</p>
      {match.matchId && <p data-testid="match-id">{match.matchId}</p>}
      {match.joinCode && <p data-testid="challenge-code">{match.joinCode}</p>}
      {match.error && <p data-testid="error">{match.error}</p>}

      {match.matchId && (
        <section>
          <h2>Duel</h2>
          <p data-testid="duel-connected">
            {duel.state.connected ? "connected" : "disconnected"}
          </p>
          <button data-testid="ready" onClick={duel.sendReady}>
            Ready
          </button>
          {duel.state.started && (
            <p data-testid="game-started">
              board={duel.state.boardSize} credits={duel.state.credits}
            </p>
          )}
          {duel.state.card && (
            <p data-testid="card-flipped">
              {duel.state.card.name} ({duel.state.card.season}{" "}
              {duel.state.card.position})
            </p>
          )}
          {duel.state.errors.length > 0 && (
            <p data-testid="duel-errors">{duel.state.errors.join(" | ")}</p>
          )}
        </section>
      )}
    </main>
  );
}
