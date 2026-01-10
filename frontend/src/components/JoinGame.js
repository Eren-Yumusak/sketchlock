import React, { useState, useEffect } from "react";

export default function JoinGame({ onJoin, roomIdPrefill = "" }) {
  const [code, setCode] = useState(roomIdPrefill);
  const [name, setName] = useState("");

  useEffect(() => {
    if (roomIdPrefill) setCode(roomIdPrefill);
  }, [roomIdPrefill]);

  const join = () => {
    if (!name || !code) {
      alert("Enter your name and game code");
      return;
    }

    onJoin(code, name);
  };

  return (
    <div>
      <h2>Join Game</h2>

      <input
        className="dl-input"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <br /><br />

      <input
        className="dl-input"
        placeholder="Game Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <br /><br />

      <button className="lobby-btn" onClick={join}>Join</button>
    </div>
  );
}
