import React, { useEffect, useState } from "react";
import { socket } from "../socket";
import Canvas from "../components/Canvas";
import Chat from "../components/Chat";
import PlayerList from "../components/PlayerList";

export default function GameRoom({ roomId, username, setRoomId, setUsername }) {
  console.log("GameRoom mounted with props:", { roomId, username });

  const [drawerId, setDrawerId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [timer, setTimer] = useState(80);
  const [hint, setHint] = useState("");
  const [roomWord, setRoomWord] = useState("");
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({});
  const [correctGuessers, setCorrectGuessers] = useState(new Set());
  const [hostId, setHostId] = useState(socket.id);   // default host = me
  const [gameStarted, setGameStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winners, setWinners] = useState([]);
  const [finalScores, setFinalScores] = useState({});

  useEffect(() => {
    console.log("GameRoom useEffect: registering socket listeners. ID:", socket.id);

    socket.on("startRound", ({ drawerId, imageUrl }) => {
      setDrawerId(drawerId);
      setImageUrl(null);
      setTimeout(() => setImageUrl(imageUrl), 50);
    });

    socket.on("timer", setTimer);
    socket.on("hintUpdate", setHint);
    socket.on("drawerWord", setRoomWord);

    socket.on("roomData", (room) => {
      console.log("ROOMDATA in GameRoom:", room);
      setPlayers(room.players);
      setScores(room.scores);
      setCorrectGuessers(new Set(room.correctGuessers));
      if (room.hostId) {
        setHostId(room.hostId);
      }
      if (typeof room.currentRound === "number") {
        setCurrentRound(room.currentRound);
      }
      if (typeof room.totalRounds === "number") {
        setTotalRounds(room.totalRounds);
      }
      if (typeof room.gameOver === "boolean") {
        setGameOver(room.gameOver);
        if (!room.gameOver) {
          setWinners([]);
          setFinalScores({});
        }
      }
      if (typeof room.gameStarted === "boolean") {
        setGameStarted(room.gameStarted);
      }
    });

    socket.on("gameOver", ({ winners, scores, maxScore, totalRounds }) => {
      setGameOver(true);
      setGameStarted(false);
      setWinners(winners || []);
      setFinalScores(scores || {});
      if (typeof totalRounds === "number") {
        setTotalRounds(totalRounds);
      }
      // Timer is effectively done at game over
    });

    return () => {
      socket.off("startRound");
      socket.off("timer");
      socket.off("hintUpdate");
      socket.off("drawerWord");
      socket.off("roomData");
      socket.off("gameOver");
    };
  }, []);

  const startGame = () => {
    if (gameOver) return;
    socket.emit("startGame", roomId);
    setGameStarted(true);
  };

  const backToLobby = () => {
    if (setRoomId) setRoomId(null);
    if (setUsername) setUsername("");
  };

  const restartGame = () => {
    if (socket.id !== hostId) return;
    socket.emit("restartGame", roomId, () => {
      setGameOver(false);
      setGameStarted(true);
      setWinners([]);
      setFinalScores({});
      setCurrentRound(1);
      setTimer(80);
      setHint("");
      setRoomWord("");
    });
  };

  return (
    <div className="game-container">
      {/* LEFT */}
      <div className="left-panel dl-panel">
        <PlayerList
          players={players}
          scores={scores}
          correctGuessers={correctGuessers}
        />

        <div className="left-panel-buttons">
          {socket.id === hostId && (
            <button
              className="dl-btn"
              onClick={() => {
                const link = `${window.location.origin}?room=${roomId}`;
                navigator.clipboard.writeText(link);
                alert("Invite link copied!");
              }}
            >
              Copy Invite Link
            </button>
          )}

          {socket.id === hostId && !gameStarted && (
            <button className="dl-btn" onClick={startGame}>
              Start Game
            </button>
          )}

          {gameOver && (
            <>
              <button className="dl-btn" onClick={backToLobby}>
                Back to Lobby
              </button>
              {socket.id === hostId && (
                <button className="dl-btn" onClick={restartGame}>
                  Play Again
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* CENTER */}
      <div className="center-panel dl-panel">
        <h2 style={{
          marginBottom: "10px"
        }}>
          Room: {roomId} | You: {username}
        </h2>
        <h3>
          Time: {timer}
          {totalRounds > 0 && (
            <span style={{ marginLeft: "16px" }}>
              Round: {currentRound}/{totalRounds}
            </span>
          )}
        </h3>
        <h3
          style={{
            fontSize: "18px",
            marginBottom: "10px",
            whiteSpace: "pre",
          }}
        >
          Hint: {socket.id === drawerId ? roomWord : hint}
        </h3>

        {gameOver && (
          <div
            style={{
              marginBottom: "12px",
              padding: "8px 12px",
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: "6px",
              color: "#e6d7b8",
            }}
          >
            <strong>Game Over!</strong>
            {winners && winners.length > 0 ? (
              <>
                {" "}
                Winner{winners.length > 1 ? "s" : ""}: {winners.join(", ")}
                {" "}
                ({Math.max(0, ...Object.values(finalScores || {}))} points)
              </>
            ) : (
              " No winner determined."
            )}
          </div>
        )}

        <div className="canvas-wrapper">
          <Canvas roomId={roomId} drawerId={drawerId} />
        </div>
      </div>

      {/* RIGHT */}
      <div className="right-panel dl-panel">
        <Chat roomId={roomId} username={username} />

        {socket.id === drawerId && imageUrl && (
          <div className="character-image-box">
            <img
              src={imageUrl}
              alt="Character"
              className="character-image"
            />
          </div>
        )}
      </div>
    </div>
  );
}
