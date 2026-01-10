import { socket } from "../socket";
import { useEffect, useState } from "react";

export default function BrowseGames({ onJoin }) {
  const [games, setGames] = useState([]);

  useEffect(() => {
    // Ensure socket is connected
    if (!socket.connected) socket.connect();

    socket.emit("browseGames", (available) => {
      setGames(available);
    });
  }, []);

  return (
    <div>
      <h2>Open Games</h2>

      {games.length === 0 && <p>No public games available.</p>}

      {games.map(g => (
        <div
          key={g.roomId}
          style={{
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div>
            <strong>{g.name}</strong> ({g.playerCount} players)
          </div>
          <button
            className="dl-btn"
            style={{ whiteSpace: "nowrap" }}
            onClick={() => onJoin(g.roomId)}
          >
            Join
          </button>
        </div>
      ))}
    </div>
  );
}
