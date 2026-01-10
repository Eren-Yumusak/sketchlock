import React, { useState } from "react";
import { socket } from "../socket";

export default function CreateGame({ onCreated }) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [username, setUsername] = useState("");
  const [rounds, setRounds] = useState(5);

  const create = () => {
    if (!username) {
      alert("Enter your name!");
      return;
    }

    if (!socket.connected) socket.connect();

    socket.emit(
      "createGame",
      {
        gameName: name || "Untitled Game",
        visibility,
        username,
        rounds: Number(rounds) || 1,
      },
      (response) => {
        console.log("CreateGame callback:", response);

        if (response?.roomId) {
          // Host will now join the room via Lobby.enterRoom
          onCreated(response.roomId, username);
        } else {
          alert("Failed to create game.");
        }
      }
    );
  };

  return (
    <div>
      <h2>Create Game</h2>

      <input className="dl-input"
        placeholder="Your Name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <br /><br />

      <input className="dl-input"
        placeholder="Game Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <br /><br />

      <label>
        Rounds:
        <input
          className="dl-input"
          type="number"
          min="1"
          max="20"
          value={rounds}
          onChange={(e) => setRounds(e.target.value)}
          style={{ marginLeft: "8px", width: "60px" }}
        />
      </label>
      <br /><br />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          marginTop: 8,
          marginBottom: 16,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            checked={visibility === "public"}
            onChange={() => setVisibility("public")}
          />
          Public
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
          />
          Private
        </label>
      </div>

      <button className="dl-btn" onClick={create}>Create</button>
    </div>
  );
}
