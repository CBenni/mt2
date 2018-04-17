export default class AutocompletePanelController {
  constructor(mdPanelRef) {
    'ngInject';

    this.mdPanelRef = mdPanelRef;
  }

  selectItem(item) {
    this.info.selectedItem = item;
    this.mdPanelRef.close('click');
  }
}
