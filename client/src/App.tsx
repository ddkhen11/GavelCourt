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

  const inDuel = match.matchId !== null;

  return (
    <main>
      <h1>NBA Auction Draft</h1>

      {!inDuel && (
        <>
          <Lobby match={match} />
          <Leaderboard />
        </>
      )}

      {inDuel && match.matchId && (
        <p data-testid="match-id">{match.matchId}</p>
      )}
      {inDuel && !duel.state.started && match.status === "waiting" && match.joinCode && (
        <p>
          Share match id <code>{match.matchId}</code> and code{" "}
          <code data-testid="challenge-code">{match.joinCode}</code>
        </p>
      )}

      {inDuel && !duel.state.ended && (
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
      )}

      {inDuel && duel.state.ended && (
        <Results ended={duel.state.ended} rosterSize={duel.state.rosterSize} />
      )}
    </main>
  );
}
