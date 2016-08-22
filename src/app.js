( function(){
  angular.module("app", [
    "ngRoute",
    "component.modal",
    "component.answer",
    "service.network",
    "directive.choice",
    "modal-views.waiting",
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
  .controller("gamePageCtrl", ["$scope", "modalService", "$timeout", "networkService", "answerService", function($scope, modalService, $timeout, networkService, answerService){
    modalService.openModal({
      close: false,
      body: "Please hold tight while we find another player. This dialog will go away when you are connected.",
      title: "Finding Another player."
      //templateUrl: "views/test.html"
    });
    var room = "join";
    $scope.question = {
      question: "Question",
      a: "Is this the answer?",
      b: "Or is this the answer?"
    };
    // networkService.initSocket();
    // networkService.on("START", function(data){
    //   room = data.room;
    //   $scope.question = data.question;
    //   $timeout(function(){
    //     $scope.$apply();
    //   });
    //   modalService.close();
    // });
    modalService.close();

  }]);

  angular.module("service.network", [])
  .factory("networkService", [function(){
    var socket = null;
    var service = {
      initSocket: function(){
        socket = io();
        socket.on('connect', function() {
          //socket.emit("PING", {});
          console.log('check 2', socket.connected);
          socket.emit("room", {room_name: "join"});
        });
      },
      on: function(what, func){
        socket.on(what, func);
      }
    };

    return service;
  }]);

  angular.module("directive.choice", [])
  .directive("choice", function($document, modalService){
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
          modalService.openModal({
            close: false,
            backdrop: false,
            pos: pos,
            title: "Waiting on other player...",
            //body: "You picked choice " + picked + ". You are now waiting on the other player to pick their answer. Just hope you guys agree on the same answer. If you don't it is game over."
            templateUrl: "views/waiting.html",
            controller: "waitingCtrl",
            data: {
              picked: picked
            }
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
        el.remove();
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
  .controller("waitingCtrl", ["$scope", "modalService", "$rootScope", "answerService", function($scope, modalService, $rootScope, answerService){
    $scope.picked = modalService.getData().picked;
    $scope.test =  "FAKE DONE";
    $scope.fakeit = function(){
      // get answer from Server
      modalService.close();
      answerService.openDialog(true);
    };
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
        el.remove();
        scope.$destroy();
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
