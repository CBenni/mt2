import _ from 'lodash';

import whisperToastTemplate from '../../templates/whispertoasttemplate.html';
import { getFullName } from '../helpers';

function idLarger(id1, id2) {
  if (id1.length > id2.length) return true;
  if (id2.length > id1.length) return false;
  return id1 > id2;
}

function createThreadID(userID, userID2) {
  if (idLarger(userID, userID2)) {
    return `${userID2}_${userID}`;
  }
  return `${userID}_${userID2}`;
}

export default class WhisperController {
  constructor($scope, $timeout, $sce, $filter, $mdToast, ApiService, ChatService, ThrottledDigestService) {
    'ngInject';

    this.ApiService = ApiService;
    this.ChatService = ChatService;
    this.ThrottledDigestService = ThrottledDigestService;
    this.mainCtrl = $scope.$parent.mainCtrl;
    this.$scope = $scope;
    this.$sce = $sce;
    this.$filter = $filter;
    this.$mdToast = $mdToast;

    this.mainCtrl.whisperController = this;

    this.isSidenavOpen = true;
    this.whisperInputContent = '';

    $timeout(() => {
      if (this.mainCtrl.auth) {
        this.conversations = [];
        this.loadConversations();
        ChatService.on('whisper_received', pubsubMessage => {
          this.addWhisper(pubsubMessage.data.message.data).then(() => {
            this.ThrottledDigestService.$apply(() => { });
          });
        });
        ChatService.on('whisper_sent', pubsubMessage => {
          this.addWhisper(pubsubMessage.data.message.data).then(() => {
            this.ThrottledDigestService.$apply(() => { });
          });
        });
      }
    });

    $scope.$parent.onTabActive = () => {
      if (this.selectedConversation) {
        this.markAsRead(this.selectedConversation);
        // this.selectedConversation.lastRead = this.selectedConversation.lastMessage.id;
      }
      this.updateUnreadStatus();
    };
  }

  loadConversations() {
    this.ApiService.twitchGet('https://im-proxy.modch.at/v1/threads?limit=50', null, this.mainCtrl.auth.token).then(response => {
      this.conversations = _.map(response.data.data, conversation => {
        const otherUser = _.find(conversation.participants, participant => `${participant.id}` !== this.mainCtrl.auth.id);
        const user = {
          id: otherUser.id,
          name: otherUser.username,
          displayName: otherUser.display_name,
          fullName: getFullName(otherUser.username, otherUser.display_name),
          color: otherUser.color,
          badges: otherUser.badges,
          profileImage: otherUser.profile_image && otherUser.profile_image['50x50'].url
        };
        const lastMessage = {
          id: conversation.last_message.id,
          trailing: conversation.last_message.body,
          tags: conversation.last_message.tags,
          time: new Date(conversation.last_message.sent_ts * 1000),
          user
        };
        lastMessage.html = this.$sce.trustAsHtml(this.ChatService.renderMessage(lastMessage, lastMessage.tags.emotes));
        return {
          id: conversation.id,
          user,
          lines: null,
          lastMessage,
          whisperText: '',
          lastRead: conversation.last_read
        };
      });
      this.updateUnreadStatus();
    });
  }

  async selectConversation(conversation) {
    await this.initConversation(conversation);
    this.selectedConversation = conversation;
    this.isSidenavOpen = false;
    this.mainCtrl.selectWhisperTab();
    this.markAsRead(conversation);
  }

  initConversation(conversation) {
    if (conversation.lines) {
      return conversation;
    }
    conversation.lastDate = '';
    return this.ApiService.twitchGet(`https://im-proxy.modch.at/v1/threads/${conversation.id}/messages?limit=20`, null, this.mainCtrl.auth.token).then(response => {
      this.updateUnreadStatus();
      conversation.lines = _.map(_.reverse(response.data.data), message => {
        const date = new Date(message.sent_ts * 1000);
        let dateString = this.$filter('date')(date);
        if (dateString === conversation.lastDate) dateString = '';
        else conversation.lastDate = dateString;
        const line = {
          id: message.id,
          trailing: message.body,
          tags: message.tags,
          time: date,
          date: dateString,
          user: {
            id: message.from_id,
            name: message.tags.login,
            displayName: message.tags.display_name,
            fullName: getFullName(message.tags.login, message.tags.display_name),
            color: message.tags.color
          }
        };
        line.html = this.$sce.trustAsHtml(this.ChatService.renderMessage(line, line.tags.emotes));
        return line;
      });
      return conversation;
    });
  }

  markAsRead(conversation) {
    return this.ApiService.twitchPost(`https://im-proxy.modch.at/v1/threads/${conversation.id}`, { mark_read: conversation.lastMessage.id }, null, this.mainCtrl.auth.token).then(response => {
      conversation.lastRead = response.data.last_read;
      this.updateUnreadStatus();
    });
  }

  async addWhisper(msg) {
    if (msg.tags.badges && msg.tags.badges.length > 0) await this.upgradeBadges(msg.tags.badges);

    let isAction = false;
    const actionmatch = /^\u0001ACTION (.*)\u0001$/.exec(msg.body);
    if (actionmatch != null) {
      isAction = true;
      msg.body = actionmatch[1];
    }


    const transformedMessage = {
      time: msg.sent_ts ? new Date(msg.sent_ts * 1000) : new Date(),
      tags: msg.tags,
      trailing: msg.body,
      user: {
        id: msg.from_id,
        name: msg.tags.login,
        displayName: msg.tags.display_name,
        fullName: getFullName(msg.tags.login, msg.tags.display_name),
        color: msg.tags.color,
        badges: msg.tags.badges
      },
      isAction,
      recipient: msg.recipient,
      threadID: msg.thread_id,
      id: msg.id
    };
    transformedMessage.html = this.$sce.trustAsHtml(this.ChatService.renderMessage(transformedMessage, transformedMessage.tags.emotes));

    const conversation = this.findConversation(transformedMessage);

    await this.initConversation(conversation);
    let dateString = this.$filter('date')(transformedMessage.time);
    if (dateString === conversation.lastDate) dateString = '';
    else conversation.lastDate = dateString;
    transformedMessage.date = dateString;
    conversation.lines.push(transformedMessage);
    conversation.lastMessage = transformedMessage;

    if (`${msg.from_id}` !== this.mainCtrl.auth.id && (this.selectedConversation !== conversation || !this.$scope.$parent.tab.isActive)) {
      this.$mdToast.show({
        hideDelay: 5000,
        position: 'top right',
        template: whisperToastTemplate,
        controller: 'WhisperToastController',
        controllerAs: 'whisperToastCtrl',
        locals: {
          conversation,
          whisperCtrl: this,
          message: transformedMessage
        },
        bindToController: true
      });
    } else {
      conversation.lastRead = transformedMessage.id;
    }
    this.updateUnreadStatus();
  }

  openConversation(user) {
    const threadID = createThreadID(this.mainCtrl.auth.id, user.id);
    const convo = this.findConversation({ user, threadID });
    this.selectConversation(convo);
  }

  findConversation(msg) {
    let convo = _.find(this.conversations, conversation => conversation.id === msg.threadID);
    if (!convo) {
      let otherUser = msg.user;
      if (`${otherUser.id}` === this.mainCtrl.auth.id) {
        // we sent the message ourselves, find the other user
        otherUser = {
          id: msg.recipient.id,
          name: msg.recipient.username,
          displayName: msg.recipient.display_name,
          fullName: getFullName(msg.recipient.username, msg.recipient.display_name),
          color: msg.recipient.color,
          badges: msg.recipient.badges
        };
        this.upgradeBadges(otherUser.badges);
      }

      this.ApiService.twitchGet(`https://api.twitch.tv/kraken/channels/${otherUser.id}`).then(response => {
        otherUser.profileImage = response.data.logo;
      });
      convo = {
        user: otherUser,
        lines: null,
        whisperText: '',
        collapse: false,
        id: msg.threadID
      };
      this.conversations.unshift(convo);
    }
    return convo;
  }

  sendWhisper($event, conversation) {
    if ($event.keyCode === 13 && conversation.whisperText.length > 0) {
      this.ChatService.chatSend(`PRIVMSG #jtv :/w ${conversation.user.name} ${conversation.whisperText}`);
      conversation.whisperText = '';
    }
  }

  async upgradeBadges(badgeList) {
    const badges = await this.ChatService.getBadges();
    _.each(badgeList, badge => {
      const badgeSet = badges[badge.id];
      if (badgeSet) {
        const versionInfo = badgeSet.versions[badge.version];
        if (versionInfo) {
          badge.url = versionInfo.image_url_1x;
          badge.title = versionInfo.title;
          badge.name = badge.id;
        }
      }
    });
  }

  openMenu($mdMenu, ev) {
    $mdMenu.open(ev);
  }

  updateUnreadStatus() {
    const unread = _.countBy(this.conversations, conversation => (conversation.lastMessage.id - (conversation.lastRead || 0)) > 0).true;
    console.log('Unread whispers: ', unread);
    this.$scope.$parent.notifications = unread;
  }
}
