/* Rocket Arena Online client — Socket.IO + server-authoritative snapshots */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let socket = null, myTeam = 0, roomCode = '', lastSend = 0, lastSnap = null;
  let connected = false, matchStarted = false;
  const SERVER_DEFAULT = (location.protocol === 'https:' ? 'https://' + location.hostname : 'http://localhost:3000');

  function panel() {
    const root = $('onl');
    if (!root) return;
    root.innerHTML = `
      <div style="width:100%;display:flex;flex-direction:column;gap:10px">
        <p style="margin:0;color:#b8c8ef;text-align:center">Partidas online 1 contra 1. El servidor controla la física para que ambos jugadores vean el mismo partido.</p>
        <label style="font-size:13px;color:#a9badf">Dirección del servidor</label>
        <input id="onl-server" value="${SERVER_DEFAULT}" placeholder="https://tu-servidor.onrender.com" style="box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid #43527a;background:#0b1024;color:white;font:inherit">
        <button id="onl-create" class="big">Crear sala</button>
        <div style="display:flex;gap:8px"><input id="onl-code" maxlength="6" placeholder="CÓDIGO" style="min-width:0;flex:1;text-transform:uppercase;padding:12px;border-radius:10px;border:1px solid #43527a;background:#0b1024;color:white;font:inherit;text-align:center;letter-spacing:3px"><button id="onl-join" class="big" style="flex:1">Unirse</button></div>
        <div id="onl-status" role="status" style="min-height:24px;text-align:center;color:#b8c8ef">Listo para conectar.</div>
        <button id="onl-leave" style="display:none">Salir de la partida</button>
      </div>`;
    $('onl-create').onclick = () => connectAndCreate();
    $('onl-join').onclick = () => connectAndJoin(($('onl-code').value || '').trim().toUpperCase());
    $('onl-code').addEventListener('keydown', e => { if (e.key === 'Enter') connectAndJoin(($('onl-code').value || '').trim().toUpperCase()); });
    $('onl-leave').onclick = () => leaveOnline(true);
  }
  function status(s, bad=false) {
    const n = $('onl-status'); if (n) { n.textContent = s; n.style.color = bad ? '#ff8c8c' : '#b8c8ef'; }
  }
  function serverUrl() {
    let value = ($('onl-server')?.value || SERVER_DEFAULT).trim();
    if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
    return value.replace(/\/$/, '');
  }
  function connect() {
    if (typeof window.io !== 'function') { status('No se pudo cargar Socket.IO. Comprueba tu conexión.', true); return false; }
    if (socket) { socket.disconnect(); socket = null; }
    connected = false; matchStarted = false;
    const url = serverUrl();
    status('Conectando con ' + url + '…');
    try { socket = window.io(url, { transports: ['websocket', 'polling'], timeout: 10000, reconnection: false }); }
    catch (e) { status('No se pudo iniciar la conexión: ' + e.message, true); return false; }
    socket.on('connect', () => { connected = true; status('Conectado. Preparando sala…'); });
    socket.on('connect_error', () => status('No conecta. Revisa la URL y que el servidor esté encendido.', true));
    socket.on('disconnect', () => {
      connected = false;
      if (matchStarted) { ONL.on = false; matchStarted = false; status('Se perdió la conexión con el servidor.', true); }
    });
    socket.on('roomCreated', data => { roomCode = data.code; status('Sala creada: ' + roomCode + '. Pasa el código a tu rival. Esperando…'); if ($('onl-code')) $('onl-code').value = roomCode; });
    socket.on('roomWaiting', data => { roomCode = data.code; status('Sala ' + roomCode + ': esperando al segundo jugador…'); });
    socket.on('roomError', data => status(data?.message || 'No se pudo entrar en la sala.', true));
    socket.on('roomReady', data => {
      roomCode = data.code; myTeam = data.team; status('¡Rival conectado! Cargando partido…');
      beginMatch(data);
    });
    socket.on('snapshot', snap => { lastSnap = snap; });
    socket.on('opponentLeft', () => { status('Tu rival ha salido de la sala.', true); ONL.on = false; matchStarted = false; });
    return true;
  }
  function connectAndCreate() {
    if (!connect()) return;
    const send = () => { if (socket && connected) socket.emit('createRoom', playerInfo()); else setTimeout(send, 150); };
    socket.once('connect', send);
  }
  function connectAndJoin(code) {
    if (!/^[A-Z0-9]{4,6}$/.test(code)) { status('Escribe un código de sala válido (4–6 letras o números).', true); return; }
    if (!connect()) return;
    const send = () => { if (socket && connected) socket.emit('joinRoom', { code, player: playerInfo() }); else setTimeout(send, 150); };
    socket.once('connect', send);
  }
  function playerInfo() {
    return { name: (CFG.name || 'Jugador').slice(0,14), body: CFG.body || 'octane', color: Number(CFG.c1 || 0x1e6bff) };
  }
  function beginMatch(data) {
    if (matchStarted) return;
    try {
      M.mode = 'soccer'; M.size = 1; M.min = 5; M.turbo = 'normal'; M.ball = 1;
      startMatch();
      // Existing 3D cars/rendering are reused. The server decides all positions and outcomes.
      cars.forEach((c, i) => { c.human = i === myTeam; c.wall = i === myTeam; c.name = i === myTeam ? (CFG.name || 'Tú') : 'Rival'; });
      player = cars[myTeam]; player.cfg = CFG; player.team = myTeam;
      const tags = $('tags');
      if (tags) { tags.innerHTML=''; cars.forEach(c => { const d=document.createElement('div'); d.className='tag'; d.textContent=c.name; d.style.color=c.team?'#ffb060':'#7ab0ff'; tags.appendChild(d); c.tag=d; }); }
      score = [0,0]; timeLeft = 300; overtime = false; ONL.on = true; matchStarted = true;
      go('');
      status('Partido en marcha · Sala ' + roomCode);
      if ($('onl-leave')) $('onl-leave').style.display = 'block';
      initAudio();
    } catch (e) { status('Error al iniciar la partida: ' + e.message, true); console.error(e); }
  }
  ONL.send = function(now) {
    if (!socket || !connected || !matchStarted || !player) return;
    if (now - lastSend < 33) return;
    lastSend = now;
    const i = inputFor();
    socket.emit('input', { code: roomCode, input: i });
  };
  ONL.apply = function() {
    if (!lastSnap || !matchStarted) return;
    const s = lastSnap; lastSnap = null;
    if (s.state) {
      const map = {count:'count', play:'play', goal:'goal', end:'end'};
      if (map[s.state]) setState(map[s.state]);
      if (typeof s.st === 'number') st = s.st;
      if (typeof s.timeLeft === 'number') timeLeft = s.timeLeft;
      if (Array.isArray(s.score)) score = s.score.slice(0,2);
      overtime = !!s.overtime;
    }
    const b = s.ball;
    if (b && b.p && b.q && b.v) {
      ball.pos.set(b.p[0],b.p[1],b.p[2]); ball.mesh.position.copy(ball.pos); ball.mesh.quaternion.set(b.q[0],b.q[1],b.q[2],b.q[3]); ball.vel.set(b.v[0],b.v[1],b.v[2]); if(ball.sh){ball.sh.position.set(ball.pos.x,.04,ball.pos.z);ball.sh.scale.setScalar(Math.max(.4,1-ball.pos.y/30));}
    }
    if (Array.isArray(s.cars)) s.cars.forEach((v,i) => {
      const c = cars[i]; if (!c || !v) return;
      if (v.p) c.pos.set(v.p[0],v.p[1],v.p[2]);
      if (v.q) c.q.set(v.q[0],v.q[1],v.q[2],v.q[3]);
      if (v.v) c.vel.set(v.v[0],v.v[1],v.v[2]);
      if (v.n) c.n.set(v.n[0],v.n[1],v.n[2]);
      if (typeof v.boost === 'number') c.boost = v.boost;
      if (typeof v.onS === 'boolean') c.onS = v.onS;
      if (typeof v.bst === 'boolean') c.bst = v.bst;
      c.steerIn = v.steer || 0;
    });
  };
  ONL.leave = function() { leaveOnline(true); };
  ONL.back = function() { leaveOnline(false); go('home'); };
  ONL.rematch = function() { if (socket && connected) socket.emit('rematch', {code:roomCode}); };
  function leaveOnline(disconnect) {
    ONL.on = false; matchStarted = false; lastSnap = null;
    if (socket) { if (disconnect) socket.disconnect(); socket = null; }
    connected = false;
    if (typeof toMenu === 'function') toMenu();
    if ($('onl-leave')) $('onl-leave').style.display = 'none';
    status('Has salido de la partida.');
  }
  document.addEventListener('DOMContentLoaded', panel);
  // The page's inline script runs before this file; DOMContentLoaded may already be queued safely.
  if (document.readyState !== 'loading') panel();
})();
