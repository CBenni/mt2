export default class AutocompletePanelController {
  constructor($scope, mdPanelRef, ThrottledDigestService) {
    'ngInject';

    this.$scope = $scope;
    this.mdPanelRef = mdPanelRef;
    this.ThrottledDigestService = ThrottledDigestService;
  }

  selectItem(item) {
    this.info.selectedItem = item;
    this.mdPanelRef.close('click');
  }
}
