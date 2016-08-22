var express = require('express');
var path = require('path');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var questions = [
  {
    id: 1,
    question: "What is 1+1=?",
    a: "2",
    b: "4",
    answer:  "a"
  },
];

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
      f.join(room);
      s.join(room);
      var quest = questions[0];
      quest.answer = null;
      socket.emit("START", {room: room, question: quest});
    }
    connected++;
  }
}

io.on('connection', function(socket){
  console.log('a user connected', socket.id);
  socket.leave(socket.id); //I don't want to to auto create a room based on the client id.
  socket.join("join");

  //time to match them up with a player
  var len = io.sockets.adapter.rooms.join.length;
  if(len >= 2) matchUpClients(socket);

  socket.on('disconnect', function(){
    //what room where they on
    console.log('user disconnected');
  });
});

http.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

module.exports = app;
