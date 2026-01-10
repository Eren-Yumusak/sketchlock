## Sketchlock

Multiplayer drawing and guessing game with Deadlock-inspired characters. One player draws a randomly selected character while the others race to guess the name before the timer runs out. Rounds, scoring, and a lobby system make it suitable for casual play with friends.

### Features

- Real-time drawing canvas with brush, eraser, bucket fill, and undo.
- Socket.io multiplayer lobby with:
  - Create / join by room code.
  - Browse public games.
- Configurable number of rounds per game.
- Time-based scoring for guessers and bonus points for the drawer when everyone guesses correctly.
- Scoreboard and automatic winner announcement at the end of the match.
- Character roster loaded from the backend (backend/characters.js), including support for multi-word names and hint patterns that reflect word spacing.

### Tech Stack

- Frontend: React (Create React App), socket.io-client.
- Backend: Node.js, Express, Socket.io.
- Styling: Custom Deadlock-themed CSS.


### Gameplay

1. From the lobby, choose:
	- Create Game: pick a name, visibility (public or private), your display name, and number of rounds.
	- Join via Code: enter a room code shared by a friend.
	- Browse Games: view and join public rooms.
2. Once everyone has joined, the host starts the game.
3. Each round:
	- One player is the drawer and sees the character name and reference image.
	- Other players use the chat input to submit guesses.
	- Correct guesses award points based on remaining time.
	- If all guessers are correct, the drawer receives bonus points.
4. After the configured number of rounds, the game ends and the player with the highest score is declared the winner.
