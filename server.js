const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

const rooms = {};

function initCoins() {
    let arr = [];
    let centers = [[400,400],[360,360],[440,360],[360,440],[440,440],[310,310],[490,310],[310,490],[490,490]];
    for (let i = 0; i < centers.length; i++) {
        arr.push({ x: centers[i][0], y: centers[i][1], r: 14, vx: 0, vy: 0, pocketed: false, type: i === 0 ? 'queen' : (i % 2 === 0 ? 'black' : 'white') });
    }
    return arr;
}

io.on("connection", (socket) => {
    socket.on("joinRoom", (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = { players: { p1: { score: 0, id: socket.id }, p2: null }, coins: initCoins(), striker: { x: 400, y: 740, r: 16, vx: 0, vy: 0, active: true }, currentTurn: "p1" };
            rooms[roomId].players.p1.id = socket.id;
            socket.join(roomId);
            socket.emit("roomJoined", { roomId, playerId: "p1", gameState: null });
        } else if (!rooms[roomId].players.p2) {
            rooms[roomId].players.p2 = { score: 0, id: socket.id };
            socket.join(roomId);
            socket.emit("roomJoined", { roomId, playerId: "p2", gameState: rooms[roomId] });
            io.to(roomId).emit("stateUpdate", rooms[roomId]);
        } else socket.emit("roomJoined", { roomId, playerId: null, error: "Full" });
    });

    socket.on("shot", ({ roomId, strikerState, coinsState }) => {
        let room = rooms[roomId];
        if (room) { room.striker = strikerState; room.coins = coinsState; io.to(roomId).emit("stateUpdate", room); }
    });

    socket.on("turnEnd", (roomId) => {
        let room = rooms[roomId];
        if (room) { room.currentTurn = room.currentTurn === "p1" ? "p2" : "p1"; io.to(roomId).emit("turnChange", room.currentTurn); }
    });

    socket.on("scoreUpdate", ({ roomId, player, newScore }) => {
        if (rooms[roomId]) { rooms[roomId].players[player].score = newScore; io.to(roomId).emit("stateUpdate", rooms[roomId]); }
    });

    socket.on("resetGame", (roomId) => {
        if (rooms[roomId]) { rooms[roomId].coins = initCoins(); rooms[roomId].striker = { x: 400, y: 740, r: 16, vx: 0, vy: 0, active: true }; rooms[roomId].currentTurn = "p1"; rooms[roomId].players.p1.score = 0; rooms[roomId].players.p2.score = 0; io.to(roomId).emit("stateUpdate", rooms[roomId]); }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
