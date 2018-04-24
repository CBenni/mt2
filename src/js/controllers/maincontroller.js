import angular from 'angular';
import GoldenLayout from 'golden-layout';
import $ from 'jquery';
import _ from 'lodash';

import defaultConfig from '../defaultConfig';
import defaultLayouts from '../defaultLayouts';
import { migrateConfig, migrateLayouts } from '../migrations';
import config from '../config';

import chatTemplate from '../../templates/chatwindow.html';
import streamTemplate from '../../templates/streamwindow.html';
import homeTemplate from '../../templates/homewindow.html';
import iconTemplate from '../../templates/icontemplate.html';
import whisperTemplate from '../../templates/whisperwindow.html';

const windowTemplates = {
  chatTemplate,
  streamTemplate,
  homeTemplate,
  whisperTemplate

};


export default class MainController {
  constructor($compile, $rootScope, $scope, $timeout, $sce, $window, ApiService, ChatService, KeyPressService) {
    'ngInject';

    this.ApiService = ApiService;
    this.ChatService = ChatService;
    this.KeyPressService = KeyPressService;
    this.$scope = $scope;
    this.$sce = $sce;

    this.defaultConfig = defaultConfig;
    this.defaultLayouts = defaultLayouts;

    this.config = this.defaultConfig;
    this.layouts = this.defaultLayouts;
    this.modCards = [];
    this.chatControllers = [];
    this.whisperController = null;

    // initialize layout
    const storedConfig = localStorage.getItem('mt2-config');
    if (storedConfig) {
      this.config = JSON.parse(storedConfig);
      // run migrations
      migrateConfig(this.config);
      $timeout(() => { $scope.loadingScreenClass = 'hide-fast'; }, 1000);
    } else {
      $timeout(() => { $scope.loadingScreenClass = 'hide-first-time'; }, 4000);
    }
    const storedLayouts = localStorage.getItem('mt2-layouts');
    if (storedLayouts) {
      this.layouts = JSON.parse(storedLayouts);
      migrateLayouts(this.layouts);
    }

    // temp "fix" for https://github.com/WolframHempel/golden-layout/issues/418
    _.each(this.layouts, layout => this.fixActiveIndexes(layout));
    const currentProfile = localStorage.getItem('mt2-currentProfile');
    if (currentProfile) this.selectedProfile = parseInt(currentProfile, 10);
    else this.selectedProfile = 0;

    const layout = new GoldenLayout(this.getCurrentLayout(), $('#layout-container'));
    this.layout = layout;

    const AngularModuleComponent = (container, state) => {
      const html = windowTemplates[state.templateId];
      const element = container.getElement();

      element.html(html);

      const linkFun = $compile(element);
      const newScope = $scope.$new(true, $scope);
      newScope.container = container;
      if (state.templateId === 'chatTemplate') {
        if (!_.find(this.config.settings.chatPresets, preset => preset.id === state.preset)) {
          if (this.config.settings.chatPresets.length > 0) {
            state.preset = this.config.settings.chatPresets[0].id;
          } else {
            newScope.$destroy();
            return null;
          }
        }
      }
      newScope.state = state;
      newScope.mainCtrl = this;
      newScope.notifications = 0;
      linkFun(newScope);

      // add icon
      container.on('tab', tab => {
        newScope.tab = tab;

        const notificationElement = $('<span class="lm_title tab-notification-count"></span>');
        tab.element.prepend(notificationElement);
        function updateNotifications() {
          if (newScope.notifications > 0) {
            notificationElement.text(newScope.notifications);
            tab.element.addClass('unread-tab');
          } else {
            notificationElement.text('');
            tab.element.removeClass('unread-tab');
          }
        }
        newScope.$watch('notifications', updateNotifications);
        const oldSetActive = Object.getPrototypeOf(tab).setActive;
        tab.setActive = isActive => {
          if (newScope.onTabActive) newScope.onTabActive();
          oldSetActive.call(tab, isActive);
          updateNotifications();
        };


        let icon = state.icon;
        if (!icon) {
          const preset = this.getChatPreset(state.preset);
          if (preset) icon = preset.icon;
        }
        if (icon) {
          const iconElement = $('<span class="lm_title tab-icon"></span>');
          iconElement.html(iconTemplate);
          tab.element.prepend(iconElement);
          const iconLinkFun = $compile(iconElement);
          const iconScope = $scope.$new(true, $scope);
          iconScope.icon = icon;
          iconLinkFun(iconScope);
        }
      });
    };

    layout.registerComponent('angularModule', AngularModuleComponent);
    layout.init();

    angular.element($window).bind('resize', () => {
      layout.updateSize();
    });

    layout.on('stateChanged', () => {
      this.updateConfig();
    });
    $rootScope.updateConfig = () => {
      this.updateConfig();
    };

    // initialize authentication
    const auth = localStorage.getItem('mt2-auth');
    if (auth) {
      this.auth = JSON.parse(auth);
      ChatService.init(this.auth);
      this.initWhisperWindow();
    }

    if (window.location.hash) {
      let match;
      const hasRegex = /(\w+)=(\w*)/g;
      while (match = hasRegex.exec(window.location.hash)) { // eslint-disable-line no-cond-assign
        const [property, value] = match.slice(1);
        if (property === 'access_token') {
          ApiService.twitchGet('https://api.twitch.tv/kraken/', null, value).then(result => {
            if (result.data.token.valid) {
              this.auth = {
                name: result.data.token.user_name,
                id: result.data.token.user_id,
                token: value
              };
              ChatService.init(this.auth);
              localStorage.setItem('mt2-auth', JSON.stringify(this.auth));
              this.removeHash();
              window.location.reload(true);
            } else {
              // TODO: dont use alert here.
              alert('Invalid token');
            }
          });
        }
      }
    }

    // initialize mod card key hooks

    const keyWatchers = [
      this.KeyPressService.on('keydown', event => this.keydown(event), 10)
    ];

    this.$scope.$on('$destroy', () => {
      _.each(keyWatchers, keyWatcher => keyWatcher());
    });
  }

  fixActiveIndexes(layout) {
    if (layout.content) {
      layout.activeItemIndex = Math.min(layout.activeItemIndex || 0, layout.content.length - 1);
      _.each(layout.content, contentItem => this.fixActiveIndexes(contentItem));
    }
  }

  getTitle() {
    return 'ModCh.at by CBenni';
  }

  getCurrentLayout() {
    return this.layouts[this.selectedProfile];
  }

  getChatPreset(id) {
    return _.find(this.getSetting('chatPresets'), { id });
  }

  getSetting(key) {
    // we dont use default because we want "" to be interpreted as "use default".
    const value = _.get(this.config.settings, key);
    if (value !== undefined) return value;
    return _.get(this.defaultConfig.settings, key);
  }

  updateConfig() {
    this.layouts[this.selectedProfile] = this.layout.toConfig();
    localStorage.setItem('mt2-config', angular.toJson(this.config));
    localStorage.setItem('mt2-layouts', angular.toJson(this.layouts));
  }

  loginWithTwitch() {
    window.location.href = `https://id.twitch.tv/oauth2/authorize?client_id=${config.auth.client_id}`
      + `&redirect_uri=${config.auth.redirect_uri}&response_type=token&scope=chat_login%20user_subscriptions`;
  }

  logoutFromTwitch() {
    localStorage.removeItem('mt2-auth');
    window.location.reload(true);
  }

  removeHash() {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  }


  togglePinned(modCard) {
    if (modCard.pinned) {
      _.remove(this.modCards, card => !card.pinned);
      modCard.pinned = false;
    } else {
      modCard.pinned = true;
    }
  }

  openModCard($event, user, chatCtrl) {
    const cardWidth = 400;
    const cardHeight = 250;
    const distanceX = 100;
    const distanceY = 0;

    let xPos = $event.pageX - cardWidth - distanceX;
    let yPos = $event.pageY - cardHeight - distanceY;
    if (xPos < 10) xPos = $event.pageX + distanceX;
    if (yPos < 10) yPos = $event.pageY + distanceY;

    const modCard = {
      user,
      chatCtrl,
      pinned: false,
      xPos: `${xPos}px`,
      yPos: `${yPos}px`
    };

    _.remove(this.modCards, card => !card.pinned);
    this.modCards.push(modCard);

    this.ApiService.twitchGet(`https://api.twitch.tv/helix/users/follows?from_id=${user.id}&to_id=${chatCtrl.channelObj.id}`).then(response => {
      modCard.followedAt = new Date(response.data.data.followed_at);
    });

    this.ApiService.twitchGet(`https://api.twitch.tv/kraken/channels/${user.id}`).then(response => {
      modCard.stats = response.data;
    });

    return modCard;
  }

  closeModCard(card) {
    _.pull(this.modCards, card);
  }

  keydown(event) {
    const modCard = _.find(this.modCards, { pinned: false });
    if (!modCard) return false;
    const modCardButtons = this.getSetting('modCardButtons');
    if (modCardButtons) {
      for (let i = 0; i < modCardButtons.length; ++i) {
        const button = modCardButtons[i];
        if (button.hotkey === event.code) {
          modCard.chatCtrl.modAction(event, button, modCard);
          this.closeModCard(modCard);
          return true;
        }
      }
    }
    return false;
  }

  findTab(configItem, templateId) {
    return this.layout.root.getItemsByFilter(item => item.config.componentState && item.config.componentState.templateId === templateId);
  }

  initWhisperWindow() {
    // find whisper window
    if (this.findTab(this.layout.config, 'whisperTemplate').length === 0) {
      const homeTab = this.findTab(this.layout.config, 'homeTemplate')[0];
      if (homeTab) {
        const parent = homeTab.parent;
        parent.addChild({
          title: 'Whispers',
          type: 'component',
          componentName: 'angularModule',
          isClosable: false,
          componentState: {
            module: 'mtApp',
            templateId: 'whisperTemplate',
            icon: {
              type: 'icon',
              code: 'chat_bubble_outline'
            }
          }
        });
      } else console.error('No home tab found!');
    }
  }

  selectWhisperTab() {
    const whisperTabs = this.findTab(this.layout.config, 'whisperTemplate');
    if (whisperTabs.length === 1) {
      const whisperTab = whisperTabs[0];
      whisperTab.parent.setActiveContentItem(whisperTab);
    }
  }

  registerChatController(chatCtrl) {
    this.chatControllers.push(chatCtrl);
    return () => {
      _.pull(this.chatControllers, chatCtrl);
    };
  }

  openMenu($mdMenu, ev) {
    $mdMenu.open(ev);
  }
}
