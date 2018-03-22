import _ from 'lodash';

export default class ChatController {
  constructor($sce, $scope, $timeout, ChatService) {
    'ngInclude';

    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.$sce = $sce;
    this.$scope = $scope;
    this.$timeout = $timeout;
    this.pausedLines = [];
    this.chatLines = [];
    this.pagesToShow = 10;
    this.pageSize = 10;
    this.baseLine = 0;
    this.isScrolledToBottom = true;
    this.chatElement = null;
    this.chatInputContent = '';
    this.showModButtons = true;

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

      if (!this.getChatPaused()) this.baseLine = this.chatLines.length;
      this.chatLines.push(line);
    });
  }

  getChatPaused() {
    return this.baseLine < this.chatLines.length - 1;
  }

  getActiveChatLines() {
    const basePage = Math.ceil(this.baseLine / this.pageSize);
    return this.chatLines.slice(Math.max(0, (basePage - this.pagesToShow) * this.pageSize), basePage * this.pageSize);
  }

  onChatScroll($event, $element, scrollPos) {
    if ($event === null) {
      // when the directive is created, it calls this event handler with $event = null once
      this.chatElement = $element;
      console.log('Chat element:', this.chatElement);
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
    this.$scope.$apply();
    /*
      console.log('Scroll direction:', direction);


      if (isAtBottom) {
        if (this.basePage < this.chatPages.length) {
          this.basePage++;
          this.isScrolledToBottom = false;
        } else {
          this.isScrolledToBottom = true;
        }
      } else if (this.isScrolledToBottom && direction < 0) {
        this.isScrolledToBottom = false;
      }
      if (isAtTop) {
        if (this.basePage > 1) {
          this.basePage--;
        }
      } */
  }

  scrollToBottom() {
    if (this.isScrolledToBottom && !this.getChatPaused()) {
      this.chatElement.scrollTop(this.chatElement[0].scrollHeight);
    }
  }

  chatInputKeyPress(event) {
    if (event.keyCode === 13) {
      if (this.chatInputContent) {
        console.log('Chat message: ', this.chatInputContent);
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
    const command = commandTemplate.replace(templateRegex, (match, group) => {
      console.log(`Getting property ${group} of line`);
      return _.get(line, group, '');
    });
    console.log('Mod button triggered command: ', command);
    this.sendLine(command);
  }
}
