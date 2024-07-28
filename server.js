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

    socket.on('getRooms', (currentRoom) => {
        const rooms = Object.keys(roomList).filter(room => room !== currentRoom);
        socket.emit('roomList', rooms);
    });

    socket.on('createRoom', ({username, room, isPublic, password}) => {
        if(!roomList[room]) {
            roomList[room] = {isPublic, password: isPublic ? null : password, users: []}
            userList[socket.id] = {username, room};
            roomList[room].users.push(username)
            socket.join(room);
            socket.emit('message', `ChatBot: Welcome, ${username}, to ${room}!`);
            io.to(room).emit('updateUserList', roomList[room].users);
            console.log(username, "created", room);
        } else {
            socket.emit('error', 'Sorry, that room already exists.');
        }
    })

    socket.on('joinRoom', ({username, room}) => {
        if(roomList[room]) {
            roomList[room].users.push(username);
            userList[socket.id] = {username, room};
            socket.join(room);
            socket.emit('message', `ChatBot: Welcome, ${username}, to ${room}!`);
            // Broadcast to the room that a new user has joined
            socket.broadcast.to(room).emit('message', `ChatBot: ${username} has joined the room!`);
            // Send the updated list of users to the room
            io.to(room).emit('updateUserList', roomList[room].users);
        } else {
            socket.emit('error', 'Sorry, that room does not exist.');
        }
    })

    socket.on('chatMessage', (message) => {
        const user = userList[socket.id];
        const userRoom = user.room;
        if (userRoom) {
            io.to(userRoom).emit('message', `${user.username}: ${message}`);
        }
    });

    socket.on('disconnect', () => {
        const user = userList[socket.id];
        if (user) {
            socket.leave(user.room);
            // Remove user from room
            roomList[user.room].users = roomList[user.room].users.filter(username => username !== user.username);
            // Broadcast to the room that a user has left
            socket.broadcast.to(user.room).emit('message', `ChatBot: ${user.username} has left the room D:`);
            // Send the updated list of users to the room
            io.to(user.room).emit('updateUserList', roomList[user.room].users);
            delete user;
        }
        console.log('A user disconnected:', socket.id);
    });
})