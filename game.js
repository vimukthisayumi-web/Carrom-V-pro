const canvas = document.getElementById('carromCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 800;

let coins = [];
let striker = { x: 400, y: 740, r: 16, vx: 0, vy: 0, active: true };
let currentPlayer = "p1";
let players = { p1: { score: 0, id: null }, p2: { score: 0, id: null } };
let myPlayerId = null;
let roomId = null;
let gameOver = false;
let dragging = false;
let dragX, dragY;
let animationId = null;

const socket = io();

const pockets = [[50,50],[750,50],[50,750],[750,750],[400,40],[400,760],[40,400],[760,400]];

function initCoins() {
    let arr = [];
    let centers = [[400,400],[360,360],[440,360],[360,440],[440,440],[310,310],[490,310],[310,490],[490,490]];
    for (let i = 0; i < centers.length; i++) {
        arr.push({ 
            x: centers[i][0], 
            y: centers[i][1], 
            r: 14, 
            vx: 0, 
            vy: 0, 
            pocketed: false, 
            type: i === 0 ? 'queen' : (i % 2 === 0 ? 'black' : 'white') 
        });
    }
    return arr;
}

function resetLocalGame() {
    coins = initCoins();
    striker = { x: 400, y: 740, r: 16, vx: 0, vy: 0, active: true };
    gameOver = false;
    if (animationId) cancelAnimationFrame(animationId);
    draw();
}

function draw() {
    ctx.clearRect(0, 0, 800, 800);
    ctx.fillStyle = '#f9e3b3';
    ctx.fillRect(0, 0, 800, 800);
    
    for (let p of pockets) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 25, 0, Math.PI * 2);
        ctx.fillStyle = '#8b5a2b';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p[0], p[1], 18, 0, Math.PI * 2);
        ctx.fillStyle = '#5a3a1a';
        ctx.fill();
    }
    
    for (let c of coins) {
        if (c.pocketed) continue;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r - 1, 0, Math.PI * 2);
        if (c.type === 'black') ctx.fillStyle = '#2c2c2c';
        else if (c.type === 'queen') ctx.fillStyle = '#ffaa44';
        else ctx.fillStyle = '#f5f5dc';
        ctx.fill();
        ctx.strokeStyle = '#bc8f6b';
        ctx.stroke();
        if (c.type === 'queen') {
            ctx.fillStyle = '#000';
            ctx.font = 'bold 16px monospace';
            ctx.fillText("Q", c.x - 5, c.y + 6);
        }
    }
    
    ctx.beginPath();
    ctx.arc(striker.x, striker.y, striker.r - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#e34d2b';
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText("S", striker.x - 7, striker.y + 7);
    
    if (dragging) {
        ctx.beginPath();
        ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(dragX, dragY);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}

function updatePhysics() {
    if (gameOver) return;
    let moving = false;
    
    if (Math.abs(striker.vx) > 0.05 || Math.abs(striker.vy) > 0.05) moving = true;
    striker.vx *= 0.98;
    striker.vy *= 0.98;
    striker.x += striker.vx;
    striker.y += striker.vy;
    
    for (let c of coins) {
        if (c.pocketed) continue;
        if (Math.abs(c.vx) > 0.03 || Math.abs(c.vy) > 0.03) moving = true;
        c.vx *= 0.985;
        c.vy *= 0.985;
        c.x += c.vx;
        c.y += c.vy;
        
        if (c.x - c.r < 40) { c.x = 40 + c.r; c.vx *= -0.6; }
        if (c.x + c.r > 760) { c.x = 760 - c.r; c.vx *= -0.6; }
        if (c.y - c.r < 40) { c.y = 40 + c.r; c.vy *= -0.6; }
        if (c.y + c.r > 760) { c.y = 760 - c.r; c.vy *= -0.6; }
        
        for (let p of pockets) {
            let dx = c.x - p[0], dy = c.y - p[1];
            if (Math.hypot(dx, dy) < 25) {
                c.pocketed = true;
                let gain = c.type === 'queen' ? 3 : 1;
                if (myPlayerId) {
                    players[myPlayerId].score += gain;
                    updateScoresUI();
                    socket.emit("scoreUpdate", { roomId, player: myPlayerId, newScore: players[myPlayerId].score });
                }
                break;
            }
        }
    }
    
    if (striker.x - striker.r < 40) { striker.x = 40 + striker.r; striker.vx *= -0.5; }
    if (striker.x + striker.r > 760) { striker.x = 760 - striker.r; striker.vx *= -0.5; }
    if (striker.y - striker.r < 40) { striker.y = 40 + striker.r; striker.vy *= -0.5; }
    if (striker.y + striker.r > 760) { striker.y = 760 - striker.r; striker.vy *= -0.5; }
    
    for (let i = 0; i < coins.length; i++) {
        for (let j = i + 1; j < coins.length; j++) {
            let a = coins[i], b = coins[j];
            if (a.pocketed || b.pocketed) continue;
            let dx = a.x - b.x, dy = a.y - b.y;
            let dist = Math.hypot(dx, dy);
            if (dist < a.r + b.r) {
                let angle = Math.atan2(dy, dx);
                let overlap = (a.r + b.r - dist) / 2;
                a.x += Math.cos(angle) * overlap;
                a.y += Math.sin(angle) * overlap;
                b.x -= Math.cos(angle) * overlap;
                b.y -= Math.sin(angle) * overlap;
            }
        }
    }
    
    draw();
    
    if (moving) {
        animationId = requestAnimationFrame(updatePhysics);
    } else {
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        if (!gameOver && myPlayerId === currentPlayer) {
            socket.emit("turnEnd", roomId);
            document.getElementById("turnStatus").innerText = "Waiting for opponent...";
            striker.active = false;
        }
    }
}

function handleDragStart(e) {
    if (gameOver || myPlayerId !== currentPlayer || !striker.active) return;
    let pos = getMousePos(e);
    if (Math.hypot(pos.x - striker.x, pos.y - striker.y) < striker.r + 10) {
        dragging = true;
    }
}

function handleDragMove(e) {
    if (!dragging) return;
    let pos = getMousePos(e);
    dragX = pos.x;
    dragY = pos.y;
    draw();
}

function handleDragEnd(e) {
    if (!dragging) return;
    dragging = false;
    let pos = getMousePos(e);
    let powerX = striker.x - pos.x;
    let powerY = striker.y - pos.y;
    let force = Math.min(16, Math.hypot(powerX, powerY) / 8);
    striker.vx = powerX * 0.42 * force;
    striker.vy = powerY * 0.42 * force;
    striker.active = false;
    updatePhysics();
    socket.emit("shot", {
        roomId,
        strikerState: { x: striker.x, y: striker.y, vx: striker.vx, vy: striker.vy },
        coinsState: coins.map(c => ({ x: c.x, y: c.y, vx: c.vx, vy: c.vy, pocketed: c.pocketed, type: c.type, r: c.r }))
    });
}

function getMousePos(e) {
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function updateScoresUI() {
    document.getElementById("score1").innerText = players.p1.score;
    document.getElementById("score2").innerText = players.p2.score;
    const p1Card = document.getElementById("player1Card");
    const p2Card = document.getElementById("player2Card");
    
    if (currentPlayer === "p1") {
        p1Card.classList.add("active");
        p2Card.classList.remove("active");
    } else {
        p2Card.classList.add("active");
        p1Card.classList.remove("active");
    }
    
    if (myPlayerId === currentPlayer && !gameOver) {
        document.getElementById("turnStatus").innerText = "🎯 Drag & Shoot!";
    } else if (!gameOver) {
        document.getElementById("turnStatus").innerText = "⏳ Opponent's Turn...";
    }
}

socket.on("connect", () => {
    let room = prompt("Enter Room ID (or type 'new' for new room):", "new");
    if (room === "new") room = Math.floor(Math.random() * 10000).toString();
    roomId = room;
    socket.emit("joinRoom", room);
});

socket.on("roomJoined", ({ roomId: joinedRoom, playerId, gameState }) => {
    myPlayerId = playerId;
    document.getElementById("roomInfo").innerHTML = `🏠 Room: ${joinedRoom} | You are ${playerId.toUpperCase()}`;
    if (gameState && gameState.coins) {
        coins = gameState.coins;
        striker = gameState.striker;
        players = gameState.players;
        currentPlayer = gameState.currentTurn;
        updateScoresUI();
        draw();
    }
});

socket.on("stateUpdate", (data) => {
    coins = data.coins;
    striker = data.striker;
    players = data.players;
    currentPlayer = data.currentTurn;
    updateScoresUI();
    draw();
});

socket.on("turnChange", (turn) => {
    currentPlayer = turn;
    if (currentPlayer === myPlayerId && !gameOver) {
        striker.active = true;
        striker.vx = 0;
        striker.vy = 0;
    }
    updateScoresUI();
    draw();
});

document.getElementById("resetBtn").onclick = () => {
    resetLocalGame();
    socket.emit("resetGame", roomId);
};

document.getElementById("copyLinkBtn").onclick = () => {
    let link = window.location.href.split('?')[0] + "?room=" + roomId;
    navigator.clipboard.writeText(link);
    alert("🔗 Invite link copied!\nSend this to your friend: " + link);
};

canvas.addEventListener("mousedown", handleDragStart);
window.addEventListener("mousemove", handleDragMove);
window.addEventListener("mouseup", handleDragEnd);
canvas.addEventListener("touchstart", handleDragStart);
window.addEventListener("touchmove", handleDragMove);
window.addEventListener("touchend", handleDragEnd);

resetLocalGame();
draw();
