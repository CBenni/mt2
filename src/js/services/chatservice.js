import _ from 'lodash';
import { EventEmitter } from 'events';

function genNonce() {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._~';
  const result = [];
  window.crypto.getRandomValues(new Uint8Array(32)).forEach(c =>
    result.push(charset[c % charset.length]));
  return result.join('');
}

const rx = /^(?:@([^ ]+) )?(?:[:](\S+) )?(\S+)(?: (?!:)(.+?))?(?: [:](.+))?$/;
const rx2 = /([^=;]+)=([^;]*)/g;
const STATE_V3 = 1;
const STATE_PREFIX = 2;
const STATE_COMMAND = 3;
const STATE_PARAM = 4;
const STATE_TRAILING = 5;

function parseIRCMessage(message) {
  const data = rx.exec(message);
  if (data == null) {
    console.error(`Couldnt parse message '${message}'`);
    return null;
  }
  const tagdata = data[STATE_V3];
  const tags = {};
  if (tagdata) {
    let m;
    do {
      m = rx2.exec(tagdata);
      if (m) {
        const [, key, val] = m;
        tags[key] = val.replace(/\\s/g, ' ').trim();
      }
    } while (m);
  }
  return {
    tags,
    command: data[STATE_COMMAND],
    prefix: data[STATE_PREFIX],
    param: data[STATE_PARAM],
    trailing: data[STATE_TRAILING]
  };
}

export default class ChatService extends EventEmitter {
  constructor(ApiService) {
    'ngInject';

    super();
    this.ApiService = ApiService;

    this.chatReceiveConnection = null;
    this.chatSendConnection = null;
    this.pubsubConnection = null;
    this.user = null;
    this.joinedChannels = {};
  }

  init(user) {
    console.log('Initializing chat service with user', user);
    this.user = user;

    this.chatReceiveConnection = this.connectWebsocket('wss://irc-ws.chat.twitch.tv:443');
    this.chatSendConnection = this.connectWebsocket('wss://irc-ws.chat.twitch.tv:443');
    this.pubsubConnection = this.connectWebsocket('wss://pubsub-edge.twitch.tv');

    this.chatReceiveConnection.then(conn => {
      console.log('Chat receive connection opened');
      conn.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      conn.send(`PASS oauth:${user.token}`);
      conn.send(`NICK ${user.name}`);

      conn.addEventListener('message', event => {
        this.handleIRCMessage(conn, event.data);
      });
    });
    this.chatSendConnection.then(conn => {
      console.log('Chat send connection opened');
      conn.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      conn.send(`PASS oauth:${user.token}`);
      conn.send(`NICK ${user.name}`);

      conn.addEventListener('message', event => {
        this.handleIRCMessage(conn, event.data);
      });
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

    this.joinChannel(user).then(channelObj => {
      this.emit(`join-${channelObj.name}`);
      this.emit(`join-${channelObj.id}`);
    });
  }

  handleIRCMessage(connection, message) {
    const lines = message.split('\n');
    _.each(lines, line => {
      line = line.trim();
      if (line.length === 0) return;
      const parsed = parseIRCMessage(line.trim());
      this.emit(parsed.command, parsed);
      if (parsed.param && parsed.param.length > 0) this.emit(`${parsed.command}-${parsed.param}`, parsed);

      if (parsed.command === 'PING') {
        connection.send('PONG');
      }
    });
  }

  handlePubSubMessage(connection, message) {
    const parsed = JSON.parse(message);
    console.log('Pubsub message received: ', parsed);
    console.log('Emitting ', `${parsed.type}-${parsed.nonce}`);
    this.emit(`${parsed.type}-${parsed.nonce}`, parsed);
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
    if (skipReply) {
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

  async chatSend(channelObj, text) {
    const conn = await this.chatSendConnection;
    conn.send(`PRIVMSG #${channelObj.name} :${text}`);
  }

  async joinChannel(channelObj) {
    // fill up missing properties
    if (!channelObj.name) channelObj.name = (await this.ApiService.twitchGetUserByID(channelObj.id)).name;
    if (!channelObj.id) channelObj.id = (await this.ApiService.twitchGetUserByName(channelObj.name))._id;

    if (this.joinedChannels[channelObj.id]) return channelObj;
    console.log('Waiting for chatReceiveConnection', this.chatReceiveConnection);
    this.chatReceiveConnection.then(conn => {
      conn.send(`JOIN #${channelObj.name}`);
    });
    console.log('Waiting for chatJoinedPromise');
    const chatJoinedPromise = new Promise(resolve => {
      this.once(`JOIN-#${channelObj.name}`, () => {
        resolve();
      });
    });
    console.log('Joining pubsub for channel ', channelObj);
    const pubsubJoinedPromise = this.pubsubSend('LISTEN', [`chat_moderator_actions.${this.user.id}.${channelObj.id}`]);
    console.log('Promises: ', chatJoinedPromise, pubsubJoinedPromise);
    const channelJoinedPromise = Promise.all([chatJoinedPromise, pubsubJoinedPromise]).then(() => channelObj);
    this.joinedChannels[channelObj.id] = channelJoinedPromise;
    console.log('Sent joins, waiting for join results.');
    return channelJoinedPromise.then(() => {
      console.log('Channel fully joined: ', channelObj);
      return channelObj;
    });
  }
}
