import React from "react";

export default function PlayerList({ players, scores, correctGuessers }) {
  // Sort by score descending
  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.username] || 0) - (scores[a.username] || 0)
  );

  return (
    <div className="dl-panel"
    >
      <h3>Players</h3>
      {sortedPlayers.map((p) => (
        <div
          key={p.id}
          style={{
            marginBottom: "8px",
            color: correctGuessers?.has(p.username) ? "green" : "#e6d7b8",
            fontWeight: correctGuessers?.has(p.username) ? "bold" : "normal",
          }}
        >
          {p.username} — {scores[p.username] || 0}
          {correctGuessers?.has(p.username) && " ✔"}
        </div>
      ))}
    </div>
  );
}
