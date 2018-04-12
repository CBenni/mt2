import streamListTemplate from '../../templates/streamlisttemplate.html';


export default function streamListDirective() {
  return {
    restrict: 'A',
    template: streamListTemplate,
    scope: {
      streamList: '='
    },
    controller: 'StreamListController',
    controllerAs: 'streamsCtrl',
    bindToController: true
  };
}
