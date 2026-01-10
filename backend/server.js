const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const characters = require("./characters");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// Round + scoring configuration
const ROUND_DURATION = 80; // seconds per round
const MAX_GUESS_POINTS = 150; // points for very fast guess
const MIN_GUESS_POINTS = 50; // points for very late guess
const DRAWER_POINTS_PER_GUESS = 50; // drawer reward when everyone guesses

const rooms = {};
const games = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // ---------------------------------------------------------
  // CREATE GAME: HOST AUTO-JOINS
  // ---------------------------------------------------------
  socket.on(
    "createGame",
    ({ gameName, visibility, username, rounds }, callback) => {
    const roomId = generateRoomCode();

    const totalRounds = Math.max(1, parseInt(rounds || 5, 10));

    games[roomId] = {
      name: gameName,
      visibility,
      host: username,
      players: [],
      createdAt: Date.now(),
      totalRounds,
    };

    rooms[roomId] = {
      players: [],
      hostId: null,
      scores: {},
      drawerIndex: 0,
      currentWord: "",
      imageUrl: "",
      time: ROUND_DURATION,
      timerInterval: null,
      correctGuessers: new Set(),
      revealedLetters: new Set(),
      maxHints: 0,
      gameStarted: false,
      totalRounds,
      currentRound: 0,
      gameOver: false,
      lastCharacterIndex: null,
    };

    callback?.({ roomId });
  }
  );

  // ---------------------------------------------------------
  // JOIN EXISTING GAME
  // ---------------------------------------------------------
  socket.on("joinRoom", ({ roomId, username }, callback) => {
    const room = rooms[roomId];
    if (!room) {
      callback?.({ error: "Room does not exist." });
      return;
    }

    socket.join(roomId);

    if (!room.players.find((p) => p.id === socket.id)) {
      room.players.push({ id: socket.id, username });
    }

    if (!room.hostId) room.hostId = socket.id;

    if (!room.scores[username]) room.scores[username] = 0;

    if (games[roomId] && !games[roomId].players.includes(username)) {
      games[roomId].players.push(username);
    }

    sendRoomData(roomId);
    callback?.({ success: true, roomId });
  });

  // ---------------------------------------------------------
  // BROWSE PUBLIC GAMES
  // ---------------------------------------------------------
  socket.on("browseGames", (callback) => {
    const publicGames = Object.entries(games)
      .filter(([_, g]) => g.visibility === "public")
      .map(([id, g]) => ({
        roomId: id,
        name: g.name,
        host: g.host,
        playerCount: g.players.length,
      }));

    callback(publicGames);
  });

  // ---------------------------------------------------------
  // START GAME (HOST ONLY)
  // ---------------------------------------------------------
  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    if (socket.id !== room.hostId) return;

    // Ignore if game already finished or already running
    if (room.gameOver || room.gameStarted) return;

    room.gameStarted = true;
    room.currentRound = 1;
    startRound(roomId);
  });

  // ---------------------------------------------------------
  // DRAW + GUESS
  // ---------------------------------------------------------
  socket.on("draw", (data) => {
    socket.to(data.roomId).emit("draw", data);
  });

  socket.on("guess", ({ roomId, username, message }) => {
    const room = rooms[roomId];
    if (!room) return;

    const drawer = room.players[room.drawerIndex];
    if (drawer && drawer.id === socket.id) return;

    const cleaned = message.toLowerCase().trim();
    const target = room.currentWord.toLowerCase();

    if (cleaned === target) {
      room.correctGuessers.add(username);
      const ratio = Math.max(
        0,
        Math.min(1, room.time / ROUND_DURATION)
      );
      const guessPoints = Math.round(
        MIN_GUESS_POINTS + (MAX_GUESS_POINTS - MIN_GUESS_POINTS) * ratio
      );

      room.scores[username] = (room.scores[username] || 0) + guessPoints;

      io.to(roomId).emit("correctGuess", username);

      const totalGuessers = room.players.length - 1;
      if (
        totalGuessers > 0 &&
        room.correctGuessers.size >= totalGuessers &&
        drawer && drawer.username
      ) {
        const drawerPoints = DRAWER_POINTS_PER_GUESS * totalGuessers;
        room.scores[drawer.username] =
          (room.scores[drawer.username] || 0) + drawerPoints;

        sendRoomData(roomId);

        if (room.timerInterval) {
          clearInterval(room.timerInterval);
          room.timerInterval = null;
        }
        endRound(roomId);
      } else {
        sendRoomData(roomId);
      }

      return;
    }

    io.to(roomId).emit("chatMessage", { username, message });
  });

  // ---------------------------------------------------------
  // UNDO (send full updated history)
  // ---------------------------------------------------------
  socket.on("undo", ({ roomId, history }) => {
    io.to(roomId).emit("updateHistory", { history });
  });

  // ---------------------------------------------------------
  // BUCKET FILL (send clicked coords + color)
  // ---------------------------------------------------------
  socket.on("bucketFill", (data) => {
    socket.to(data.roomId).emit("bucketFill", data);
  });

  // ---------------------------------------------------------
  // RESTART GAME (HOST ONLY)
  // ---------------------------------------------------------
  socket.on("restartGame", (roomId, callback) => {
    const room = rooms[roomId];
    if (!room) return;
    if (socket.id !== room.hostId) return;

    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }

    // Reset scores for all current players
    const newScores = {};
    room.players.forEach((p) => {
      newScores[p.username] = 0;
    });
    room.scores = newScores;

    room.drawerIndex = 0;
    room.currentWord = "";
    room.imageUrl = "";
    room.time = ROUND_DURATION;
    room.correctGuessers = new Set();
    room.revealedLetters = new Set();
    room.maxHints = 0;
    room.gameOver = false;
    room.gameStarted = true;
    room.currentRound = 1;

    sendRoomData(roomId);
    startRound(roomId);

    callback?.({ success: true });
  });
});

// ---------------------------------------------------------
// ROUND LOGIC
// ---------------------------------------------------------
function startRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return;

  if (room.gameOver) return;

  let index;
  if (characters.length === 1) {
    index = 0;
  } else {
    do {
      index = Math.floor(Math.random() * characters.length);
    } while (index === room.lastCharacterIndex);
  }

  const character = characters[index];
  room.lastCharacterIndex = index;

  room.currentWord = character.word;
  room.imageUrl = character.image;
  room.time = ROUND_DURATION;
  room.correctGuessers = new Set();
  room.revealedLetters = new Set();
  room.maxHints = Math.ceil(room.currentWord.length / 3);

  const drawer = room.players[room.drawerIndex];

  io.to(roomId).emit("clearCanvas");

  io.to(roomId).emit("startRound", {
    drawerId: drawer.id,
    imageUrl: character.image,
  });

  io.to(drawer.id).emit("drawerWord", room.currentWord);

  sendRoomData(roomId);

  const hint = generateHintPattern(room.currentWord, room.revealedLetters);
  io.to(roomId).emit("hintUpdate", hint);

  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    room.time--;
    io.to(roomId).emit("timer", room.time);

    if ([50, 30, 10].includes(room.time)) revealLetter(roomId);

    if (room.time <= 0) {
      clearInterval(room.timerInterval);
      endRound(roomId);
    }
  }, 1000);
}

function sendRoomData(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  io.to(roomId).emit("roomData", {
    players: room.players,
    scores: room.scores,
    correctGuessers: Array.from(room.correctGuessers),
    hostId: room.hostId,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    gameOver: room.gameOver,
    gameStarted: room.gameStarted,
  });
}

function generateHintPattern(word, revealedLetters) {
  return word
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      return revealedLetters.has(i) ? ch : "_";
    })
    .join(" ");
}

function revealLetter(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.revealedLetters.size >= room.maxHints) return;

  const word = room.currentWord;
  const options = [...word]
    .map((_, i) => i)
    .filter((i) => !room.revealedLetters.has(i));

  if (options.length === 0) return;

  const index = options[Math.floor(Math.random() * options.length)];
  room.revealedLetters.add(index);

  const hint = generateHintPattern(word, room.revealedLetters);
  io.to(roomId).emit("hintUpdate", hint);
}

function endRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.gameOver) return;

  // Advance drawer for next potential round
  if (room.players.length > 0) {
    room.drawerIndex = (room.drawerIndex + 1) % room.players.length;
  }

  if (room.currentRound >= room.totalRounds) {
    finishGame(roomId);
  } else {
    room.currentRound += 1;
    setTimeout(() => startRound(roomId), 800);
  }
}

function finishGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.gameOver = true;
   room.gameStarted = false;

   if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  const scores = room.scores || {};
  const scoreValues = Object.values(scores);
  const maxScore = scoreValues.length
    ? Math.max(...scoreValues)
    : 0;

  const winners = Object.keys(scores).filter(
    (name) => scores[name] === maxScore
  );

  io.to(roomId).emit("gameOver", {
    winners,
    scores,
    maxScore,
    totalRounds: room.totalRounds,
  });

  sendRoomData(roomId);
}

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
