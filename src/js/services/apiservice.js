import config from '../config.json';

export default class ApiService {
  constructor($http, $cookies, $rootScope, $timeout) {
    'ngInject';

    this.$rootScope = $rootScope;
    this.$timeout = $timeout;
    this.$http = $http;
    this.auth = { userName: $cookies.get('login') || '', token: $cookies.get('token') || '' };

    this.userCache = {}; // maps userID to a user object
    this.userPromises = {}; // maps a userID to a promise
  }

  forceDigest(x) {
    this.$rootScope.$applyAsync(x);
  }

  twitchGet(endpoint, headers, token, query) {
    this.nothing = false;
    if (!headers) headers = {};
    headers['Client-ID'] = config.auth.client_id;
    if (token) headers.Authorization = `OAuth ${token}`;
    if (!headers.Accept) headers.Accept = 'application/vnd.twitchtv.v5+json';
    return this.$http.get(endpoint, { headers, params: query });
  }

  twitchGetUserByName(name) {
    if (/^\w+$/.test(name)) {
      return this.twitchGet(`https://api.twitch.tv/kraken/users/?login=${name}`).then(response => {
        if (response.data.users) {
          return response.data.users[0];
        }
        throw new Error(`User ${name} not found`);
      });
    }
    throw new Error(`Invalid username ${name}`);
  }

  twitchGetUserByID(userID) {
    if (/^\d+$/.test(userID)) {
      if (!this.userPromises[userID]) {
        this.userPromises[userID] = this.twitchGet(`https://api.twitch.tv/kraken/users/${userID}`).then(response => {
          if (response.data) {
            this.userCache[userID] = response.data;
            return response.data;
          }
          throw new Error(`User ${userID} not found`);
        });
      }
      return this.userPromises[userID];
    }
    throw new Error(`Invalid user ID ${userID}`);
  }
}
