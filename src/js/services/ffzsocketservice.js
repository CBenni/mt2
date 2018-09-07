import _ from 'lodash';

export default class FFZSocketService {
  constructor($http) {
    'ngInject';

    this.$http = $http;
    this.ChatService = null;

    this.socket = null;
    this.socketPromise = null;
    this.messageID = 4;
    this.debounce = 1;
    this.lastReconnect = 0;

    this.followSets = {};
    this.emoteSets = {};
    this.channelFeaturedEmotes = {};
  }

  setChatService(ChatService) {
    this.ChatService = ChatService;
    this.connect();
  }

  connect() {
    this.socket = new WebSocket('wss://catbag.frankerfacez.com');

    this.socketPromise = new Promise(resolve => {
      this.socket.addEventListener('open', () => {
        console.log('Connected to FFZ socket');
        this.socket.send('1 hello ["modchat-1.0", false]');
        // this.socket.send('2 setuser "cbenni"');
        this.socket.send('3 ready 0');
        resolve(this.socket);
        _.each(this.ChatService.channelObjs, channelObj => {
          this.joinChannel(channelObj);
        });
      });
    });

    this.socket.addEventListener('message', message => {
      console.log('Received FFZ socket message', message);
      const [, command, data] = message.data.split(' ');
      if (!data) return;
      const parsedData = JSON.parse(data); // {lordmau5:[123,345,567]}

      if (command === 'follow_sets') {
        _.merge(this.followSets, parsedData); // followSets = {lordmau5:[123,345,567], cbenni: [123]}

        _.each(parsedData, async (emoteSets, channelName) => { // emoteSets = [123,345,567], channelName = lordmau5
          const channelFeaturedEmotes = await Promise.all(_.map(emoteSets, async emoteSet => { // emoteSet = 123
            if (!this.emoteSets[emoteSet]) {
              const result = await this.$http.get(`https://api.frankerfacez.com/v1/set/${emoteSet}`);
              this.emoteSets[emoteSet] = _.map(result.data.set.emoticons, emote => ({
                id: emote.id,
                url: _.find(emote.urls),
                code: emote.name,
                origin: 'ffz featured',
                setID: emoteSet
              })); // [{...emote...}]
            }
            return this.emoteSets[emoteSet];
          })).then(_.flatten); // [[{...emote...}],[{...emote...}],[{...emote...}]] -> [[{...emote...}]]
          const emoteMap = {};
          _.each(channelFeaturedEmotes, emote => {
            emoteMap[emote.code] = emote;
          });
          this.channelFeaturedEmotes[channelName] = emoteMap;
        });
      }
    });

    this.socket.addEventListener('close', reason => {
      console.log('FFZ socket disconnected:', reason);
      if (!reason.wasClean) {
        if (Date.now() - this.lastReconnect > 120000) this.debounce = 1;
        setTimeout(() => {
          this.connect();
        }, this.debounce * 1000);
        this.debounce *= 2;
        this.lastReconnect = Date.now();
      }
    });
  }

  joinChannel(channelObj) {
    this.send(`sub "room.${channelObj.name}"`);
  }

  getChannelFeaturedEmotes(channelName) {
    return this.channelFeaturedEmotes[channelName] || {};
  }

  async send(message) {
    (await this.socketPromise).send(`${this.messageID++} ${message}`);
  }
}
