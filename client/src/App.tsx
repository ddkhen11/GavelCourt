import { useMatch } from "./hooks/useMatch";
import { useDuel } from "./hooks/useDuel";
import Lobby from "./components/Lobby";
import Leaderboard from "./components/Leaderboard";
import Board from "./components/Board";
import Lineup from "./components/Lineup";
import Results from "./components/Results";

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
            <Leaderboard />
          </>
        ) : (
          <>
            <p data-testid="match-id">{matchId}</p>
            {!duel.state.started && match.status === "waiting" && match.joinCode && (
              <p>
                Share match id <code>{matchId}</code> and code{" "}
                <code data-testid="challenge-code">{match.joinCode}</code>
              </p>
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
