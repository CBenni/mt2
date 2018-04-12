import 'jquery-ui';
import angular from 'angular';
import angularMaterial from 'angular-material';
import angularAnimate from 'angular-animate';
import angularAria from 'angular-aria';
import angularCookies from 'angular-cookies';
import 'angular-ui-sortable';
import '@iamadamjowett/angular-click-outside';

import '../css/index.scss';

import MainController from './controllers/maincontroller';
import HomeController from './controllers/homecontroller';
import ChatController from './controllers/chatcontroller';
import StreamController from './controllers/streamcontroller';
import DialogController from './controllers/dialogcontroller';
import SettingsDialogController from './controllers/settingsdialogcontroller';
import ButtonSettingsController from './controllers/buttonsettingscontroller';
import StreamListController from './controllers/streamlistcontroller';

import goldenLayoutDragSource from './directives/goldenlayoutdragsourcedirective';
import { chatLineDirective, isntEmptyFilter } from './directives/chatlinedirective';
import onScrollDirective from './directives/onscrolldirective';
import buttonSettingsDirective from './directives/buttonsettingsdirective';
import streamListDirective from './directives/streamlistdirective';
import draggableDirective from './directives/draggabledirective';
import { timeAgoFilter, largeNumberFilter, durationFilter } from './directives/filters';

import ApiService from './services/apiservice';
import ChatService from './services/chatservice';
import KeyPressService from './services/keypressservice';
import ToastService from './services/toastservice';

import registerDarkMode from './themes/dark';
import registerLightMode from './themes/light';

const app = angular.module('mtApp', [angularAria, angularAnimate, angularMaterial, angularCookies, 'ui.sortable', 'angular-click-outside']);

app.controller('MainController', MainController);
app.controller('HomeController', HomeController);
app.controller('ChatController', ChatController);
app.controller('StreamController', StreamController);
app.controller('DialogController', DialogController);
app.controller('SettingsDialogController', SettingsDialogController);
app.controller('ButtonSettingsController', ButtonSettingsController);
app.controller('StreamListController', StreamListController);

app.directive('goldenLayoutDragSource', goldenLayoutDragSource);
app.directive('chatLine', chatLineDirective);
app.directive('onScroll', onScrollDirective);
app.directive('buttonSettings', buttonSettingsDirective);
app.directive('streamList', streamListDirective);
app.directive('draggable', draggableDirective);

app.service('ApiService', ApiService);
app.service('ChatService', ChatService);
app.service('KeyPressService', KeyPressService);
app.service('ToastService', ToastService);

app.filter('isntEmpty', isntEmptyFilter);
app.filter('timeAgo', timeAgoFilter);
app.filter('largeNumber', largeNumberFilter);
app.filter('duration', durationFilter);

app.config($mdThemingProvider => {
  'ngInject';

  $mdThemingProvider.alwaysWatchTheme(true);
  registerDarkMode($mdThemingProvider);
  registerLightMode($mdThemingProvider);
});
