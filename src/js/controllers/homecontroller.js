import _ from 'lodash';

export default class HomeController {
  constructor($scope, $timeout, ApiService) {
    'ngInclude';

    this.$timeout = $timeout;
    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.ApiService = ApiService;
    this.mainCtrl = $scope.$parent.mainCtrl;

    this.streamSearchText = '';
    this.globalStreams = [];
    this.followedStreams = [];
    this.searchedStreams = [];

    this.searchForStreamsThrottled = _.throttle(() => {
      this.searchForStreams();
    }, 500);

    this.getGlobalStreams();
    $timeout(() => { this.getFollowedStreams(); });

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
    if (this.streamSearchText.length > 0) {
      const searchResponse = await this.searchForStreamsThrottled();
      if (searchResponse && searchResponse.data.streams) {
        this.searchedStreams = searchResponse.data.streams;
      }
    }
  }

  getStreams() {
    if (this.searchedStreams.length > 0) return this.searchedStreams;
    if (this.followedStreams.length > 0) return this.followedStreams;
    return this.globalStreams;
  }

  searchForStreams() {
    try {
      if (this.streamSearchText.length > 0) {
        return this.ApiService.twitchGet(`https://api.twitch.tv/kraken/search/streams?query=${window.encodeUriComponent(this.streamSearchText)}`);
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  }

  debugTest(...args) {
    console.log('Debug test: ', args);
  }
}
