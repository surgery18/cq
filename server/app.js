var express = require('express');
var path = require('path');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = process.env.PORT || 3000;

var questions = [
  {
    question: "What is 1+1=?",
    a: "2",
    b: "4",
    answer: "a"
  },
  {
    question: "Is the world flat?",
    a: "Yes",
    b: "No",
    answer: "b"
  },
];

var roomMap = {};

app.use(express.static(path.join(__dirname + "/..")));

// app.get("/test", function(req, res){
//   res.send("THIS IS A TEST");
// });

app.use("/*", function(req, res){
  //res.send();
  res.sendFile(path.join(__dirname + '/../index.html'));
});

function matchUpClients(socket){
  var join = io.sockets.adapter.rooms.join;
  //console.log("WE HAVE ENOUGH TO START!");

  //how many clients can we match up?
  var numToConnect = join.length/2;

  var connected = 0;

  //connect each player with each other.
  while(connected < numToConnect) {
    var f = io.sockets.connected[Object.keys(join.sockets)[0]];
    var s = io.sockets.connected[Object.keys(join.sockets)[1]];

    //generate a room
    if(f && s){
      var room = Date.now();
      f.leave(f.room.name);
      s.leave(s.room.name);
      f.join(room);
      s.join(room);
      var r = room;
      roomMap[r] = {
        waiting: 2,
        answer: null,
        round: 0
      };
      f.room = r;
      s.room = r;
      var quest = JSON.parse(JSON.stringify(questions[0]));
      quest.id = 0;
      quest.answer = null;
      io.to(room).emit("START", {room: room, question: quest});
    }
    connected++;
  }
}

io.on('connection', function(socket){
  console.log('a user connected', socket.id);
  socket.leave(socket.id); //I don't want to to auto create a room based on the client id.
  socket.join("join");
  socket.room = "join";
  //time to match them up with a player
  var len = io.sockets.adapter.rooms.join.length;
  if(len >= 2) matchUpClients(socket);

  socket.on('disconnect', function(){
    //what room where they on and remove it
    //not needed any more
    if (roomMap.room) {
      roomMap[socket.room] = null;
      delete roomMap[socket.room];
    }
    socket.leave(socket.room);
    io.to(socket.room).emit("user_disconnected");
    socket.disconnect();
    socket.room = null;
    delete socket.room;

    console.log('user disconnected', socket.id);
  });

  socket.on('PICKED', function(data){
    var quest = questions[data.qid];
    var correct = data.picked.toLowerCase() == quest.answer.toLowerCase();
    var you = {answer: data.picked, correct: correct};

    if(roomMap[socket.room].answer != null) {
      roomMap[socket.room].answer = (correct && roomMap[socket.room].answer);
    } else {
      roomMap[socket.room].answer = correct;
    }

    roomMap[socket.room].waiting--;
    // if(rooms[data.room.id].waiting == 0) {
    if(roomMap[socket.room].waiting == 0) {
      var q = JSON.parse(JSON.stringify(questions[1]));
      q.answer = null;
      q.id = 1;
      io.to(socket.room).emit("COMPLETE", {question: q, same: roomMap[socket.room].answer})
      //reset it
      if (roomMap[socket.room].answer) {
        roomMap[socket.room].waiting = 2;
        roomMap[socket.room].round++;
        roomMap[socket.room].answer = null;
      } else {
        //not needed any more
        roomMap[socket.room] = null;
        delete roomMap[socket.room];
      }
    }
  });
});

http.listen(port, function () {
  console.log('Example app listening on port 3000!');
});

module.exports = app;
