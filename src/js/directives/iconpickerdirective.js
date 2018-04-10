import iconPickerPanelTemplate from '../../templates/iconpickerpanel.html';
import iconPickerTemplate from '../../templates/iconpicker.html';


export function iconPickerDirective() {
  return {
    restrict: 'EAC',
    template: iconPickerTemplate,
    scope: '',
    controller: 'IconPickerController',
    controllerAs: 'iconPickerCtrl',
    bindToController: true
  };
}

export const iconPickerPanelPreset = {
  controller: 'IconPickerPanelController',
  controllerAs: 'iconPickerPanelCtrl',
  template: iconPickerPanelTemplate,
  panelClass: 'icon-picker-dropdown',
  'z-index': 85,
  clickOutsideToClose: true,
  escapeToClose: true
};
