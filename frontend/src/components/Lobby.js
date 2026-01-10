import React, { useState, useEffect } from "react";
import { socket } from "../socket";
import CreateGame from "./CreateGame";
import JoinGame from "./JoinGame";
import BrowseGames from "./BrowseGames";

export default function Lobby({ setRoomId, setUsername }) {
  const [mode, setMode] = useState("menu");
  const [prefillRoom, setPrefillRoom] = useState("");

  // Detect invite links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteRoom = params.get("room");

    if (inviteRoom) {
      setPrefillRoom(inviteRoom);
      setMode("join");
    }
  }, []);

  const goBack = () => setMode("menu");

  // Only friends joining use this
  const enterRoom = (roomId, username) => {
    if (!socket.connected) socket.connect();

    socket.emit("joinRoom", { roomId, username }, (response) => {
      console.log("joinRoom callback:", response);
      if (response?.error) return alert(response.error);

      setUsername(username);
      setRoomId(roomId);
    });
  };

  return (
    <div className="lobby-wrapper">

      {/* MENU */}
      {mode === "menu" && (
        <div className="deadlock-panel">

          <img src="/images/sketchlock_logo.webp" className="lobby-logo" alt="logo" />

          <h1 className="lobby-title">SKETCHLOCK</h1>

          <div className="lobby-buttons">
            <button className="lobby-btn" onClick={() => setMode("create")}>Create Game</button>
            <button className="lobby-btn" onClick={() => setMode("join")}>Join via Code</button>
            <button className="lobby-btn" onClick={() => setMode("browse")}>Browse Games</button>
          </div>

        </div>
      )}

      {/* CREATE */}
      {mode === "create" && (
        <div className="deadlock-panel">
          <button className="back-btn" onClick={goBack}>←</button>

          <CreateGame
            onCreated={(roomId, username) => {
              enterRoom(roomId, username);    // host joins via joinRoom
            }}
          />
        </div>
      )}

      {/* JOIN */}
      {mode === "join" && (
        <div className="deadlock-panel">
          <button className="back-btn" onClick={goBack}>←</button>

          <JoinGame
            roomIdPrefill={prefillRoom}
            onJoin={(roomId, username) => enterRoom(roomId, username)}
          />
        </div>
      )}

      {/* BROWSE */}
      {mode === "browse" && (
        <div className="deadlock-panel">
          <button className="back-btn" onClick={goBack}>←</button>

          <BrowseGames
            onJoin={(roomId) => {
              const username = prompt("Enter your name:");
              if (username) enterRoom(roomId, username);
            }}
          />
        </div>
      )}
    </div>
  );
}
