import _ from 'lodash';
import raven from 'raven-js';
import { EventEmitter } from 'events';

import { parseIRCMessage, jsonParseRecursive, sdbmCode, capitalizeFirst, genNonce, escapeHtml, formatTimeout, instantiateRegex, alwaysResolve, getFullName, safeLink, globalModTypes } from '../helpers';
import urlRegex from '../urlRegex';

const DEFAULTCOLORS = ['#e391b8', '#e091ce', '#da91de', '#c291db', '#ab91d9', '#9691d6', '#91a0d4', '#91b2d1', '#91c2cf', '#91ccc7', '#91c9b4', '#90c7a2', '#90c492', '#9dc290', '#aabf8f', '#b5bd8f', '#bab58f', '#b8a68e', '#b5998e', '#b38d8d'];
export default class ChatService extends EventEmitter {
  constructor(ApiService, ThrottledDigestService, $sce) {
    'ngInject';

    super();
    this.ApiService = ApiService;
    this.ThrottledDigestService = ThrottledDigestService;
    this.$sce = $sce;

    this.chatReceiveConnection = null;
    this.chatSendConnection = null;
    this.pubsubConnection = null;
    this.user = null;
    this.joinedChannels = {};
    this.channelObjs = [];

    this.badges = {};
    this.getBadges();


    this.emotes = [];
    this.thirdPartyEmotes = new Map();
    this.cheermotes = new Map();

    this.channelEmotes = new Map();
    this.emotesPromise = {};

    this.globalUserState = {};
  }

  init(user) {
    this.user = user;
    this.emotesPromise.global = this.getGlobalEmotes();

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
        this.ThrottledDigestService.$apply();
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
        this.ThrottledDigestService.$apply(() => {
          this.handlePubSubMessage(conn, event.data);
        });
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

    this.on('USERSTATE', async parsed => {
      const channelObj = await _.find(this.channelObjs, channel => `#${channel.name}` === parsed.param);
      if (channelObj) _.merge(channelObj.userState, parsed.tags);
      else console.error('USERSTATE received for unknown channel', { name: parsed.param });
    });

    this.on('GLOBALUSERSTATE', async parsed => {
      this.globalUserState = parsed.tags;
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
          this.emit(`${msgType}`, parsed);
        }
      }
      if (parsed.data.topic) {
        this.emit(`${parsed.data.topic}`, parsed);
      }
    }
    if (parsed.type && parsed.nonce) {
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
        this.once(`RESPONSE-${nonce}`, msg => {
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
    if (!channelObj.userState) channelObj.userState = {};

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
    this.emotesPromise[channelObj.id] = this.getChannelEmotes(channelObj);
    this.channelObjs.push(channelObj);
    return channelJoinedPromise;
  }

  // chat rendering tools

  getBadges(channelID) {
    let resource = 'global';
    if (channelID) resource = `channels/${channelID}`;
    if (this.badges[resource]) return this.badges[resource];
    const channelBadgesPromise = this.ApiService.twitchGet(`https://badges.twitch.tv/v1/badges/${resource}/display?language=en`).then(response => {
      if (response.data) return response.data.badge_sets;
      console.error(`Couldnt load badges for channel ${channelID}`, response);
      return {};
    });
    if (resource === 'global') {
      this.badges[resource] = channelBadgesPromise;
      return channelBadgesPromise;
    }
    this.badges[resource] = Promise.all([this.badges.global, channelBadgesPromise]).then(([globalBadges, channelBadges]) => {
      this.badges[resource] = _.merge({}, globalBadges, channelBadges);
      return this.badges[resource];
    });
    return this.badges[resource];
  }

  processMessage(message) {
    const channelID = message.tags['room-id'];
    const channelName = message.param.slice(1);
    message.channel = {
      id: channelID,
      name: channelName
    };
    const badgesOrPromise = this.getBadges(channelID);
    if (badgesOrPromise.then) return badgesOrPromise.then(badges => this._processMessage(message, badges));
    return this._processMessage(message, badgesOrPromise);
  }

  _processMessage(message, badges) {
    if (!message.time) message.time = new Date();
    if (!message.tags) message.tags = {};
    if (!message.tags.classes) message.tags.classes = [];


    if (message.prefix) {
      const [username] = message.prefix.split('!');

      const displayName = message.tags['display-name'] || capitalizeFirst(username);
      const fullName = getFullName(username, displayName);

      const userID = message.tags['user-id'];
      message.user = {
        name: username,
        id: userID,
        displayName,
        fullName,
        type: message.tags['user-type'],
        isMod: (message.tags.mod === '1') || (message.channel && userID === message.channel.id) || globalModTypes.includes(message.tags['user-type'])
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
      html = this.renderMessage(message, emotes);
    }
    if (message.type === 'timeout' || message.type === 'ban') {
      html += escapeHtml(formatTimeout(message));
    }

    if (message.systemMsg) {
      message.systemHtml = message.systemMsg.replace(/^\w+\b/, match => `<span class="compile system-user" ng-click="chatCtrl.openModCardByName($event, '${match}')">${match}</span>`);
    }
    message.html = html;

    return message;
  }

  renderWord(message, word) {
    const holder = message.channel && this.channelEmotes.get(message.channel.id);
    const emote = this.thirdPartyEmotes.get(word) || (holder && holder.thirdPartyEmotes.get(word));
    if (emote) {
      return `<img class="emote emote-${emote.id}" alt="${emote.code}" title="${emote.code}" src="${emote.url}">`;
    }
    const bitMatch = /^(\w+?)(\d+)$/.exec(word);
    if (bitMatch && message.tags.bits) {
      const cheermote = this.cheermotes.get(bitMatch[1]) || (holder && holder.cheermotes.get(bitMatch[1]));
      if (cheermote) {
        const amount = parseInt(bitMatch[2], 10);
        // find the correct tier
        const cheerTier = _.findLast(cheermote.tiers, tier => tier.minBits <= amount);
        return `<img class="emote cheermote emote-${cheermote.name}" alt="${cheerTier.name}" title="${cheerTier.name}" src="${cheerTier.url}">`
          + `<span class="cheer-amount" style="color: ${cheerTier.color}">${amount}</span>`;
      }
    }
    const mentionMatch = /^@(\w+)\b(.*)$/.exec(word);
    if (mentionMatch) {
      return `<span class="compile chat-mention" ng-click="chatCtrl.openModCardByName($event, '${mentionMatch[1]}')">@${mentionMatch[1]}</span>${escapeHtml(mentionMatch[2])}`;
    }
    const urlMatch = urlRegex.exec(word);
    if (urlMatch) {
      return safeLink(urlMatch[0]);
    }
    return escapeHtml(word);
  }

  renderMessage(message, emotes) {
    if (!message) return '';
    // replace emotes
    const charArray = Array.from(message.trailing);
    for (let i = 0; i < emotes.length; ++i) {
      const emote = emotes[i];
      const emoteName = charArray.slice(emote.start, emote.end + 1).join('');
      charArray[emote.start] = `<img class="emote emote-${emote.id}" alt="${emoteName}" title="${emoteName}" src="//static-cdn.jtvnw.net/emoticons/v1/${emote.id}/3.0"></img>`;
      for (let k = emote.start + 1; k <= emote.end; ++k) charArray[k] = '';
    }
    let html = '';
    let word = '';
    for (let i = 0; i < charArray.length; i++) {
      if (charArray[i] === undefined) {
        raven.captureMessage('charArray invalid: ', {
          extra: {
            message,
            charArray
          }
        });
      } else if (charArray[i] === ' ') {
        html += `${this.renderWord(message, word)} `;
        word = '';
      } else if (charArray[i].length > 5) {
        // pass through any HTML from twitch emotes
        html += `${this.renderWord(message, word)}`;
        html += charArray[i];
        word = '';
      } else {
        word += charArray[i];
      }
    }
    html += this.renderWord(message, word);
    return html;
  }

  getGlobalEmotes() {
    return Promise.all([
      alwaysResolve(this.getGlobalTwitchEmotes()),
      alwaysResolve(this.getGlobalFFZEmotes()),
      alwaysResolve(this.getGlobalBTTVEmotes()),
      alwaysResolve(this.getGlobalBits())
    ]);
  }

  getChannelEmotes(channelObj) {
    const emoteHolder = {
      cheermotes: new Map(),
      thirdPartyEmotes: new Map(),
      emotes: []
    };
    this.channelEmotes.set(channelObj.id, emoteHolder);
    return Promise.all([
      alwaysResolve(this.getChannelBits(channelObj, emoteHolder)),
      alwaysResolve(this.getChannelFFZEmotes(channelObj, emoteHolder)),
      alwaysResolve(this.getChannelBTTVEmotes(channelObj, emoteHolder))
    ]);
  }

  getGlobalTwitchEmotes() {
    return this.ApiService.twitchGet(`https://api.twitch.tv/v5/users/${this.user.id}/emotes?on_site=1`, null, this.user.token).then(response => {
      _.each(response.data.emoticon_sets, (emoteSet, emoteSetId) => {
        _.each(emoteSet, emote => {
          emote.url = `https://static-cdn.jtvnw.net/emoticons/v1/${emote.id}/1.0`;
          emote.origin = 'twitch global';
          emote.setID = emoteSetId;
          emote.code = instantiateRegex(emote.code);
          const prefixMatch = /^([a-z0-9]+|:-)([A-Z0-9]\w*)$/.exec(emote.code);
          if (prefixMatch) {
            emote.prefix = prefixMatch[1];
            emote.prefixless = prefixMatch[2].toLowerCase();
          }
          this.emotes.push(emote);
        });
      });
      this.emotes = _.sortBy(this.emotes, 'code');
    }).catch(() => {

    });
  }

  getGlobalFFZEmotes() {
    return this.ApiService.get('https://api.frankerfacez.com/v1/set/global').then(response => {
      _.each(response.data.default_sets, setID => {
        _.each(response.data.sets[setID].emoticons, emote => {
          const emoteObj = {
            id: emote.id,
            url: _.findLast(emote.urls),
            code: emote.name,
            origin: 'ffz global',
            setID
          };
          this.emotes.push(emoteObj);
          this.thirdPartyEmotes.set(emote.name, emoteObj);
        });
      });
    }).catch(() => {

    });
  }

  getGlobalBTTVEmotes() {
    return this.ApiService.get('https://api.betterttv.net/2/emotes').then(response => {
      _.each(response.data.emotes, emote => {
        const emoteObj = {
          id: emote.id,
          url: response.data.urlTemplate.replace('{{id}}', emote.id).replace('{{image}}', '1x'),
          code: emote.code,
          origin: 'bttv global',
          setID: 'global'
        };
        this.emotes.push(emoteObj);
        this.thirdPartyEmotes.set(emote.code, emoteObj);
      });
    }).catch(() => {

    });
  }

  getGlobalBits() {
    return this.ApiService.twitchGet('https://api.twitch.tv/kraken/bits/actions').then(response => {
      _.each(response.data.actions, cheermote => {
        const scale = _.last(cheermote.scales);
        const background = 'dark';
        const state = 'animated';
        const cheerObj = {
          name: cheermote.prefix,
          id: cheermote.prefix.toLowerCase(),
          tiers: _.sortBy(_.map(cheermote.tiers, tier => ({
            name: `${cheermote.prefix} ${tier.min_bits}`,
            minBits: tier.min_bits,
            url: tier.images[background][state][scale],
            color: tier.color
          })), 'minBits')
        };
        this.cheermotes.set(cheerObj.id, cheerObj);
      });
    }).catch(() => {

    });
  }

  getChannelFFZEmotes(channelObj, holder) {
    return this.ApiService.get(`https://api.frankerfacez.com/v1/room/id/${channelObj.id}`).then(response => {
      _.each(response.data.sets, (set, setID) => {
        _.each(set.emoticons, emote => {
          const emoteObj = {
            id: emote.id,
            url: _.findLast(emote.urls),
            code: emote.name,
            origin: channelObj,
            setID
          };
          holder.emotes.push(emoteObj);
          holder.thirdPartyEmotes.set(emote.name, emoteObj);
        });
      });
    }).catch(() => {

    });
  }

  getChannelBTTVEmotes(channelObj, holder) {
    return this.ApiService.get(`https://api.betterttv.net/2/channels/${channelObj.name}`).then(response => {
      _.each(response.data.emotes, emote => {
        const emoteObj = {
          id: emote.id,
          url: response.data.urlTemplate.replace('{{id}}', emote.id).replace('{{image}}', '1x'),
          code: emote.code,
          origin: channelObj,
          setID: 'global'
        };
        holder.emotes.push(emoteObj);
        holder.thirdPartyEmotes.set(emote.code, emoteObj);
      });
    }).catch(() => {

    });
  }

  getChannelBits(channelObj, holder) {
    return this.ApiService.twitchGet(`https://api.twitch.tv/kraken/bits/actions?channel_id=${channelObj.id}`).then(response => {
      _.each(response.data.actions, cheermote => {
        if (cheermote.type === 'channel_custom') {
          const scale = _.last(cheermote.scales);
          const background = 'dark';
          const state = 'animated';
          const cheerObj = {
            name: cheermote.prefix,
            id: cheermote.prefix.toLowerCase(),
            tiers: _.sortBy(_.map(cheermote.tiers, tier => ({
              name: `${cheermote.prefix} ${tier.min_bits}`,
              minBits: tier.min_bits,
              url: tier.images[background][state][scale],
              color: tier.color
            })), 'minBits')
          };
          holder.cheermotes.set(cheerObj.id, cheerObj);
        }
      });
    }).catch(() => {

    });
  }
}
