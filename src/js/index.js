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
import WhisperController from './controllers/whispercontroller';
import ChatController from './controllers/chatcontroller';
import StreamController from './controllers/streamcontroller';
import DialogController from './controllers/dialogcontroller';
import SettingsDialogController from './controllers/settingsdialogcontroller';
import ButtonSettingsController from './controllers/buttonsettingscontroller';
import StreamListController from './controllers/streamlistcontroller';
import AutocompletePanelController from './controllers/autocompletepanelcontroller';
import WhisperToastController from './controllers/whispertoastcontroller';

import goldenLayoutDragSource from './directives/goldenlayoutdragsourcedirective';
import { chatLineDirective, isntEmptyFilter, compileDirective } from './directives/chatlinedirective';
import onScrollDirective from './directives/onscrolldirective';
import buttonSettingsDirective from './directives/buttonsettingsdirective';
import streamListDirective from './directives/streamlistdirective';
import draggableDirective from './directives/draggabledirective';
import simpleScrollbarDirective from './directives/simplescrolldirective';
import autocompleteDirective from './directives/autocompletedirective';
import { throttledMousemoveDirective, throttledClickDirective, throttledKeydownDirective, throttledUserScrollDirective } from './directives/throttledevents';
import { timeAgoFilter, largeNumberFilter, durationFilter, uniqueFilter } from './directives/filters';

import ApiService from './services/apiservice';
import ChatService from './services/chatservice';
import KeyPressService from './services/keypressservice';
import ToastService from './services/toastservice';
import ThrottledDigestService from './services/throttleddigestservice';

import registerDarkMode from './themes/dark';
import registerLightMode from './themes/light';

const app = angular.module('mtApp', [angularAria, angularAnimate, angularMaterial, angularCookies, 'ui.sortable', 'angular-click-outside']);

app.controller('MainController', MainController);
app.controller('HomeController', HomeController);
app.controller('WhisperController', WhisperController);
app.controller('ChatController', ChatController);
app.controller('StreamController', StreamController);
app.controller('DialogController', DialogController);
app.controller('SettingsDialogController', SettingsDialogController);
app.controller('ButtonSettingsController', ButtonSettingsController);
app.controller('StreamListController', StreamListController);
app.controller('AutocompletePanelController', AutocompletePanelController);
app.controller('WhisperToastController', WhisperToastController);

app.directive('goldenLayoutDragSource', goldenLayoutDragSource);
app.directive('chatLine', chatLineDirective);
app.directive('onScroll', onScrollDirective);
app.directive('buttonSettings', buttonSettingsDirective);
app.directive('streamList', streamListDirective);
app.directive('draggable', draggableDirective);
app.directive('throttledMousemove', throttledMousemoveDirective);
app.directive('throttledClick', throttledClickDirective);
app.directive('throttledKeydown', throttledKeydownDirective);
app.directive('throttledUserScroll', throttledUserScrollDirective);
app.directive('simple-scrollbar', simpleScrollbarDirective);
app.directive('autocomplete', autocompleteDirective);
app.directive('compile', compileDirective);

app.service('ApiService', ApiService);
app.service('ChatService', ChatService);
app.service('KeyPressService', KeyPressService);
app.service('ToastService', ToastService);
app.service('ThrottledDigestService', ThrottledDigestService);

app.filter('isntEmpty', isntEmptyFilter);
app.filter('timeAgo', timeAgoFilter);
app.filter('largeNumber', largeNumberFilter);
app.filter('duration', durationFilter);
app.filter('unique', uniqueFilter);

app.config($mdThemingProvider => {
  'ngInject';

  $mdThemingProvider.alwaysWatchTheme(true);
  registerDarkMode($mdThemingProvider);
  registerLightMode($mdThemingProvider);

  // $mdPanel.newPanelGroup('autocomplete', { maxOpen: 1 });
});
