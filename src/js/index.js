import angular from 'angular';
import angularMaterial from 'angular-material';
import angularAnimate from 'angular-animate';
import angularAria from 'angular-aria';
import angularUI from 'angular-ui-router';
import angularCookies from 'angular-cookies';

import '../css/index.scss';

import MainController from './controllers/maincontroller';
import HomeController from './controllers/homecontroller';
import ChatController from './controllers/chatcontroller';
import StreamController from './controllers/streamcontroller';

import goldenLayoutDragSource from './directives/goldenlayoutdragsourcedirective';
import { chatLineDirective, isntEmptyFilter } from './directives/chatlinedirective';

import ApiService from './services/apiservice';
import ChatService from './services/chatservice';

const app = angular.module('mtApp', [angularAria, angularAnimate, angularMaterial, angularUI, angularCookies]);

app.controller('MainController', MainController);
app.controller('HomeController', HomeController);
app.controller('ChatController', ChatController);
app.controller('StreamController', StreamController);

app.directive('goldenLayoutDragSource', goldenLayoutDragSource);
app.directive('chatLine', chatLineDirective);

app.service('ApiService', ApiService);
app.service('ChatService', ChatService);

app.filter('isntEmpty', isntEmptyFilter);
