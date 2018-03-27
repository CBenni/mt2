import _ from 'lodash';

export default class ChatController {
  constructor($sce, $scope, $timeout, ChatService, KeyPressService) {
    'ngInclude';

    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.$sce = $sce;
    this.$scope = $scope;
    this.$timeout = $timeout;
    this.mainCtrl = $scope.mainCtrl;
    this.KeyPressService = KeyPressService;

    this.pausedChatLines = [];
    this.chatLines = [];
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
    this.KeyPressService.on('keyup', event => {
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
    this.addLine({
      tags: {
        'display-name': 'system',
        class: 'system-msg'
      },
      prefix: 'jtv!jvt.chat.twitch.tv',
      command: 'NOTICE',
      param: [`#${this.channelObj.name}`],
      trailing: text
    });
  }

  addLine(line) {
    this.ChatService.processMessage(line).then(() => {
      // chat pausing goes here

      if (!this.isPaused) {
        this.baseLine = this.chatLines.length;
        this.chatLines.push(line);
      } else {
        this.pausedChatLines.push(line);
      }
    });
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

  modAction($event, modButton, line) {
    switch (modButton.action.type) {
      case 'command':
        this.runCommand(modButton.action.command, line);
        break;
      case 'url':
        break;
      default:
        break;
    }
  }

  runCommand(commandTemplate, line) {
    const templateRegex = /{{((?:\w+)(?:\.\w+)*)}}/g;
    const command = commandTemplate.replace(templateRegex, (match, group) => _.get(line, group, ''));
    console.log('Mod button triggered command: ', command);
    this.sendLine(command);
  }
}
