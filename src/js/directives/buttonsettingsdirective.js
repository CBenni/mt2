import buttonSettingsTemplate from '../../templates/buttonsettings.html';


export default function buttonSettingsDirective() {
  return {
    restrict: 'EAC',
    template: buttonSettingsTemplate,
    scope: {
      buttons: '=',
      defaultButton: '='
    },
    controller: 'ButtonSettingsController',
    controllerAs: 'btnsCtrl',
    bindToController: true
  };
}
