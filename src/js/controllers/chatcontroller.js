import _ from 'lodash';

import { stringifyTimeout } from '../helpers';
import languageTable from '../languages.json';

export default class ChatController {
  constructor($sce, $scope, $timeout, $http, ChatService, KeyPressService, ToastService) {
    'ngInject';

    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.$sce = $sce;
    this.$scope = $scope;
    this.$timeout = $timeout;
    this.$http = $http;
    this.mainCtrl = $scope.mainCtrl;
    this.KeyPressService = KeyPressService;
    this.ToastService = ToastService;

    this.pausedChatLines = [];
    this.chatLines = [];
    this.recentTimeouts = {};
    this.pagesToShow = 10;
    this.pageSize = 10;
    this.baseLine = 0;
    this.isScrolledToBottom = true;
    this.chatElement = null;
    this.chatInputContent = '';
    this.showModButtons = true;
    this.mouseLastOver = 0;
    this.scrolledUp = false;
    this.lastScrollPos = 0;
    this.isPaused = false;
    this.chatHoverPauseTime = 750;
    this.indicatorDefaults = {
      'broadcaster-lang': '',
      'emote-only': '0',
      'followers-only': '-1',
      r9k: '0',
      slow: '0',
      'subs-only': '0'
    };

    $timeout(() => {
      this.user = $scope.mainCtrl.auth;
      if (this.user) {
        console.log('Creating chat controller with user: ', this.user);
        this.ChatService = ChatService;
        this.ChatService.joinChannel({ name: this.state.channel }).then(channelObj => {
          this.channelObj = channelObj;
          this.systemMessage('Channel joined.');
          this.ChatService.on(`PRIVMSG-#${this.channelObj.name}`, message => {
            this.addLine(message);
          });
          this.ChatService.on(`USERNOTICE-#${this.channelObj.name}`, message => {
            $scope.$apply(() => {
              this.addUsernotice(message);
            });
          });
          this.ChatService.on(`CLEARCHAT-#${this.channelObj.name}`, message => {
            $scope.$apply(() => {
              this.clearChat(message);
            });
          });
          this.ChatService.on(`NOTICE-#${this.channelObj.name}`, message => {
            $scope.$apply(() => {
              this.systemMessage(message.trailing);
            });
          });
        });

        this.container.setTitle(this.state.channel);
      }
    });

    this.throttledUpdateChatPaused = _.throttle(() => {
      this.updateChatPaused();
    }, 100);

    this.KeyPressService.on('keydown', event => {
      const pauseSettings = this.mainCtrl.getSetting('chatSettings.pauseOn');
      if (pauseSettings.indexOf(event.code) >= 0) event.preventDefault();
      this.$scope.$apply(() => this.throttledUpdateChatPaused());
    });
    this.KeyPressService.on('keyup', () => {
      this.resetChatScroll();
      this.$scope.$apply(() => this.throttledUpdateChatPaused());
    });
  }

  getEmbedUrl() {
    return this.$sce.trustAsResourceUrl(`https://www.twitch.tv/embed/${this.state.channel}/chat`);
  }

  debugTest(...args) {
    console.log('Debug test: ', args);
  }

  systemMessage(text) {
    const line = {
      tags: {
        'display-name': '',
        classes: ['system-msg']
      },
      system: true,
      prefix: 'jtv!jvt.chat.twitch.tv',
      command: 'NOTICE',
      param: [`#${this.channelObj.name}`],
      trailing: text
    };
    this.addLine(line);
    return line;
  }

  addLine(line) {
    this.ChatService.processMessage(line).then(() => {
      if (!line.tags) line.tags = {};
      if (!line.tags.classes) line.classes = [];

      if (!this.isPaused) {
        this.baseLine = this.chatLines.length;
        this.chatLines.push(line);
      } else {
        this.pausedChatLines.push(line);
      }
    });
  }

  clearChat(message) {
    // @ban-duration=1;ban-reason=;room-id=21018440;target-user-id=19264788;tmi-sent-ts=1522226153902 :tmi.twitch.tv CLEARCHAT #cbenni :nightbot
    // @room-id=21018440;tmi-sent-ts=1522226157141 :tmi.twitch.tv CLEARCHAT #cbenni
    const targetID = message.tags['target-user-id'];
    if (targetID) {
      const messagesToCheck = 200;
      const pausedMessagesToCheck = Math.min(messagesToCheck, this.pausedChatLines.length);
      const addedMessagesToCheck = Math.min(messagesToCheck - pausedMessagesToCheck, this.chatLines.length);
      for (let i = 1; i <= pausedMessagesToCheck; ++i) {
        const line = this.pausedChatLines[this.pausedChatLines.length - i];
        if (line.user.id === targetID && !line.system) line.tags.classes.push('chat-line-deleted');
      }
      for (let i = 1; i <= addedMessagesToCheck; ++i) {
        const line = this.chatLines[this.chatLines.length - i];
        if (line.user.id === targetID && !line.system) line.tags.classes.push('chat-line-deleted');
      }
      const duration = parseInt(message.tags['ban-duration'], 10);
      let timeoutNotice = this.recentTimeouts[targetID];
      if (timeoutNotice) {
        timeoutNotice.count++;
        timeoutNotice.duration = duration;
        if (message.tags['ban-reason']) timeoutNotice.reasons.push(message.tags['ban-reason']);
        // update the html
        timeoutNotice.message.html = this.$sce.trustAsHtml(stringifyTimeout(timeoutNotice));
      } else {
        const userName = message.trailing;
        const userID = message.tags['target-user-id'];
        timeoutNotice = {
          count: 1,
          duration,
          reasons: [],
          message: {
            tags: {
              color: 'inherit',
              'user-id': userID,
              'display-name': userName,
              classes: ['action-msg']
            },
            system: true,
            prefix: `${userName}!${userName}.chat.twitch.tv`,
            command: 'NOTICE',
            param: [`#${this.channelObj.name}`],
            trailing: ''
          }
        };
        if (message.tags['ban-reason']) timeoutNotice.reasons.push(message.tags['ban-reason']);
        timeoutNotice.message.trailing = stringifyTimeout(timeoutNotice);
        this.addLine(timeoutNotice.message);
        this.recentTimeouts[userID] = timeoutNotice;
      }
    } else {
      this.systemMessage('Chat was cleared by a moderator.');
    }
  }

  addUsernotice(message) {
    message.trailing = message.tags['system-msg'].replace(/\\s/g, ' ');
    const userName = message.tags.login;
    message.prefix = `${userName}!${userName}.chat.twitch.tv`;
    message.tags.classes = ['usernotice-msg'];

    this.addLine(message);
  }

  updateChatPaused() {
    let isPaused = false;
    if (this.isScrolledUp) isPaused = 'chat scroll';
    const pauseSettings = this.mainCtrl.getSetting('chatSettings.pauseOn');
    if (this.isMouseOver() && pauseSettings.indexOf('hover') >= 0) isPaused = 'mouse hover';
    const pressedKey = _.find(pauseSettings, pauseCondition => this.KeyPressService.keysPressed[pauseCondition]);
    if (!isPaused && pressedKey) isPaused = `${pressedKey} pressed`;

    if (this.isPaused && !isPaused) {
      this.chatLines.push(...this.pausedChatLines);
      this.pausedChatLines = [];
      this.baseLine = this.chatLines.length;
      this.scrollToBottom();
    }

    this.isPaused = isPaused;
  }

  indicatorActive(indicator) {
    return this.channelObj && this.channelObj.roomState[indicator]
    && this.channelObj.roomState[indicator] !== this.indicatorDefaults[indicator];
  }

  getLanguageName(languageCode) {
    return languageTable[languageCode];
  }

  isMouseOver() {
    return Date.now() - this.mouseLastOver < this.chatHoverPauseTime;
  }

  mouseMove() {
    this.mouseLastOver = Date.now();
    this.throttledUpdateChatPaused();
    this.$timeout(this.throttledUpdateChatPaused, this.chatHoverPauseTime);
  }

  mouseLeave() {
    this.mouseLastOver = 0;
    this.throttledUpdateChatPaused();
  }

  resetChatScroll() {
    this.isScrolledUp = false;
    this.lastScrollPos = 0;
    this.scrollToBottom();
    this.throttledUpdateChatPaused();
  }

  getActiveChatLines() {
    const basePage = Math.ceil(this.baseLine / this.pageSize);
    return this.chatLines.slice(Math.max(0, (basePage - this.pagesToShow) * this.pageSize), basePage * this.pageSize);
  }

  onChatScroll($event, $element, scrollPos) {
    if ($event === null) {
      // when the directive is created, it calls this event handler with $event = null once
      this.chatElement = $element;
      this.isScrolledToBottom = true;
      return;
    }

    const scrollLenience = $element.innerHeight() / 4;
    const isNearBottom = scrollPos + $element.innerHeight() >= $element[0].scrollHeight - scrollLenience;
    if (isNearBottom) {
      this.baseLine = Math.min(this.chatLines.length - 1, this.baseLine + this.pageSize);
    }
    const isNearTop = scrollPos <= scrollLenience;
    if (isNearTop) {
      this.baseLine = Math.max(this.pagesToShow * this.pageSize, this.baseLine - this.pageSize);
    }

    const direction = scrollPos - this.lastScrollPos;
    this.lastScrollPos = scrollPos;
    if (direction < 0) {
      this.isScrolledUp = true;
    }
    this.throttledUpdateChatPaused();
    this.$scope.$apply();
  }

  scrollToBottom() {
    this.chatElement.scrollTop(this.chatElement[0].scrollHeight);
  }

  chatInputKeyPress(event) {
    if (event.keyCode === 13) {
      if (this.chatInputContent) {
        this.sendLine(this.chatInputContent);
        this.chatInputContent = '';
        event.preventDefault();
      }
    }
  }

  sendLine(text) {
    this.ChatService.chatSend(this.channelObj, text);
  }

  modAction($event, modButton, locals) {
    switch (modButton.action.type) {
      case 'command':
        this.runCommand(modButton.action.command, locals);
        break;
      case 'url':
        window.open(modButton.action.url, '_blank');
        break;
      case 'whisper':
        this.mainCtrl.openConversation(locals.user);
        break;
      case 'post':
        this.$http.post(modButton.action.url)
        .then(response => this.toastService(response.data))
        .catch(err => this.toastService(`Error: ${err}`));
        break;
      default:
        break;
    }
  }

  runCommand(commandTemplate, locals) {
    const templateRegex = /{{((?:\w+)(?:\.\w+)*)}}/g;
    const command = commandTemplate.replace(templateRegex, (match, group) => _.get(locals, group, ''));
    console.log('Mod button triggered command: ', command);
    this.sendLine(command);
  }

  openModCard($event, user) {
    this.mainCtrl.openModCard($event, user, this);
  }
}
