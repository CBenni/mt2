import angular from 'angular';
import GoldenLayout from 'golden-layout';
import $ from 'jquery';
import _ from 'lodash';

import defaultProfile from '../defaultProfile.json';
import config from '../config.json';

import chatTemplate from '../../templates/chatwindow.html';
import streamTemplate from '../../templates/streamwindow.html';
import homeTemplate from '../../templates/homewindow.html';

const windowTemplates = {
  chatTemplate,
  streamTemplate,
  homeTemplate
};

export default class MainController {
  constructor($compile, $scope, $sce, ApiService, ChatService) {
    'ngInclude';

    this.ApiService = ApiService;
    this.ChatService = ChatService;
    this.$scope = $scope;
    this.$sce = $sce;

    this.defaultProfile = defaultProfile;

    this.profiles = [this.defaultProfile];

    // initialize layout
    const storedProfiles = localStorage.getItem('mt2-profiles');
    if (storedProfiles) this.profiles = JSON.parse(storedProfiles);
    const currentProfile = localStorage.getItem('mt2-currentProfile');
    if (currentProfile) this.selectedProfile = parseInt(currentProfile, 10);
    else this.selectedProfile = 0;

    const layout = new GoldenLayout(this.getCurrentProfile().config, $('#layout-container'));
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
    };

    layout.registerComponent('angularModule', AngularModuleComponent);
    layout.init();

    layout.on('stateChanged', () => {
      this.getCurrentProfile().config = layout.toConfig();
      localStorage.setItem('mt2-profiles', angular.toJson(this.profiles));
    });

    // initialize authentication
    const auth = localStorage.getItem('mt2-auth');
    if (auth) {
      this.auth = JSON.parse(auth);
      ChatService.init(this.auth);

      this.conversations = [];
      ChatService.on('whisper_received', pubsubMessage => {
        console.log('Received whisper: ', pubsubMessage);
        this.addWhisper(pubsubMessage).then(() => {
          $scope.$apply(() => { });
        });
      });
      ChatService.on('whisper_sent', pubsubMessage => {
        console.log('Sent whisper: ', pubsubMessage);
        this.addWhisper(pubsubMessage).then(() => {
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

  getTitle() {
    return 'ModTwitch by CBenni';
  }

  getCurrentProfile() {
    return this.profiles[this.selectedProfile];
  }

  getSetting(key) {
    // we dont use default because we want "" to be interpreted as "use default".
    return _.get(this.getCurrentProfile().settings, key) || _.get(this.defaultProfile.settings, key);
  }

  updateConfig() {
  }

  loginWithTwitch() {
    window.location.href = `https://id.twitch.tv/oauth2/authorize?client_id=${config.auth.client_id}&redirect_uri=${config.auth.redirect_uri}&response_type=token&scope=chat_login`;
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
      html: this.$sce.trustAsHtml(this.ChatService.renderEmotes(msg.body, msg.tags.emotes)),
      recipient: msg.recipient,
      threadID: msg.thread_id
    };

    const conversation = this.findConversation(transformedMessage);
    conversation.lines.push(transformedMessage);
    console.log('Conversations: ', this.conversations);
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
      this.ChatService.chatSend({ name: 'jtv' }, `/w ${conversation.user.name} ${conversation.whisperText}`);
      conversation.whisperText = '';
    }
  }

  closeConversation($event, conversation) {
    _.pull(this.conversations, conversation);
    $event.preventDefault();
  }
}
