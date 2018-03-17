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
  if (data === null) {
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
const DEFAULTCOLORS = ['#e391b8', '#e091ce', '#da91de', '#c291db', '#ab91d9', '#9691d6', '#91a0d4', '#91b2d1', '#91c2cf', '#91ccc7', '#91c9b4', '#90c7a2', '#90c492', '#9dc290', '#aabf8f', '#b5bd8f', '#bab58f', '#b8a68e', '#b5998e', '#b38d8d'];
function sdbmCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
  }
  return Math.abs(hash);
}
const entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;'
};

function formatTimespan(timespan) {
  let age = Math.round(parseInt(timespan, 10));
  const periods = [
    { abbr: 'y', len: 3600 * 24 * 365 },
    { abbr: 'm', len: 3600 * 24 * 30 },
    { abbr: 'd', len: 3600 * 24 },
    { abbr: ' hrs', len: 3600 },
    { abbr: ' min', len: 60 },
    { abbr: ' sec', len: 1 }
  ];
  let res = '';
  let count = 0;
  for (let i = 0; i < periods.length; ++i) {
    if (age >= periods[i].len) {
      const pval = Math.floor(age / periods[i].len);
      age %= periods[i].len;
      res += (res ? ' ' : '') + pval + periods[i].abbr;
      count++;
      if (count >= 2) break;
    }
  }
  return res;
}
function formatCount(i) {
  return i <= 1 ? '' : ` (${i} times)`;
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"'\\/]/g, s => entityMap[s]);
}

export function formatTimeout(timeout) {
  const tags = timeout.tags;
  console.log('Formatting timeout: ', tags);
  if (timeout.type === 'timeout') {
    // timeout
    if (!tags.reasons || tags.reasons.length === 0) {
      return `<${tags['display-name']} has been timed out for ${formatTimespan(tags.duration)}${formatCount(tags.count)}>`;
    } else if (tags.reasons.length === 1) {
      return `<${tags['display-name']} has been timed out for ${formatTimespan(tags.duration)}. Reason: ${tags.reasons.join(', ')}${formatCount(tags.count)}>`;
    }
    return `<${tags['display-name']} has been timed out for ${formatTimespan(tags.duration)}. Reasons: ${tags.reasons.join(', ')}${formatCount(tags.count)}>`;
  }
  // banned
  if (timeout.type === 'ban') {
    if (!tags.reasons || tags.reasons.length === 0) {
      return `<${tags['display-name']} has been banned>`;
    } else if (tags.reasons.length === 1) {
      return `<${tags['display-name']} has been banned. Reason: ${tags.reasons.join(', ')}>`;
    }
    return `<${tags['display-name']} has been banned. Reasons: ${tags.reasons.join(', ')}>`;
  }
  return '<invalid timeout>';
}

function capitalizeFirst(str) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

export function jsonParseRecursive(thing) {
  if (typeof (thing) === 'object') {
    _.each(thing, (val, prop) => {
      thing[prop] = jsonParseRecursive(val);
    });
    return thing;
  } else if (typeof (thing) === 'string' && (thing[0] === '[' || thing[0] === '{')) {
    try {
      return jsonParseRecursive(JSON.parse(thing));
    } catch (err) {
      return thing;
    }
  } else return thing;
}

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
        if (dataObject && msg.type) {
          console.log('Emitting (1) ', `${msg.type}`);
          this.emit(`${msg.type}`, dataObject);
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
    let isAction = false;
    const actionmatch = /^\u0001ACTION (.*)\u0001$/.exec(message.trailing);
    if (actionmatch != null) {
      isAction = true;
      message.trailing = actionmatch[1];
      message.isAction = isAction;
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
}
