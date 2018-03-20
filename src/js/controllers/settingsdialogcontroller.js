import _ from 'lodash';
import DialogController from './dialogcontroller';
import defaultProfile from '../defaultProfile.json';

export default class SettingsDialogController extends DialogController {
  constructor($scope, $mdDialog) {
    'ngInject';

    super($scope, $mdDialog);

    $scope.settings = this.mainCtrl.getCurrentProfile().settings;
    if (!$scope.settings) {
      $scope.settings = _.extend({}, defaultProfile.settings);
      this.mainCtrl.getCurrentProfile().settings = $scope.settings;
    }
    console.log('Initialized SettingsDialogController', this);
    this.initDefault('style');
    this.initDefault('styleSheet');
    this.initDefault('modButtons');
    this.initDefault('timeFormat');
  }

  initDefault(setting) {
    if (!_.get(this.$scope.settings, setting)) {
      _.set(this.$scope.settings, setting, this.mainCtrl.getSetting(setting));
    }
  }

  deleteModButton(button) {
    _.pull(this.$scope.settings.modButtons, button);
  }

  addModButton() {
    this.$scope.settings.modButtons.push({
      action: {
        type: 'command',
        command: '/timeout {{user.name}} 60'
      },
      tooltip: '1 min timeout',
      icon: {
        type: 'text',
        text: '60s'
      }
    });
  }
}
