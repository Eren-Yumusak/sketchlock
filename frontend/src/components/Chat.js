import React, { useState, useEffect } from "react";
import { socket } from "../socket";

export default function Chat({ roomId, username }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    socket.on("chatMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("correctGuess", (name) => {
      setMessages((prev) => [
        ...prev,
        {
          username: name,
          message: "✔ Correct!",
          correct: true
        }
      ]);
    });


    return () => {
      socket.off("chatMessage");
      socket.off("correctGuess");
    };
  }, []);

  const sendMessage = () => {
    if (!text) return;

    socket.emit("guess", { roomId, message: text, username });
    setText("");
  };

  return (
    <div style={{ padding: "10px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ height: "400px", overflowY: "scroll", border: "2px solid #493d34", marginBottom: "10px", padding: "5px", background: "rgba(30, 26, 22, 0.86)" }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              color: m.correct ? "green" : "#e6d7b8",
              fontWeight: m.correct ? "bold" : "normal",
              textAlign: "left",
              marginBottom: "2px",
              marginLeft: "4px"
            }}
          >
            <strong>{m.username}: </strong>{m.message}
          </div>
        ))}
      </div>

      <div style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "4px"
      }}>
      <input className="dl-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Guess..."
      />
      <button className="dl-btn" onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
