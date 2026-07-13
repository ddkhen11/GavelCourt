import { useState } from "react";
import { useMatch } from "./hooks/useMatch";
import { useDuel } from "./hooks/useDuel";
import Lobby from "./components/Lobby";
import Leaderboard from "./components/Leaderboard";
import Board from "./components/Board";
import Lineup from "./components/Lineup";
import Results from "./components/Results";

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-secondary copy-btn"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function App() {
  const match = useMatch();
  const duel = useDuel(match.identity, match.matchId);
  const { matchId } = match;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="topbar-logo">
          NBA <span className="topbar-logo-accent">Auction Draft</span>
        </h1>
        {match.identity && (
          <p className="topbar-user" data-testid="identity">
            Playing as <strong>{match.identity.username}</strong>
          </p>
        )}
      </header>

      <main className="shell">
        {matchId === null ? (
          <>
            <Lobby match={match} />
            <Leaderboard currentUsername={match.identity?.username} />
          </>
        ) : (
          <>
            <p className="match-meta">
              <span className="hud-label">Match</span>{" "}
              <code data-testid="match-id" className="match-id">
                {matchId}
              </code>
            </p>
            {!duel.state.started && match.status === "waiting" && match.joinCode && (
              <div className="panel waiting-room">
                <h2 className="waiting-title">Challenge created</h2>
                <p className="waiting-sub">
                  Send your friend the match id and join code.
                </p>
                <div className="code-row">
                  <div className="code-chip">
                    <span className="hud-label">match id</span>
                    <code>{matchId}</code>
                    <CopyButton label="Copy" text={matchId} />
                  </div>
                  <div className="code-chip">
                    <span className="hud-label">join code</span>
                    <code data-testid="challenge-code">{match.joinCode}</code>
                    <CopyButton label="Copy" text={match.joinCode} />
                  </div>
                </div>
              </div>
            )}

            {!duel.state.ended ? (
              <>
                <Board
                  state={duel.state}
                  sendReady={duel.sendReady}
                  sendBid={duel.sendBid}
                  sendPass={duel.sendPass}
                />
                {duel.state.started && (
                  <Lineup
                    players={duel.state.lineup}
                    rosterSize={duel.state.rosterSize}
                  />
                )}
              </>
            ) : (
              <Results
                ended={duel.state.ended}
                rosterSize={duel.state.rosterSize}
                onPlayAgain={match.reset}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
