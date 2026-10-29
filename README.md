# Rocket Arena 3D — Online 1v1

This package adds a real online 1v1 mode to the supplied `index (2).html`, reusing the game's 3D rendering and the supplied `game-logic.js` for server-side physics. The server is authoritative: clients send controls; the server simulates the match and broadcasts snapshots.

## Run locally

1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `index.html` from a local static server (recommended: VS Code Live Server) or host the page. In the ONLINE panel, use `http://localhost:3000` as the server address.
6. Open the game in two browser windows/devices. In the first, click ONLINE → Crear sala. In the second, enter the room code → Unirse.

Do not use `file://` if your browser blocks scripts; use a static web server.

## Deploy the server to Render

Create a new **Web Service** using this folder/repository.
- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node

Render provides `PORT` automatically. Once deployed, copy the service URL (for example `https://your-service.onrender.com`) into the server address field on both players' ONLINE screens. Keep the page itself hosted separately if desired.

## Current scope / honest limitations

- Implements online 1v1 room codes, server-authoritative car/ball physics, snapshots, disconnect handling and a health endpoint.
- Offline game is kept in `index.html` and should continue to work.
- This is a first multiplayer integration, not a polished production service: it has no accounts, ranked matchmaking, chat, anti-cheat beyond server-side physics/input validation, or persistent stats. If you want to extend it, test in two real browsers after deployment.
