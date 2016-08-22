( function(){
  angular.module("app", [
    "ngRoute",
    "component.modal",
    "component.answer",
    "service.network",
    "service.question",
    "directive.choice",
    "modal-views.waiting",
    "modal-views.userleft",
    "pages.home",
    "pages.game"
  ])
  .config(["$routeProvider", "$locationProvider", function($route, $locationProvider){
    $route
    .when("/", {
      templateUrl: "views/home.html",
      controller: "homePageCtrl"
    })
    .when("/game", {
      templateUrl: "views/game.html",
      controller: "gamePageCtrl"
    })
    ;
    $locationProvider.html5Mode(true).hashPrefix('!');
  }]);

  angular.module("pages.home", [])
  .controller("homePageCtrl", ["$scope", function($scope){
  }]);

  angular.module("pages.game", [])
  .controller("gamePageCtrl", ["$scope", "$rootScope", "modalService", "$timeout", "networkService", "answerService", "questionService", function($scope, $rootScope, modalService, $timeout, networkService, answerService, questionService){
    modalService.openModal({
      close: false,
      body: "Please hold tight while we find another player. This dialog will go away when you are connected.",
      title: "Finding Another player."
      //templateUrl: "views/test.html"
    });
    $scope.question = questionService.get().question;
    networkService.initSocket();
    networkService.on("START", function(data){
      if(networkService.getRoom() !== "join") return;
      networkService.setRoom(data.room);
      questionService.setQuestion(data.question);
      $scope.question = data.question;
      $timeout(function(){
        $scope.$apply();
      });
      modalService.close();
    });
    networkService.on("COMPLETE", function(data){
      if(!modalService.isOpen()) return;

      if (data.same) {
        questionService.setQuestion(data.question);
        $scope.question = questionService.get().question;

        $timeout(function(){
          $scope.$apply();
        });
      }
      modalService.close();
      if(!data.same) networkService.disconnect();
      answerService.openDialog(data.same);
    })
    networkService.on("user_disconnected", function(data){
      //open modal telling them to find new game
      networkService.disconnect();
      modalService.openModal({
        close: false,
        title: "User Left",
        templateUrl: "views/userleft.html",
        controller: "userLeftCtrl",
      });
    });

    $scope.$on('$destroy', function(){
      networkService.disconnect();
    });

    //modalService.close();

  }]);

  angular.module("service.question", [])
  .factory("questionService", [function(){
    var curQuestion = {
      question: "Question",
      a: "Is this the answer?",
      b: "Or is this the answer?"
    };

    var picked = "";

    var service = {
      setQuestion: function(question){
        curQuestion = question;
      },
      setPicked: function(pick){
        picked = pick;
      },
      get: function(){
        return {question: curQuestion, picked: picked};
      }
    };

    return service;
  }]);

  angular.module("service.network", [])
  .factory("networkService", [function(){
    var socket = null;
    var room = "join";
    var service = {
      initSocket: function(){
        socket = io();
        socket.on('connect', function() {
          //socket.emit("PING", {});
          //console.log('check 2', socket.connected);
          socket.emit("room", {room_name: "join"});
        });
      },
      on: function(what, func){
        socket.on(what, func);
      },
      send: function(what, data){
        socket.emit(what, data);
      },
      setRoom: function(name){
        room = name;
      },
      getRoom: function(){
        return room;
      },
      disconnect: function(){
        socket.disconnect();
      }
    };

    return service;
  }]);

  angular.module("directive.choice", [])
  .directive("choice", function($document, modalService, questionService, networkService){
    return {
      scope: {
        c: "@"
      },
      template: '<div class="button" ng-bind="c"></div>',
      restrict: "E",
      replace: true,
      link: function(scope, element, attrs){
        element.on("click", function(e){
          if(element.hasClass("picked")) return;
          //remove the other button.
          var picked = "", pos = "";
          if(element.parent().hasClass("a")) {
            $document.find(".pa .b div:last").hide();
            picked = "A";
            pos = "right";
          } else{
            $document.find(".pa .a div:last").hide();
            picked = "B";
            pos = "left";
          }
          element.addClass("picked");
          questionService.setPicked(picked);
          networkService.send("PICKED", {qid: questionService.get().question.id, picked: picked, room: networkService.getRoom()});
          modalService.openModal({
            close: false,
            backdrop: false,
            pos: pos,
            title: "Waiting on other player...",
            //body: "You picked choice " + picked + ". You are now waiting on the other player to pick their answer. Just hope you guys agree on the same answer. If you don't it is game over."
            templateUrl: "views/waiting.html",
            controller: "waitingCtrl"
          });
          scope.$on("NEW_CHOICE", function(){
            element.removeClass("picked");
            $document.find(".pa .a div:last").show();
            $document.find(".pa .b div:last").show();
          });
        });
      }
    };
  });

  angular.module("component.answer", [])
  .factory("answerService", ["$document", "$rootScope", "$compile", function($document, $rootScope, $compile){
    var body = $document.find("body"), el, scope, cor;
    var service = {
      openDialog: function(correct){
        cor = correct;
        el = angular.element("<results correct=\""+cor+"\"></results>")
        scope = $rootScope.$new();
        body.append(el);
        $compile(el)(scope);
      },
      close: function(){
        if(el) el.remove();
        scope.$destroy();
      }
    };

    return service;
  }])
  .directive("results", function(){
    return {
      restrict: "E",
      replace: true,
      scope: {
        correct: "="
      },
      controller: "resultsCtrl",
      templateUrl: "views/results.html"
    };
  })
  .controller("resultsCtrl", ["$scope", "$rootScope", "answerService", "$timeout", function($scope, $rootScope, answerService, $timeout){
    $scope.next = function(){
      console.log("next");
      $rootScope.$broadcast("NEW_CHOICE");
      answerService.close();
    };

    $scope.newGame = function(){
      $timeout(function(){
        window.location = "/game";
      });
    };
  }]);

  angular.module("modal-views.waiting", [])
  .controller("waitingCtrl", ["$scope", "modalService", "$rootScope", "answerService", "questionService", function($scope, modalService, $rootScope, answerService, questionService){
    $scope.picked = questionService.get().picked;
    $scope.test =  "FAKE DONE";
    $scope.fakeit = function(){
      // get answer from Server
      modalService.close();
      answerService.openDialog(true);
    };
  }]);

  angular.module("modal-views.userleft", [])
  .controller("userLeftCtrl", ["$scope", function($scope){
    $scope.new = function(){
      window.location = "/game";
    }
  }]);

  angular.module("component.modal", [])
  .factory("modalService", ["$document", "$rootScope", "$templateRequest", "$compile", function($document, $rootScope, $templateRequest, $compile){
    var _config, body = $document.find("body"), el, scope;
    var service = {
      openModal: function(config) {
        _config = config;

        if(typeof _config.close === "undefined")
          _config.close = true;

        if(typeof _config.pos === "undefined")
            _config.pos = "center";

        if(typeof _config.backdrop === "undefined")
            _config.backdrop = true;

        if (el) service.close();

        el = angular.element('<modal />');

        scope = $rootScope.$new();

        if(config.title) {
          scope.title = config.title;
        }

        $compile(el)(scope);
      },

      finishSetup: function(s, element, attrs){
        var b = element.find(".body")

        if(_config.templateUrl){
          $templateRequest(_config.templateUrl).then(function(html){
             var _el = angular.element(html);
             if(_config.controller) _el.attr("ng-controller", _config.controller);
             $compile(_el)(s);
             b.html(_el);
          });
        }

        if(_config.body){
           b.text(_config.body);
           b.addClass("added")
        }

        if(!_config.close) {
          element.find(".close").remove();
        }

        var modal = element.find(".modal");
        modal.addClass("modal-"+_config.pos);
        if(!_config.backdrop) modal.addClass("modal-nbd");

        body.append(element);
      },

      canClose: function() {
        return _config.close;
      },

      close: function() {
        if (el) {
          el.remove();
          el = null;
        }
        scope.$destroy();
      },

      isOpen: function(){
        return el !== null
      },

      getData: function() {
        return _config.data || {};
      }
    };
    return service;
  }])
  .directive("modal", function(modalService){
    return {
      templateUrl: "views/modal.html",
      controller: "modalCtrl",
      link: {
        pre: function(scope, element, attrs){
          modalService.finishSetup(scope, element, attrs);
        },

        post: function(scope, element, attrs) {
          //do the intereactivity for the modal here
          if(modalService.canClose()){
            element.on("click", function(e){
              //close modal
              if(e.target.className === "modal" || e.target.className === "close") {
                modalService.close();
              }
            });
          }
        }
      }
    };
  })
  .controller("modalCtrl", ["$scope", "modalService", "$rootScope", function($scope, modalService, $rootScope){
  }]);
})();
