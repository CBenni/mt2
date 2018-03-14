export default class ChatController {
  constructor($sce, $scope, $timeout, ChatService) {
    'ngInclude';

    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.$sce = $sce;
    this.$scope = $scope;
    this.lines = [];

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
    console.log('Adding line ', line);
    this.ChatService.processMessage(line).then(() => {
      this.$scope.$apply(() => this.lines.push(line));
    });
  }
}
