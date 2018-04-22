import angular from 'angular';
import _ from 'lodash';

import iconCodes from '../iconCodes.json';

export default class ButtonSettingsController {
  constructor($scope) {
    'ngInject';

    this.$scope = $scope;
    this.iconCodes = iconCodes;
  }

  deleteButton(button) {
    _.pull(this.buttons, button);
  }

  addButton() {
    this.buttons.push(angular.copy(this.defaultButton));
  }

  setHotkey(button, $event) {
    let code = '';
    if ($event) {
      code = $event.originalEvent.code;
      if (code === 'Escape') code = '';
      $event.preventDefault();
      $event.stopImmediatePropagation();
    }
    button.hotkey = code;
  }
}
