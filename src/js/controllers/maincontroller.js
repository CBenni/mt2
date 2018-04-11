import angular from 'angular';
import GoldenLayout from 'golden-layout';
import $ from 'jquery';
import _ from 'lodash';

import defaultConfig from '../defaultConfig.json';
import defaultLayouts from '../defaultLayouts.json';
import config from '../config';
import { genNonce } from '../helpers';

import chatTemplate from '../../templates/chatwindow.html';
import streamTemplate from '../../templates/streamwindow.html';
import homeTemplate from '../../templates/homewindow.html';
import iconTemplate from '../../templates/icontemplate.html';

const windowTemplates = {
  chatTemplate,
  streamTemplate,
  homeTemplate
};

export default class MainController {
  constructor($compile, $rootScope, $scope, $timeout, $sce, $window, ApiService, ChatService) {
    'ngInject';

    this.ApiService = ApiService;
    this.ChatService = ChatService;
    this.$scope = $scope;
    this.$sce = $sce;

    this.defaultConfig = defaultConfig;
    this.defaultLayouts = defaultLayouts;

    this.config = this.defaultConfig;
    this.layouts = this.defaultLayouts;
    this.modCards = [];

    // initialize layout
    const storedConfig = localStorage.getItem('mt2-config');
    if (storedConfig) {
      this.config = JSON.parse(storedConfig);
      _.each(this.config.settings.chatPresets, preset => {
        if (!preset.id) preset.id = genNonce();
      });
      $timeout(() => { $scope.loadingScreenClass = 'hide-fast'; }, 1000);
    } else {
      $timeout(() => { $scope.loadingScreenClass = 'hide-first-time'; }, 4000);
    }
    const storedLayouts = localStorage.getItem('mt2-layouts');
    if (storedLayouts) {
      this.layouts = JSON.parse(storedLayouts);
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
      newScope.state = state;
      newScope.mainCtrl = this;
      linkFun(newScope);

      // add icon
      container.on('tab', tab => {
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

      this.conversations = [];
      ChatService.on('whisper_received', pubsubMessage => {
        console.log('Received whisper: ', pubsubMessage);
        this.addWhisper(pubsubMessage.data.message.data).then(() => {
          $scope.$apply(() => { });
        });
      });
      ChatService.on('whisper_sent', pubsubMessage => {
        console.log('Sent whisper: ', pubsubMessage);
        this.addWhisper(pubsubMessage.data.message.data).then(() => {
          $scope.$apply(() => { });
        });
      });
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
              alert('Invalid token');
            }
          });
        }
      }
    }
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
    window.location.href = `https://id.twitch.tv/oauth2/authorize?client_id=${config.auth.client_id}&redirect_uri=${config.auth.redirect_uri}&response_type=token&scope=chat_login%20user_subscriptions`;
  }

  logoutFromTwitch() {
    localStorage.removeItem('mt2-auth');
    window.location.reload(true);
  }

  removeHash() {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  }

  async upgradeBadges(badgeList) {
    const badges = await this.ChatService.getBadges();
    _.each(badgeList, badge => {
      const badgeSet = badges[badge.id];
      if (badgeSet) {
        const versionInfo = badgeSet.versions[badge.version];
        if (versionInfo) {
          badge.url = versionInfo.image_url_1x;
          badge.title = versionInfo.title;
          badge.name = badge.id;
        }
      }
    });
  }

  async addWhisper(msg) {
    if (msg.tags.badges && msg.tags.badges.length > 0) await this.upgradeBadges(msg.tags.badges);

    let isAction = false;
    const actionmatch = /^\u0001ACTION (.*)\u0001$/.exec(msg.body);
    if (actionmatch != null) {
      isAction = true;
      msg.body = actionmatch[1];
    }


    const transformedMessage = {
      time: msg.sent_ts ? new Date(msg.sent_ts) : new Date(),
      tags: msg.tags,
      trailing: msg.body,
      user: {
        id: msg.from_id,
        name: msg.tags.login,
        displayName: msg.tags.display_name,
        color: msg.tags.login,
        badges: msg.tags.badges
      },
      isAction,
      html: this.$sce.trustAsHtml(this.ChatService.renderEmotes(msg, msg.tags.emotes)),
      recipient: msg.recipient,
      threadID: msg.thread_id
    };

    const conversation = this.findConversation(transformedMessage);
    conversation.lines.push(transformedMessage);
    console.log('Conversations: ', this.conversations);
  }

  openConversation(user) {
    const threadID = `${this.auth.id}_${user.id}`;
    const convo = this.findConversation({ user, threadID });
    convo.collapse = false;
  }

  findConversation(msg) {
    let convo = _.find(this.conversations, conversation => conversation.id === msg.threadID);
    if (!convo) {
      let otherUser = msg.user;
      if (`${otherUser.id}` === this.auth.id) {
        // we sent the message ourselves, find the other user
        otherUser = {
          id: msg.recipient.id,
          name: msg.recipient.username,
          displayName: msg.recipient.display_name,
          color: msg.recipient.color,
          badges: msg.recipient.badges
        };
        this.upgradeBadges(otherUser.badges);
      }
      convo = {
        user: otherUser,
        lines: [],
        whisperText: '',
        collapse: false,
        id: msg.threadID
      };
      this.conversations.push(convo);
    }
    return convo;
  }

  sendWhisper($event, conversation) {
    if ($event.keyCode === 13 && conversation.whisperText.length > 0) {
      this.ChatService.chatSend(`PRIVMSG #jtv :/w ${conversation.user.name} ${conversation.whisperText}`);
      conversation.whisperText = '';
    }
  }

  closeConversation($event, conversation) {
    _.pull(this.conversations, conversation);
    $event.preventDefault();
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

    const replaceCard = _.findIndex(this.modCards, card => !card.pinned);
    if (replaceCard >= 0) {
      this.modCards[replaceCard] = modCard;
    } else {
      this.modCards.push(modCard);
    }

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
}
