import angular from 'angular';
import _ from 'lodash';
import fileSaver from 'file-saver';

import DialogController from './dialogcontroller';
import { genNonce, loadJSONFromFile } from '../helpers';
import defaultConfig from '../defaultConfig';
import iconCodes from '../iconCodes.json';

export default class SettingsDialogController extends DialogController {
  constructor($scope, $mdDialog, $mdToast) {
    'ngInject';

    super($scope, $mdDialog);
    this.$mdDialog = $mdDialog;
    this.$mdToast = $mdToast;

    this.importFile = '';
    $scope.settings = this.mainCtrl.config.settings;
    if (!$scope.settings) {
      $scope.settings = _.extend({}, defaultConfig.settings);
      this.mainCtrl.config.settings = $scope.settings;
    }

    $scope.defaultButton = {
      action: {
        type: 'command',
        command: '/timeout {{user.name}} 60'
      },
      tooltip: '1 min timeout',
      icon: {
        type: 'text',
        text: '60s'
      },
      hotkey: ''
    };

    $scope.defaultChatHeaderButton = {
      action: {
        type: 'command',
        command: '/help'
      },
      tooltip: 'New Button',
      icon: {
        type: 'text',
        text: 'Button'
      },
      hotkey: ''
    };

    this.defaultChatPreset = {
      name: 'Chat',
      icon: {
        type: 'icon',
        code: 'chat'
      },
      settings: {
        incognito: false,
        messageFilters: [
          'modlogs',
          'subs',
          'chat',
          'bots',
          'mentions',
          'bits',
          'automod'
        ]
      }
    };

    this.initDefault('style');
    this.initDefault('styleSheet');
    this.initDefault('modButtons');
    this.initDefault('modCardButtons');
    this.initDefault('chatHeaderButtons');
    this.initDefault('colorAdjustment');
    this.initDefault('monoColor');
    this.initDefault('chatSettings');
    this.initDefault('chatPresets');
    this.initDefault('timeFormat');
    this.initDefault('scrollbackLength');
    this.initDefault('chatSettings.extraMentions');

    this.iconCodes = iconCodes;
  }

  initDefault(setting) {
    if (_.get(this.$scope.settings, setting) === undefined) {
      _.set(this.$scope.settings, setting, this.mainCtrl.getSetting(setting));
    }
  }

  addChatPreset() {
    const newPreset = angular.copy(this.defaultChatPreset);
    newPreset.id = genNonce();
    this.$scope.settings.chatPresets.push(newPreset);
  }

  deleteChatPreset(preset) {
    _.pull(this.$scope.settings.chatPresets, preset);
  }

  exportSettings() {
    fileSaver.saveAs(new File([angular.toJson(this.mainCtrl.config)], 'modchat-settings.json', { type: 'application/json;charset=utf-8' }));
  }

  importSettings($event) {
    const confirm = this.$mdDialog.confirm()
    .title('Import settings')
    .textContent('Are you sure you want to import stored settings? This will replace your current settings.')
    .targetEvent($event)
    .ok('OK')
    .cancel('Cancel')
    .multiple(true);

    loadJSONFromFile().then(config => {
      this.$mdDialog.show(confirm)
      .then(() => {
        if (config.settings) {
          localStorage.setItem('mt2-config', angular.toJson(config));
          window.location.reload();
        } else {
          throw new Error('Config invalid!');
        }
      }).catch(err => {
        this.$mdToast.simple()
        .textContent(`Import error: ${err.toString()}`);
      });
    });
  }

  resetSettings($event) {
    const confirm = this.$mdDialog.confirm()
    .title('Reset settings')
    .textContent('Are you sure you want to clear all settings? This cannot be undone.')
    .targetEvent($event)
    .ok('OK')
    .cancel('Cancel')
    .multiple(true);

    this.$mdDialog.show(confirm)
    .then(() => {
      localStorage.removeItem('mt2-config');
      window.location.reload();
    })
    .catch(() => {});
  }
}
