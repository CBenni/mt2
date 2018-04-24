import _ from 'lodash';
import SettingsDialog from '../../templates/settingsdialog.html';

function uniquifySearchResults(results) {
  const streams = {};
  _.each(results, stream => {
    const oldStream = streams[stream.channel._id] || {};
    if (oldStream.priority > stream.priority) {
      streams[stream.channel._id] = _.merge(stream, oldStream);
    } else {
      streams[stream.channel._id] = _.merge(oldStream, stream);
    }
  });
  return _.values(streams);
}

function mockStreamFromChannel(channel) {
  const videoBanner = channel.video_banner || '/assets/defaultChannelBanner-1920x1080.png';
  return {
    preview: {
      small: videoBanner.replace('1920x1080', '240x135'),
      medium: videoBanner.replace('1920x1080', '480x270'),
      large: videoBanner
    },
    channel
  };
}

function setPriority(array, basePriority = 0) {
  let cnt = 0;
  _.each(array, item => {
    item.priority = basePriority + (cnt++);
  });
  return array;
}

export default class HomeController {
  constructor($scope, $timeout, ApiService, $mdDialog) {
    'ngInject';

    this.$timeout = $timeout;
    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.ApiService = ApiService;
    this.mainCtrl = $scope.$parent.mainCtrl;
    this.$mdDialog = $mdDialog;

    this.streamSearchText = '';
    this.globalStreams = [];
    this.followedStreams = [];
    this.searchedStreams = null;
    this.selectedStreamsTab = 0;

    this.searchForStreamsDebounced = _.debounce(searchText => this.searchForStreams(searchText), 500);
    this.currentStreamSearch = null;

    this.getGlobalStreams();
    $timeout(() => {
      if (this.mainCtrl.auth) this.selectedStreamsTab = 1;
      this.getFollowedStreams();
    });

    this.currentChannel = 'cbenni';
  }

  async getGlobalStreams() {
    try {
      const streamsResponse = await this.ApiService.twitchGet('https://api.twitch.tv/kraken/streams/');
      if (streamsResponse.data.streams) {
        this.globalStreams = streamsResponse.data.streams;
      }
    } catch (err) {
      console.error(err);
    }

    this.$timeout(() => {
      this.getGlobalStreams();
    }, 60 * 1000);
  }

  async getFollowedStreams() {
    if (this.mainCtrl.auth) {
      try {
        const streamsResponse = await this.ApiService.twitchGet('https://api.twitch.tv/kraken/streams/followed/', null, this.mainCtrl.auth.token);
        if (streamsResponse.data.streams) {
          this.followedStreams = streamsResponse.data.streams;
        }
      } catch (err) {
        console.error(err);
      }

      this.$timeout(() => {
        this.getFollowedStreams();
      }, 60 * 1000);
    }
  }

  async getSearchedStreams() {
    const searchText = this.streamSearchText;
    this.searchForStreamsDebounced(searchText);
  }

  getStreams() {
    if (this.searchedStreams !== null) return this.searchedStreams;
    if (this.followedStreams.length > 0) return this.followedStreams;
    return this.globalStreams;
  }

  searchForStreams(searchText) {
    try {
      if (searchText.length > 0) {
        const streamsSearch = this.ApiService.twitchGet(`https://api.twitch.tv/kraken/search/streams?query=${window.encodeURIComponent(searchText)}&limit=25`)
        .then(response => setPriority(response.data.streams, 1000));
        const channelLookup = this.ApiService.twitchGetUserByName(searchText).then(user => {
          if (user) return this.ApiService.twitchGet(`https://api.twitch.tv/kraken/channels/${user._id}`).then(response => setPriority([mockStreamFromChannel(response.data)], 10000));
          return [];
        });
        const channelSearch = this.ApiService.twitchGet(`https://api.twitch.tv/kraken/search/channels?query=${window.encodeURIComponent(searchText)}&limit=25`)
        .then(response => {
          const channels = response.data.channels;
          return setPriority(_.map(channels, mockStreamFromChannel), 0);
        });
        return Promise.all([streamsSearch, channelLookup, channelSearch]).then(results => {
          this.searchedStreams = _.orderBy(uniquifySearchResults(_.flatten(results)), ['priority'], ['desc']);
          this.selectedStreamsTab = 2;
        }).catch(err => {
          console.log('Search failed', err);
        });
      }
      this.searchedStreams = null;
    } catch (err) {
      console.error(err);
    }
    return null;
  }

  debugTest(...args) {
    console.log('Debug test: ', args);
  }

  openSettings($event) {
    this.$mdDialog.show({
      template: SettingsDialog,
      targetEvent: $event,
      clickOutsideToClose: true,
      escapeToClose: true,
      controller: 'SettingsDialogController',
      controllerAs: 'dialogCtrl',
      locals: {
        mainCtrl: this.mainCtrl,
        homeCtrl: this
      },
      bindToController: true
    }).finally(() => {
      this.mainCtrl.updateConfig();
    });
  }
}
