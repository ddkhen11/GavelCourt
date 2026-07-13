import { useState } from "react";
import type { MatchStatus, useMatch } from "../hooks/useMatch";

// Human copy for the raw machine status (kept verbatim in data-status).
const STATUS_COPY: Record<MatchStatus, string> = {
  idle: "",
  registering: "Creating your player…",
  searching: "Searching for an opponent…",
  waiting: "Waiting for your opponent to join…",
  matched: "Matched!",
  error: "",
};

export default function Lobby({ match }: { match: ReturnType<typeof useMatch> }) {
  const [username, setUsername] = useState("");
  const [joinMatchId, setJoinMatchId] = useState("");
  const [joinCode, setJoinCode] = useState("");

  return (
    <section className="lobby">
      {!match.identity ? (
        <div className="register-panel panel">
          <p className="register-admit hud-label">Admit one</p>
          <h2 className="register-title">Enter the draft</h2>
          <input
            className="register-input"
            data-testid="username"
            placeholder="print name here"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="register-button"
            data-testid="register"
            disabled={!username}
            onClick={() => void match.register(username)}
          >
            Register
          </button>
          <p className="register-blurb">
            100 credits · 5 seats · blind bids · best lineup wins
          </p>
        </div>
      ) : (
        <div className="mm-grid">
          <div className="mm-ranked">
            <p className="mm-sub">Tonight · one night only</p>
            <h2 className="mm-title">Ranked duel</h2>
            <button
              className="mm-find"
              data-testid="find-ranked"
              disabled={match.status === "searching"}
              onClick={() => void match.findRankedMatch()}
            >
              {match.status === "searching" ? (
                <>
                  Searching
                  <span className="mm-cursor" aria-hidden="true">
                    ▌
                  </span>
                </>
              ) : (
                "Find Ranked Match"
              )}
            </button>
            <p className="mm-sub">You vs the next name in the queue</p>
          </div>
          <div className="panel mm-challenge">
            <h3 className="mm-title-sm">Challenge booth</h3>
            <button
              className="btn-secondary"
              data-testid="create-challenge"
              onClick={() => void match.createChallenge()}
            >
              Create Challenge
            </button>
            <div className="mm-divider" role="presentation">
              or join with a code
            </div>
            <div className="mm-join">
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
                className="btn-secondary"
                data-testid="join-challenge"
                disabled={!joinMatchId || !joinCode}
                onClick={() => void match.joinChallenge(joinMatchId, joinCode)}
              >
                Join Challenge
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="lobby-status" data-testid="status" data-status={match.status}>
        {STATUS_COPY[match.status]}
      </p>
      {match.error && (
        <p className="lobby-error" data-testid="error">
          {match.error}
        </p>
      )}
    </section>
  );
}
