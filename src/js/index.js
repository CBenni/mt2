import angular from 'angular';
import angularMaterial from 'angular-material';
import angularAnimate from 'angular-animate';
import angularAria from 'angular-aria';
import angularUIRouter from 'angular-ui-router';
import angularCookies from 'angular-cookies';
import 'angular-ui-sortable';

import '../css/index.scss';

import MainController from './controllers/maincontroller';
import HomeController from './controllers/homecontroller';
import ChatController from './controllers/chatcontroller';
import StreamController from './controllers/streamcontroller';
import DialogController from './controllers/dialogcontroller';
import SettingsDialogController from './controllers/settingsdialogcontroller';

import goldenLayoutDragSource from './directives/goldenlayoutdragsourcedirective';
import { chatLineDirective, isntEmptyFilter } from './directives/chatlinedirective';
import onScrollDirective from './directives/onscrolldirective';

import ApiService from './services/apiservice';
import ChatService from './services/chatservice';

import registerDarkMode from './themes/dark';
import registerLightMode from './themes/light';

const app = angular.module('mtApp', [angularAria, angularAnimate, angularMaterial, angularUIRouter, angularCookies, 'ui.sortable']);

app.controller('MainController', MainController);
app.controller('HomeController', HomeController);
app.controller('ChatController', ChatController);
app.controller('StreamController', StreamController);
app.controller('DialogController', DialogController);
app.controller('SettingsDialogController', SettingsDialogController);

app.directive('goldenLayoutDragSource', goldenLayoutDragSource);
app.directive('chatLine', chatLineDirective);
app.directive('onScroll', onScrollDirective);

app.service('ApiService', ApiService);
app.service('ChatService', ChatService);

app.filter('isntEmpty', isntEmptyFilter);

app.run($q => { window.Promise = $q; });
app.config(($locationProvider, $mdThemingProvider) => {
  $locationProvider.html5Mode(true);
  $mdThemingProvider.alwaysWatchTheme(true);
  registerDarkMode($mdThemingProvider);
  registerLightMode($mdThemingProvider);
});
