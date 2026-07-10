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
    <main>
      <h1>NBA Auction Draft</h1>

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
  );
}
