const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const users = {};

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    socket.on("join", (username) => {
        username = username.trim();

        const taken = Object.values(users).some(
            user => user.toLowerCase() === username.toLowerCase()
        );

        if (taken) {
            socket.emit("usernameError", "That username is already in use.");
            return;
        }

        users[socket.id] = username;

        socket.emit("joined", username);

        io.emit("systemMessage", `${username} joined the chat!`);
        io.emit("users", Object.values(users));
    });

    socket.on("sendMessage", (message) => {
        const username = users[socket.id];

        if (!username || !message.trim()) return;

        io.emit("message", {
            username,
            text: message.trim()
        });
    });

    // =========================
    // VIDEO CHAT SIGNALING
    // =========================

    socket.on("join-video", () => {
        socket.join("video-room");

        const otherUsers = [];

        for (const socketId of socket.rooms) {
            // nothing
        }

        const room = io.sockets.adapter.rooms.get("video-room");

        if (room) {
            room.forEach((id) => {
                if (id !== socket.id) {
                    otherUsers.push({
                        socketId: id,
                        username: users[id] || "Unknown"
                    });
                }
            });
        }

        socket.emit("video-users", otherUsers);

        socket.to("video-room").emit("video-user-joined", {
            socketId: socket.id,
            username: users[socket.id] || "Unknown"
        });
    });

    socket.on("video-offer", ({ target, offer }) => {
        io.to(target).emit("video-offer", {
            sender: socket.id,
            offer
        });
    });

    socket.on("video-answer", ({ target, answer }) => {
        io.to(target).emit("video-answer", {
            sender: socket.id,
            answer
        });
    });

    socket.on("ice-candidate", ({ target, candidate }) => {
        io.to(target).emit("ice-candidate", {
            sender: socket.id,
            candidate
        });
    });

    socket.on("leave-video", () => {
        socket.leave("video-room");

        socket.to("video-room").emit("video-user-left", socket.id);
    });

    // =========================

    socket.on("disconnect", () => {
        const username = users[socket.id];

        if (username) {
            delete users[socket.id];

            io.emit("systemMessage", `${username} left the chat.`);
            io.emit("users", Object.values(users));
        }

        socket.to("video-room").emit("video-user-left", socket.id);

        console.log("Disconnected:", socket.id);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`ViChat running on port ${PORT}`);
});