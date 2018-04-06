import _ from 'lodash';
import { EventEmitter } from 'events';

import { parseIRCMessage, jsonParseRecursive, sdbmCode, capitalizeFirst, genNonce, escapeHtml, entityMap } from '../helpers';

const DEFAULTCOLORS = ['#e391b8', '#e091ce', '#da91de', '#c291db', '#ab91d9', '#9691d6', '#91a0d4', '#91b2d1', '#91c2cf', '#91ccc7', '#91c9b4', '#90c7a2', '#90c492', '#9dc290', '#aabf8f', '#b5bd8f', '#bab58f', '#b8a68e', '#b5998e', '#b38d8d'];
export default class ChatService extends EventEmitter {
  constructor(ApiService, $sce) {
    'ngInject';

    super();
    this.ApiService = ApiService;
    this.$sce = $sce;

    this.chatReceiveConnection = null;
    this.chatSendConnection = null;
    this.pubsubConnection = null;
    this.user = null;
    this.joinedChannels = {};

    this.badges = {};
    this.getBadges();

    this.customEmotes = {};
  }

  init(user) {
    console.log('Initializing chat service with user', user);
    this.user = user;
    this.getGlobalEmotes();

    this.chatReceiveConnection = this.connectWebsocket('wss://irc-ws.chat.twitch.tv:443');
    this.chatSendConnection = this.connectWebsocket('wss://irc-ws.chat.twitch.tv:443');
    this.pubsubConnection = this.connectWebsocket('wss://pubsub-edge.twitch.tv');

    this.chatReceiveConnection.then(conn => {
      console.log('Chat receive connection opened');
      conn.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      conn.send(`PASS oauth:${user.token}`);
      conn.send(`NICK ${user.name}`);
      conn.name = 'chatReceiveConnection';

      conn.addEventListener('message', event => {
        this.handleIRCMessage(conn, event.data);
      });
    });
    this.chatSendConnection.then(conn => {
      console.log('Chat send connection opened');
      conn.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      conn.send(`PASS oauth:${user.token}`);
      conn.send(`NICK ${user.name}`);
      conn.name = 'chatSendConnection';

      conn.addEventListener('message', event => {
        this.handleIRCMessage(conn, event.data);
      });

      window.injectChatMessage = msg => {
        this.handleIRCMessage(conn, msg);
      };
    });
    this.pubsubConnection.then(conn => {
      console.log('Pubsub connection opened');
      this.pubsubSend('LISTEN', [`whispers.${user.id}`]);

      conn.addEventListener('message', event => {
        this.handlePubSubMessage(conn, event.data);
      });

      setInterval(() => {
        this.pubsubSend('PING', undefined, true);
      }, 1000 * 60);
    });

    this.joinChannel({ id: user.id, name: user.name }).then(channelObj => {
      this.emit(`join-${channelObj.name}`);
      this.emit(`join-${channelObj.id}`);
    });

    this.on('ROOMSTATE', async parsed => {
      const channelObj = await this.joinedChannels[parsed.tags['room-id']];
      if (channelObj) _.merge(channelObj.roomState, parsed.tags);
      else console.error('ROOMSTATE received for unknown channel', { id: parsed.tags['room-id'], name: parsed.param });
    });
  }

  handleIRCMessage(connection, message) {
    const lines = message.split('\n');
    _.each(lines, line => {
      line = line.trim();
      if (line.length === 0) return;
      const parsed = parseIRCMessage(line.trim());
      parsed.connection = connection;
      this.emit(parsed.command, parsed);
      if (parsed.param && parsed.param.length > 0) this.emit(`${parsed.command}-${parsed.param}`, parsed);

      if (parsed.command === 'PING') {
        connection.send('PONG');
      }
    });
  }

  handlePubSubMessage(connection, message) {
    const parsed = jsonParseRecursive(message);
    if (parsed.data) {
      const msg = parsed.data.message;
      if (msg) {
        const dataObject = msg.data || msg.data_object;
        const msgType = msg.type || dataObject.type;
        if (dataObject && msgType) {
          console.log('Emitting (1) ', `${msgType}`);
          this.emit(`${msgType}`, parsed);
        }
      }
      if (parsed.data.topic) {
        console.log('Emitting (2) ', `${parsed.data.topic}`);
        this.emit(`${parsed.data.topic}`, parsed);
      }
    }
    if (parsed.type && parsed.nonce) {
      console.log('Emitting (3) ', `${parsed.type}-${parsed.nonce}`);
      this.emit(`${parsed.type}-${parsed.nonce}`, parsed);
    }
  }

  connectWebsocket(url) {
    return new Promise(resolve => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => {
        resolve(ws);
      });
      ws.addEventListener('close', () => {
        console.log('Socket closed!', ws);
      });
      ws.addEventListener('error', err => {
        console.error('Socket encountered an error!', err);
      });
    });
  }

  async pubsubSend(type, topics, skipReply) {
    const conn = await this.pubsubConnection;
    const nonce = genNonce();
    conn.send(JSON.stringify({ type, data: { topics, auth_token: this.user.token }, nonce }));
    if (!skipReply) {
      return new Promise((resolve, reject) => {
        console.log('Listening for ', `RESPONSE-${nonce}`);
        this.once(`RESPONSE-${nonce}`, msg => {
          console.log('Pubsub message reply received', msg);
          if (msg.error) reject(msg.error);
          else resolve();
        });
      });
    }
    return Promise.resolve();
  }

  async chatSend(command) {
    const conn = await this.chatSendConnection;
    conn.send(command);
  }

  findChannelByName(name) {
    name = name.toLowerCase().replace('#', '');
    return _.find(this.joinedChannels, { name });
  }

  async joinChannel(channelObj) {
    // fill up missing properties
    if (!channelObj.name) channelObj.name = (await this.ApiService.twitchGetUserByID(channelObj.id)).name;
    if (!channelObj.id) channelObj.id = (await this.ApiService.twitchGetUserByName(channelObj.name))._id;
    if (!channelObj.roomState) channelObj.roomState = {};

    if (this.joinedChannels[channelObj.id]) return this.joinedChannels[channelObj.id];
    this.chatReceiveConnection.then(conn => {
      conn.send(`JOIN #${channelObj.name}`);
    });
    const chatJoinedPromise = new Promise(resolve => {
      this.once(`JOIN-#${channelObj.name}`, () => {
        resolve();
      });
    });
    const pubsubJoinedPromise = this.pubsubSend('LISTEN', [`chat_moderator_actions.${this.user.id}.${channelObj.id}`]);
    const channelJoinedPromise = Promise.all([chatJoinedPromise, pubsubJoinedPromise]).then(() => channelObj);
    this.joinedChannels[channelObj.id] = channelJoinedPromise;
    return channelJoinedPromise;
  }

  // chat rendering tools

  getBadges(channelID) {
    let resource = 'global';
    if (channelID) resource = `channels/${channelID}`;
    if (this.badges[resource]) return Promise.resolve(this.badges[resource]);
    const channelBadgesPromise = this.ApiService.twitchGet(`https://badges.twitch.tv/v1/badges/${resource}/display?language=en`).then(response => {
      if (response.data) return response.data.badge_sets;
      console.error(`Couldnt load badges for channel ${channelID}`, response);
      return {};
    });
    if (resource === 'global') {
      this.badges[resource] = channelBadgesPromise;
      return channelBadgesPromise;
    }
    const mergedBadgesPromise = Promise.all([this.badges.global, channelBadgesPromise]).then(([globalBadges, channelBadges]) => _.merge({}, globalBadges, channelBadges));
    this.badges[resource] = mergedBadgesPromise;
    return mergedBadgesPromise;
  }

  processMessage(message) {
    const channelID = message.tags['room-id'];
    const channelName = message.param.slice(1);
    message.channel = {
      id: channelID,
      name: channelName
    };
    return this.getBadges(channelID).then(badges => this._processMessage(message, badges));
  }

  _processMessage(message, badges) {
    if (!message.time) message.time = new Date();
    if (!message.tags) message.tags = {};
    if (!message.tags.classes) message.tags.classes = [];


    if (message.prefix) {
      const [username] = message.prefix.split('!');
      message.user = {
        name: username,
        id: message.tags['user-id'],
        displayName: message.tags['display-name'] || capitalizeFirst(username)
      };
      let color = message.tags.color;
      if (!color || color === '') {
        color = DEFAULTCOLORS[sdbmCode(message.user.id || username) % (DEFAULTCOLORS.length)];
      }
      message.user.color = color;
    }

    if (message.tags.badges) {
      message.user.badges = [];
      message.tags.badges.split(',').forEach(badgeID => {
        const [badgeName, badgeVersion] = badgeID.split('/');
        const badgeSet = badges[badgeName];
        if (badgeSet) {
          const versionInfo = badgeSet.versions[badgeVersion];
          if (versionInfo) {
            message.user.badges.push({
              url: versionInfo.image_url_1x,
              title: versionInfo.title,
              name: badgeName
            });
          }
        }
      });
    }
    const actionmatch = /^\u0001ACTION (.*)\u0001$/.exec(message.trailing);
    if (actionmatch != null) {
      message.trailing = actionmatch[1];
      message.tags.classes.push('action-msg');
    }
    let html = '';
    if (message.trailing) {
      const emotes = [];
      if (message.tags.emotes) {
        const emoteLists = message.tags.emotes.split('/');
        for (let i = 0; i < emoteLists.length; i++) {
          const [emoteid, emotepositions] = emoteLists[i].split(':');
          const positions = emotepositions.split(',');
          for (let j = 0; j < positions.length; j++) {
            let [start, end] = positions[j].split('-');
            start = parseInt(start, 10);
            end = parseInt(end, 10);
            emotes.push({
              start,
              end,
              id: emoteid
            });
          }
        }
      }
      html = this.renderEmotes(message.trailing, emotes);
    }
    if (message.type === 'timeout' || message.type === 'ban') {
      html += escapeHtml(formatTimeout(message));
    }

    message.html = this.$sce.trustAsHtml(html);

    return message;
  }

  renderEmotes(text, emotes) {
    // replace emotes
    const charArray = Array.from(text);
    let html = '';
    for (let i = 0; i < emotes.length; ++i) {
      const emote = emotes[i];
      const emoteName = charArray.slice(emote.start, emote.end + 1).join('');
      charArray[emote.start] = `<img class="emote emote-${emote.id}" alt="${emoteName}" title="${emoteName}" src="//static-cdn.jtvnw.net/emoticons/v1/${emote.id}/3.0"></img>`;
      for (let k = emote.start + 1; k <= emote.end; ++k) charArray[k] = '';
    }
    for (let i = 0; i < charArray.length; i++) {
      html += entityMap[charArray[i]] || charArray[i];
    }
    return html;
  }

  getGlobalEmotes() {
    this.getGlobalTwitchEmotes();
    this.getGlobalFFZEmotes();
    this.getGlobalBTTVEmotes();
  }

  getGlobalTwitchEmotes() {
    return this.ApiService.twitchGET(`https://api.twitch.tv/v5/users/${this.user.id}/emotes?on_site=1`).then(response => _.map());
  }

  getGlobalFFZEmotes() {
    return this.ApiService.get('https://api.frankerfacez.com/v1/set/global').then(response => {

    });
  }
}
