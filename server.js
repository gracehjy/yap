const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// set static folder
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 4000 || process.env.PORT;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
});

// RUN WHEN CLIENTS CONNECT
// socket.on listens for a call and returns something
// socket.emit calls a function

const userList = {}; //keeps track of username to room mapping
const roomList = {
    'Test Room': {isPublic: false, password: null, users: []},
};

io.on('connection', socket => {
    console.log('A user has joined:', socket.id);

    socket.on('getRooms', () => {
        const rooms = Object.keys(roomList);
        socket.emit('roomList', rooms);
    });

    socket.on('createRoom', ({username, room, isPublic, password}) => {
        if(!roomList[room]) {
            roomList[room] = {isPublic, password: isPublic ? null : password, users: []}
            userList[socket.id] = {username, room};
            roomList[room].users.push(username);
            socket.join(room);
            io.to(room).emit('message', `ChatBot: ${username} has joined the room.`);
            io.to(room).emit('updateUserList', roomList[room].users);
            console.log(username, "created", room);
        } else {
            socket.emit('error', 'Sorry, that room already exists.');
        }
    })

    socket.on('joinRoom', ({username, room}) => {
        if(roomList[room]) {
            userList[socket.id] = {username, room};
            roomList[room].users.push(username);
            socket.join(room);
            io.to(room).emit('message', `ChatBot: ${username} has joined the room.`);
            io.to(room).emit('updateUserList', roomList[room].users)
            console.log(username, "joined", room);
        } else {
            socket.emit('error', 'Sorry, that room does not exist.');
        }
    })

    socket.on('chatMessage', (message) => {
        const user = userList[socket.id];
        if (user) {
            const { username, room } = user;
            const fullMessage = `${username}: ${message}`;
            io.to(room).emit('message', fullMessage);
        }
    });

    socket.on('disconnect', () => {
        const user = userList[socket.id]
        if(user) {
            const {username, room} = user;
            roomList[room].users = roomList[room].users.filter(user => user !== username);
            io.to(room).emit('updateUserList', roomList[room].users);
            io.to(room).emit('message', `ChatBot: ${username} has left the room.`);
            console.log(username, "left", room);
            delete userList[socket.id];
        }
        console.log('A user disconnected:', socket.id);
    })
})