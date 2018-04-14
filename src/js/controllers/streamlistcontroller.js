
export default class StreamListController {
  constructor($scope) {
    'ngInject';

    this.$scope = $scope;
    $scope.homeCtrl = $scope.$parent.mainCtrl;
    $scope.mainCtrl = $scope.$parent.$parent.mainCtrl;
  }
}
