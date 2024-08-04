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
    'N/A': {isPublic : true, password: null, users: []},
    'Lobby': {isPublic: true, password: null, users: []},
};

io.on('connection', socket => {
    console.log('A user has joined:', socket.id);

    socket.on('getRooms', (currentRoom) => {
        const rooms = Object.keys(roomList).filter(room => room !== currentRoom);
        socket.emit('roomList', rooms);
    });

    socket.on('getUsers', () => {
        const users = Object.values(userList).map(user => user.username);
        socket.emit('userList', users);
    });

    socket.on('createRoom', ({username, room, isPublic, password}) => {
        if(!roomList[room]) {
            roomList[room] = {isPublic, password: isPublic ? null : password, users: []}
            userList[socket.id] = {username, room};
            roomList[room].users.push(username)
            socket.join(room);
            socket.emit('message',  { type: 'public', text: `ChatBot: Welcome, ${username}, to ${room}!`});
            io.to(room).emit('updateUserList', roomList[room].users);
            console.log(username, "created", room);
        } else {
            socket.emit('error', 'Sorry, that room already exists.');
        }
    })

    socket.on('requestJoinRoom', ({username, room}) => {
        if(roomList[room]){
            if(!roomList[room].isPublic) {
                socket.emit('requestPassword', room);
            } else {
                socket.emit('joinRoomClient', {username, room, password: null});
            }
        } else {
            socket.emit('error', 'Sorry, that room does not exist.');
        }
    })

    socket.on('joinRoom', ({username, room, password}) => {
        const currentRoom = userList[socket.id]?.room;
        if(roomList[room]) {
            if(!roomList[room].isPublic && roomList[room].password !== password) {
                socket.emit('error', 'Incorrect password.');
                return;
            }
            if (currentRoom) {
                roomList[currentRoom].users = roomList[currentRoom].users.filter(user => user !== username);
                io.to(currentRoom).emit('updateUserList', roomList[currentRoom].users.map(user => {
                    const userSocketId = Object.keys(userList).find(id => userList[id].username === user);
                    return { username: user, userSocketId };
                }));
                socket.leave(currentRoom);
                socket.broadcast.to(currentRoom).emit('message',  { type: 'public', text: `ChatBot: ${username} has left the room D:`});
            }
            socket.emit('goToChatRoom', room);
            roomList[room].users.push(username);
            userList[socket.id] = {username, room};
            socket.join(room);
            socket.emit('message',  { type: 'public', text: `ChatBot: Welcome, ${username}, to ${room}!`});
            // broadcast to the room that a new user has joined
            socket.broadcast.to(room).emit('message',  { type: 'public', text: `ChatBot: ${username} has joined the room!`});
            // send the updated list of users to the room
            io.to(room).emit('updateUserList', roomList[room].users.map(user => {
                const userSocketId = Object.keys(userList).find(id => userList[id].username === user);
                return { username: user, userSocketId };
            }));
        } else {
            socket.emit('error', 'Sorry, that room does not exist.');
        }
    })

    socket.on('chatMessage', (message) => {
        const user = userList[socket.id];
        if (user) {
            const userRoom = user.room;
            io.to(userRoom).emit('message', { type: 'public', text: `${user.username}: ${message}` });
        }
    });
    
    socket.on('privateMessage', ({ to, message }) => {
        const fromUser = userList[socket.id].username;
        io.to(to).emit('privateMessage', { from: fromUser, message });
        socket.emit('privateMessageSent', { to, message });
    });

    socket.on('disconnect', () => {
        const user = userList[socket.id];
        if (user) {
            socket.broadcast.to(user.room).emit('message',  { type: 'public', text: `ChatBot: ${user.username} has left the room D:`});
            socket.leave(user.room);
            roomList[user.room].users = roomList[user.room].users.filter(username => username !== user.username);
            io.to(user.room).emit('updateUserList', roomList[user.room].users.map(user => {
                const userSocketId = Object.keys(userList).find(id => userList[id].username === user);
                return { username: user, userSocketId };
            }));
            delete userList[socket.id];
        }
        console.log('A user disconnected:', socket.id);
    });
})