'use strict';
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { create } = require('./game-logic');

const app = express();
app.get('/', (_req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/client.js', (_req, res) => res.sendFile(__dirname + '/client.js'));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] }, transports: ['websocket','polling'] });
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const zeroInput = () => ({thr:0,steer:0,boost:false,jump:false,jumpHeld:false,slide:false,roll:0});
function code() { let s; do { s=''; for(let i=0;i<5;i++) s+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]; } while(rooms.has(s)); return s; }
function safePlayer(p) {
  const allowed = new Set(['octane','dominus','breakout','merc','hotshot']);
  return { name: String(p?.name || 'Jugador').replace(/[<>\u0000-\u001f]/g,'').slice(0,14) || 'Jugador', body: allowed.has(p?.body) ? p.body : 'octane' };
}
function emitSnapshot(room) {
  if (!room.engine || room.players.length !== 2) return;
  const raw = room.engine.snap();
  const b = raw.b;
  const cars = raw.c.map((c,i) => ({
    p:c.slice(0,3), q:c.slice(3,7), v:c.slice(7,10), n:c.slice(10,13), boost:c[13],
    onS:!!(c[14]&1), bst:!!(c[14]&2), dead:!!(c[14]&4), steer:c[15]
  }));
  io.to(room.code).emit('snapshot', {
    state: ['count','play','goal','end'][raw.s] || 'count', st: raw.st,
    timeLeft: raw.tl, overtime: !!raw.ot, score: raw.sc,
    ball:{p:b.slice(0,3),q:b.slice(3,7),v:b.slice(7,10)}, cars
  });
}
function startRoom(room) {
  if (room.engine || room.players.length !== 2) return;
  room.engine = create(room.players.map((p, team) => ({team, name:p.info.name, body:p.info.body})));
  room.inputs = [zeroInput(),zeroInput()];
  room.lastTick = Date.now();
  room.players.forEach((p,team) => io.to(p.id).emit('roomReady',{code:room.code,team}));
  room.timer = setInterval(() => {
    if (room.players.length !== 2 || !room.engine) return;
    // Fixed-step authoritative physics. Cap catch-up to avoid runaway after a server pause.
    const now = Date.now();
    let steps = Math.min(5, Math.max(1, Math.floor((now-room.lastTick)/16.6667)));
    room.lastTick = now;
    for (let i=0;i<steps;i++) room.engine.step(1/60, room.inputs);
    emitSnapshot(room);
    if (room.engine.state === 'end') {
      clearInterval(room.timer); room.timer = null;
      setTimeout(() => { if (rooms.get(room.code)===room && room.players.length===2) { room.engine=null; startRoom(room); } }, 6000);
    }
  }, 33);
}
function removePlayer(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code); socket.data.roomCode = null;
  if (!room) return;
  room.players = room.players.filter(p => p.id !== socket.id);
  if (room.timer) clearInterval(room.timer);
  room.timer = null; room.engine = null;
  io.to(room.code).emit('opponentLeft');
  if (room.players.length === 0) rooms.delete(room.code);
  else room.players.forEach(p => io.to(p.id).emit('roomWaiting',{code:room.code}));
}
io.on('connection', socket => {
  socket.on('createRoom', payload => {
    if (socket.data.roomCode) removePlayer(socket);
    const c = code(); const room = {code:c,players:[{id:socket.id,info:safePlayer(payload)}],engine:null,inputs:[zeroInput(),zeroInput()],timer:null,lastTick:Date.now()};
    rooms.set(c,room); socket.join(c); socket.data.roomCode=c;
    socket.emit('roomCreated',{code:c});
  });
  socket.on('joinRoom', payload => {
    const c = String(payload?.code || '').toUpperCase().trim(); const room = rooms.get(c);
    if (!room) return socket.emit('roomError',{message:'No existe esa sala. Comprueba el código.'});
    if (room.players.length >= 2) return socket.emit('roomError',{message:'La sala está llena.'});
    if (room.players.some(p=>p.id===socket.id)) return;
    if (socket.data.roomCode) removePlayer(socket);
    room.players.push({id:socket.id,info:safePlayer(payload?.player)});
    socket.join(c); socket.data.roomCode=c;
    startRoom(room);
  });
  socket.on('input', payload => {
    const c = socket.data.roomCode, room = rooms.get(c);
    if (!room || !room.engine || payload?.code !== c) return;
    const team = room.players.findIndex(p=>p.id===socket.id); if (team < 0) return;
    const i = payload.input || {};
    // Validate and clamp all client controls before passing them into the physics simulation.
    room.inputs[team] = {
      thr: Math.max(-1,Math.min(1,Number(i.thr)||0)),
      steer: Math.max(-1,Math.min(1,Number(i.steer)||0)),
      boost: !!i.boost, jump: !!i.jump, jumpHeld: !!i.jumpHeld,
      slide: !!i.slide, roll: Math.max(-1,Math.min(1,Number(i.roll)||0))
    };
  });
  socket.on('disconnect', () => removePlayer(socket));
});
server.listen(PORT, '0.0.0.0', () => console.log(`Rocket Arena server listening on ${PORT}`));
