import angular from 'angular';
import GoldenLayout from 'golden-layout';
import $ from 'jquery';
import _ from 'lodash';

import defaultConfig from '../defaultConfig.json';
import config from '../config.json';

import chatTemplate from '../../templates/chatwindow.html';
import streamTemplate from '../../templates/streamwindow.html';
import homeTemplate from '../../templates/homewindow.html';

const windowTemplates = {
  chatTemplate,
  streamTemplate,
  homeTemplate
};


export default class MainController {
  constructor($compile, $scope, ApiService, ChatService) {
    'ngInclude';

    this.profiles = [{
      name: 'Default',
      config: defaultConfig
    }];

    // initialize layout
    const storedProfiles = localStorage.getItem('mt2-profiles');
    if (storedProfiles) this.profiles = JSON.parse(storedProfiles);
    const currentProfile = localStorage.getItem('mt2-currentProfile');
    if (currentProfile) this.selectedProfile = parseInt(currentProfile, 10);
    else this.selectedProfile = 0;

    const layout = new GoldenLayout(this.getCurrentProfile().config, $('#layout-container'));
    this.layout = layout;

    console.log(windowTemplates);
    const AngularModuleComponent = (container, state) => {
      const html = windowTemplates[state.templateId];
      const element = container.getElement();

      element.html(html);

      const linkFun = $compile(element);
      const newScope = $scope.$new(true, $scope);
      newScope.container = container;
      newScope.state = state;
      newScope.mainCtrl = this;
      linkFun(newScope);
    };

    layout.registerComponent('angularModule', AngularModuleComponent);
    layout.init();

    layout.on('stateChanged', () => {
      this.getCurrentProfile().config = layout.toConfig();
      localStorage.setItem('mt2-profiles', angular.toJson(this.profiles));
    });

    // initialize authentication
    const auth = localStorage.getItem('mt2-auth');
    if (auth) {
      this.auth = JSON.parse(auth);
      ChatService.init(this.auth);
    }

    if (window.location.hash) {
      let match;
      const hasRegex = /(\w+)=(\w*)/g;
      while (match = hasRegex.exec(window.location.hash)) { // eslint-disable-line no-cond-assign
        const [property, value] = match.slice(1);
        if (property === 'access_token') {
          ApiService.twitchGet('https://api.twitch.tv/kraken/', null, value).then(result => {
            if (result.data.token.valid) {
              this.auth = {
                name: result.data.token.user_name,
                id: result.data.token.user_id,
                token: value
              };
              ChatService.init(this.auth);
              localStorage.setItem('mt2-auth', JSON.stringify(this.auth));
              this.removeHash();
              window.location.reload(true);
            } else {
              alert('Invalid token');
            }
          });
        }
      }
    }
  }

  getTitle() {
    return 'ModTwitch by CBenni';
  }

  getCurrentProfile() {
    return this.profiles[this.selectedProfile];
  }

  updateConfig() {
  }

  loginWithTwitch() {
    window.location.href = `https://id.twitch.tv/oauth2/authorize?client_id=${config.auth.client_id}&redirect_uri=${config.auth.redirect_uri}&response_type=token&scope=chat_login`;
  }

  logoutFromTwitch() {
    localStorage.removeItem('mt2-auth');
    window.location.reload(true);
  }

  removeHash() {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}
