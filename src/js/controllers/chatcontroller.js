import _ from 'lodash';

export default class ChatController {
  constructor($sce, $scope, $timeout, ChatService) {
    'ngInclude';

    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.$sce = $sce;
    this.$scope = $scope;
    this.lines = [];
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
      this.lines.push(line);
    });
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
