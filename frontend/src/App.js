import React, { useState } from "react";
import Lobby from "./components/Lobby";
import GameRoom from "./pages/GameRoom";

function App() {
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState("");

  return (
     <div
      className="app-background" 
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL}/images/background.webp)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        width: "100%",
      }}
    >
    <>
      {!roomId ? (
        <Lobby setRoomId={setRoomId} setUsername={setUsername} />
      ) : (
        <GameRoom
          roomId={roomId}
          username={username}
          setRoomId={setRoomId}
          setUsername={setUsername}
        />
      )}
    </>
    </div>
  );
}

export default App;
