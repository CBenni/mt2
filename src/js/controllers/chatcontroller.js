import _ from 'lodash';

import { stringifyTimeout, textToCursor, getFullName, listenEvent } from '../helpers';
import { fixContrastHSL, hexToRGB, getBrightness } from '../colorcorrection';
import languageTable from '../languages.json';

const templateRegex = /{{((?:\w+)(?:\.\w+)*)}}/g;

export default class ChatController {
  constructor($element, $sce, $scope, $timeout, $http, $mdPanel, ChatService, ApiService, ThrottledDigestService, KeyPressService, ToastService) {
    'ngInject';

    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.$sce = $sce;
    this.$scope = $scope;
    this.$timeout = $timeout;
    this.$http = $http;
    this.$mdPanel = $mdPanel;
    this.mainCtrl = $scope.mainCtrl;
    this.KeyPressService = KeyPressService;
    this.ThrottledDigestService = ThrottledDigestService;
    this.ToastService = ToastService;
    this.ApiService = ApiService;

    this.preset = _.find(this.mainCtrl.getSetting('chatPresets'), { id: this.state.preset });
    this.pausedChatLines = [];
    this.chatLines = [];
    this.recentTimeouts = {};
    this.autocompleteData = {
      users: {},
      commands: {},
      emotes: {},
      messages: []
    };
    this.relevanceCounter = 0;
    this.pagesToShow = 10;
    this.pageSize = 10;
    this.activeChatLines = null;
    this.baseLine = 0;
    this.isScrolledToBottom = true;
    this.chatElement = null;
    this.chatInputContent = '';
    this.showModButtons = true;
    this.showChatSettings = false;
    this.mouseLastOver = 0;
    this.scrolledUp = false;
    this.lastScrollPos = 0;
    this.isPaused = false;
    this.chatHoverPauseTime = 750;
    this.userMentionRegex = null;
    this.indicatorDefaults = {
      'broadcaster-lang': '',
      'emote-only': '0',
      'followers-only': '-1',
      r9k: '0',
      slow: '0',
      'subs-only': '0'
    };
    this.buttonCursor = null;

    $timeout(() => {
      this.user = $scope.mainCtrl.auth;
      if (this.user) {
        this.ChatService = ChatService;

        const listeners = [
          this.KeyPressService.on('keydown', event => {
            const pauseSettings = this.mainCtrl.getSetting('chatSettings.pauseOn');
            if (pauseSettings.indexOf(event.code) >= 0) event.preventDefault();
            else if (this.checkHotkeys(event)) event.preventDefault();
            this.throttledUpdateChatPaused();
            return false;
          }, 1),
          this.KeyPressService.on('keyup', () => {
            this.setButtonCursor(null);
            this.resetChatScroll();
            this.throttledUpdateChatPaused();
            return false;
          }, 1),
          this.mainCtrl.registerChatController(this)
        ];

        this.ChatService.joinChannel({ name: this.state.channel }).then(channelObj => {
          this.channelObj = channelObj;
          this.systemMessage('Channel joined.');
          listeners.push(listenEvent(this.ChatService, `PRIVMSG-#${this.channelObj.name}`, message => {
            this.addChat(message);
          }));
          listeners.push(listenEvent(this.ChatService, `USERNOTICE-#${this.channelObj.name}`, message => {
            this.addUsernotice(message);
          }));
          listeners.push(listenEvent(this.ChatService, `CLEARCHAT-#${this.channelObj.name}`, message => {
            this.clearChat(message);
          }));
          listeners.push(listenEvent(this.ChatService, `NOTICE-#${this.channelObj.name}`, message => {
            this.systemMessage(message.trailing);
          }));

          listeners.push(listenEvent(this.ChatService, 'chat_login_moderation', message => {
            this.addModLogs(message);
          }));

          Promise.all([ChatService.emotesPromise.global, ChatService.emotesPromise[channelObj.id]]).then(() => {
            this.autocompleteData.emotes.global = ChatService.emotes;
            this.autocompleteData.emotes.local = ChatService.channelEmotes.get(channelObj.id).emotes;
          });
        });

        this.container.setTitle(this.state.channel);

        this.userMentionRegex = new RegExp(`\\b${this.user.name}\\b`, 'gi');


        $element.on('remove', () => {
          console.log('Chat element removed from DOM');
          this.chatElement = null;
          $scope.$destroy();
          _.each(listeners, listener => listener());
        });
        this.$scope.$on('$destroy', () => {
          console.log('Destroying chat controller!');
          _.each(listeners, listener => listener());
        });
      }
    });

    this.throttledUpdateChatPaused = _.throttle(() => {
      this.updateChatPaused();
    }, 10);
  }

  getEmbedUrl() {
    console.log('Loading native twitch chat embed.');
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
      dontDelete: true,
      prefix: 'jtv!jvt.chat.twitch.tv',
      command: 'NOTICE',
      param: [`#${this.channelObj.name}`],
      trailing: text
    };
    this.addLine(line);
    return line;
  }

  nonUserMessage(text) {
    const line = {
      tags: {
        'display-name': '',
        classes: ['system-msg']
      },
      prefix: 'jtv!jvt.chat.twitch.tv',
      command: 'NOTICE',
      param: [`#${this.channelObj.name}`],
      trailing: text
    };
    this.addLine(line);
    return line;
  }

  getColor(color) {
    if (!color) return color;
    const colorAdjustment = this.mainCtrl.getSetting('colorAdjustment');
    if (colorAdjustment === 'hsl') {
      const bgColor = window.getComputedStyle(this.chatElement[0])['background-color'];
      try {
        return fixContrastHSL(bgColor, color);
      } catch (err) {
        // do nothing
      }
    } else if (colorAdjustment === 'mono') {
      const bgColor = window.getComputedStyle(this.chatElement[0])['background-color'];
      const bgBrightness = getBrightness(hexToRGB(bgColor));
      return bgBrightness < 0.5 ? '#F3F3F3' : '#303030';
    }
    return color;
  }

  addLine(line) {
    const processedMessageOrPromise = this.ChatService.processMessage(line);
    if (processedMessageOrPromise.then) processedMessageOrPromise.then(processedLine => this._addLine(processedLine));
    else this._addLine(processedMessageOrPromise);
  }

  _addLine(line) {
    if (!line.tags) line.tags = {};
    if (!line.tags.classes) line.classes = [];

    // check if the message passes our filters
    if (!this.messagePassesFilters(line)) return false;

    if (!this.isPaused) {
      this.baseLine = this.chatLines.length;
      this.chatLines.push(line);
      if (!this.activeChatLines || this.activeChatLines.length > this.pageSize * (this.pagesToShow + 1)) this.markActiveChatLinesDirty();
      else this.activeChatLines.push(line);
    } else {
      this.pausedChatLines.push(line);
    }

    const scrollbackLength = this.mainCtrl.getSetting('scrollbackLength');
    if (this.chatLines.length >= (scrollbackLength + this.pageSize)) {
      this.chatLines.splice(0, this.chatLines.length - scrollbackLength);
    }

    if (line.user && line.user.id !== this.mainCtrl.auth.id) {
      if (!this.autocompleteData.users[line.user.id]) {
        this.autocompleteData.users[line.user.id] = {
          user: line.user
        };
      }
      this.autocompleteData.users[line.user.id].relevance = line.mention ? this.relevanceCounter + 100 : this.relevanceCounter;
      this.relevanceCounter++;
    }

    if (!this.isPaused) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 1);
    }
    return true;
  }

  checkForMentions(line) {
    // prevent self mentions
    if (line.tags['user-id'] === this.mainCtrl.auth.id) return false;
    // check for mentions
    if (this.userMentionRegex.test(line.trailing)) return true;
    const extraMentions = this.mainCtrl.getSetting('chatSettings.extraMentions');
    if (!extraMentions) return false;
    for (let i = 0; i < extraMentions.length; ++i) {
      const re = new RegExp(extraMentions[i], 'gi');
      if (re.test(line.trailing)) return true;
    }
    return false;
  }

  addChat(line) {
    line.chat = true;

    line.mention = this.checkForMentions(line);
    if (line.mention) {
      if (!line.tags.classes) line.tags.classes = [];
      line.tags.classes.push('mention');
    }

    this.addLine(line);
  }

  messagePassesFilters(line) {
    // system messages never get swallowed
    if (line.system) return true;
    const filters = this.preset.settings.messageFilters;
    if (filters.includes('modlogs') && line.modlogs) return true;
    if (filters.includes('automod') && line.automod) return true;
    if (!filters.includes('bots') && line.chat && this.mainCtrl.getSetting('chatSettings.knownBots').includes(line.user.name)) return false;
    if (filters.includes('mentions') && line.mention) return true;
    if (filters.includes('bits') && line.tags.bits) return true;
    if (filters.includes('chat') && line.chat) return true;
    if (filters.includes('subs') && line.command === 'USERNOTICE') return true;
    return false;
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
        if (line.user.id === targetID && !line.dontDelete) line.tags.classes.push('chat-line-deleted');
      }
      for (let i = 1; i <= addedMessagesToCheck; ++i) {
        const line = this.chatLines[this.chatLines.length - i];
        if (line.user.id === targetID && !line.dontDelete) line.tags.classes.push('chat-line-deleted');
      }
      const duration = parseInt(message.tags['ban-duration'], 10);
      let timeoutNotice = this.recentTimeouts[targetID];
      if (timeoutNotice && !timeoutNotice.stub) {
        timeoutNotice.count++;
        timeoutNotice.duration = duration;
        if (message.tags['ban-reason']) timeoutNotice.reasons.push(message.tags['ban-reason']);
        // update the html
        timeoutNotice.message.html = stringifyTimeout(timeoutNotice);
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
              classes: ['action-msg', 'timeout-msg']
            },
            dontDelete: true,
            timeout: true,
            prefix: `${userName}!${userName}.chat.twitch.tv`,
            command: 'NOTICE',
            param: [`#${this.channelObj.name}`],
            trailing: '',
            modlogs: timeoutNotice ? timeoutNotice.modlogs || [] : [] // include pre-existing modlogs if present
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

  addModLogs(message) {
    const [, , channelID] = message.data.topic.split('.');
    if (channelID !== this.channelObj.id) return;
    // go two layers deeper
    const info = message.data.message.data;
    /* info looks like:
    {
      "type": "chat_login_moderation",
      "moderation_action": "automod_rejected",
      "args": [
        "nightbot",
        "testing: dick",
        "sexual"
      ],
      "created_by": "",
      "created_by_user_id": "",
      "msg_id": "8c091fd0-c3df-460a-b4fc-ec6687e73b06",
      "target_user_id": "19264788"
    }
    */
    info.channelID = channelID;
    const command = info.moderation_action;
    switch (command) {
      case 'automod_rejected':
        this.automodMessage(info);
        break;
      case 'timeout':
      case 'ban':
      case 'unban':
      case 'untimeout':
        this.timeoutModlogs(info);
        break;
      default:
        this.modlogMessage(info);
    }
  }

  modlogMessage(info) {
    const msg = {
      tags: {
        color: 'inherit',
        classes: ['system-msg']
      },
      dontDelete: true,
      modlogs: [info],
      prefix: 'jtv!jtv.chat.twitch.tv',
      command: 'NOTICE',
      param: [`#${this.channelObj.name}`],
      trailing: `${info.created_by} used command /${info.moderation_action} ${info.args.join(' ')}`
    };
    this.addLine(msg);
  }

  automodMessage(message) {
    const userName = message.args[0];
    const msg = {
      tags: {
        id: message.msg_id,
        color: 'inherit',
        'user-id': message.target_user_id,
        'display-name': userName,
        classes: ['automod-msg']
      },
      dontDelete: true,
      automod: true,
      prefix: `${userName}!${userName}.chat.twitch.tv`,
      command: 'NOTICE',
      param: [`#${this.channelObj.name}`],
      trailing: message.args[1]
    };
    this.addLine(msg);
  }

  timeoutModlogs(message) {
    const cachedTimeout = this.recentTimeouts[message.target_user_id];
    if (cachedTimeout) {
      cachedTimeout.message.modlogs.push(message);
    } else {
      this.recentTimeouts[message.target_user_id] = {
        stub: true,
        modlogs: [message]
      };
    }
  }

  getModlogList(line) {
    return _.uniq(_.map(line.modlogs, modlog => modlog.created_by)).join(', ');
  }

  getModlogCommand(modlog) {
    return `/${modlog.moderation_action} ${modlog.args.join(' ')}`;
  }

  resolveAutomodMessage(action, msg) {
    this.ApiService.twitchPOST(`https://api.twitch.tv/kraken/chat/automod/${action}`, { msg_id: msg.tags.id }, null, this.mainCtrl.auth.token);
  }

  updateChatPaused() {
    let isPaused = false;
    if (this.isScrolledUp) isPaused = 'chat scroll';
    const pauseSettings = this.mainCtrl.getSetting('chatSettings.pauseOn');
    if (this.isMouseOver() && pauseSettings.indexOf('hover') >= 0) isPaused = 'mouse hover';
    const pressedKey = _.find(pauseSettings, pauseCondition => {
      const handledByLower = this.KeyPressService.keysPressed[pauseCondition] <= 1;
      return handledByLower;
    });
    if (!isPaused && pressedKey) isPaused = `${pressedKey} pressed`;
    if (pauseSettings.indexOf('hotkey') >= 0 && this.buttonCursor) isPaused = 'in-line hotkey';

    if (this.isPaused && !isPaused) {
      this.chatLines.push(...this.pausedChatLines);
      this.pausedChatLines = [];
      this.baseLine = this.chatLines.length;
      this.markActiveChatLinesDirty();
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
    if (this.activeChatLines) return this.activeChatLines;
    const basePage = Math.ceil(this.baseLine / this.pageSize);
    this.activeChatLines = this.chatLines.slice(Math.max(0, (basePage - this.pagesToShow) * this.pageSize), basePage * this.pageSize);
    return this.activeChatLines;
  }

  markActiveChatLinesDirty() {
    this.activeChatLines = null;
  }

  onChatScroll($event, $element) {
    if ($event === null) {
      // when the directive is created, it calls this event handler with $event = null once
      this.chatElement = $element;
      this.isScrolledToBottom = true;
      return;
    }

    const scrollPos = $element[0].scrollTop;
    const scrollLenience = $element.innerHeight() / 4;
    const isNearBottom = scrollPos + $element.innerHeight() >= $element[0].scrollHeight - scrollLenience;
    if (isNearBottom) {
      this.baseLine = Math.min(this.chatLines.length - 1, this.baseLine + this.pageSize);
      this.markActiveChatLinesDirty();
    }
    const isNearTop = scrollPos <= scrollLenience;
    if (isNearTop) {
      this.baseLine = Math.max(this.pagesToShow * this.pageSize, this.baseLine - this.pageSize);
      this.markActiveChatLinesDirty();
    }

    const isVeryCloseToBottom = scrollPos + $element.innerHeight() >= $element[0].scrollHeight - 30;
    if (!isVeryCloseToBottom && this.baseLine === this.chatLines.length - 1) this.isScrolledUp = true;

    this.throttledUpdateChatPaused();
  }

  scrollToBottom() {
    this.ThrottledDigestService.schedule(() => {
      this.chatElement.scrollTop(this.chatElement[0].scrollHeight);
    });
  }

  chatInputKeyPress(event) {
    if (!this.autocompleteData.status.selectedItem && event.keyCode === 13) {
      if (this.chatInputContent) {
        this.sendLine(this.chatInputContent);
      }
      this.chatInputContent = '';
      event.preventDefault();
    }
  }

  sendLine(text) {
    this.ChatService.chatSend(`PRIVMSG #${this.channelObj.name} :${text.replace(/[\r\n]/g, '')}`);
    // if this message wasnt one of the 3 last ones, we add it in to the last messages
    const textFound = this.autocompleteData.messages.lastIndexOf(text);
    if (textFound === -1 || textFound < this.autocompleteData.messages.length - 5) {
      this.autocompleteData.messages.push(text);
    }
  }

  modAction($event, modButton, locals) {
    locals = _.merge({}, locals, { channel: this.channelObj });
    switch (modButton.action.type) {
      case 'command':
        this.runCommand(modButton.action.command, locals);
        break;
      case 'url':
        window.open(this.replaceVariables(modButton.action.url, locals), '_blank');
        break;
      case 'whisper':
        this.mainCtrl.whisperController.openConversation(locals.user);
        break;
      case 'post':
        this.$http.post(this.replaceVariables(modButton.action.url))
        .then(response => this.toastService(response.data))
        .catch(err => this.toastService(`Error: ${err}`));
        break;
      default:
        break;
    }
  }

  replaceVariables(template, locals) {
    return template.replace(templateRegex, (match, group) => _.get(locals, group, ''));
  }

  runCommand(commandTemplate, locals) {
    const command = this.replaceVariables(commandTemplate, locals);
    console.log('Mod button triggered command: ', command);
    this.sendLine(command);
  }

  openModCard($event, user) {
    if (!this.buttonCursor) this.mainCtrl.openModCard($event, user, this);
  }

  openModCardByName($event, name) {
    if (!this.buttonCursor) {
      this.ApiService.twitchGetUserByName(name).then(user => {
        this.mainCtrl.openModCard($event, {
          name: user.name,
          displayName: user.display_name,
          fullName: getFullName(user.name, user.display_name),
          id: user._id
        }, this);
      });
    }
  }

  insertEmote(emote) {
    if (this.chatInputContent.length > 0 && this.chatInputContent[this.chatInputContent.length - 1] !== ' ') {
      this.chatInputContent += ' ';
    }
    this.chatInputContent += emote.code;
  }

  setButtonCursor(button) {
    this.buttonCursor = button;
    if (button) {
      if (!this.cursorStyle) {
        let imageUrl;
        if (button.icon.type === 'image') imageUrl = button.icon.image;
        else if (button.icon.type === 'icon') imageUrl = textToCursor(button.icon.code, 24, 'Material Icons');
        else if (button.icon.type === 'text') imageUrl = textToCursor(button.icon.text, 24, 'Arial');
        this.cursorStyle = `url(${imageUrl}), not-allowed`;
      }
    } else {
      this.cursorStyle = null;
    }
  }

  checkHotkeys(event) {
    const headerButtons = this.mainCtrl.getSetting('chatHeaderButtons');
    if (headerButtons) {
      for (let i = 0; i < headerButtons.length; ++i) {
        const button = headerButtons[i];
        if (button.hotkey === event.code) {
          this.modAction(event, button, {});
          return true;
        }
      }
    }
    const modButtons = this.mainCtrl.getSetting('modButtons');
    if (modButtons && this.showModButtons) {
      for (let i = 0; i < modButtons.length; ++i) {
        const button = modButtons[i];
        if (button.hotkey === event.code) {
          this.setButtonCursor(button);
          return true;
        }
      }
    }
    return false;
  }

  clickChatLine($event, line) {
    if (this.buttonCursor) {
      this.modAction($event, this.buttonCursor, line);
    }
  }
}
