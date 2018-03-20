export default class DialogController {
  constructor($scope, $mdDialog) {
    'ngInject';

    this.$scope = $scope;
    this.$mdDialog = $mdDialog;

    $scope.hide = () => {
      $mdDialog.hide();
    };
    $scope.cancel = () => {
      $mdDialog.cancel();
    };
    $scope.answer = answer => {
      $mdDialog.hide(answer);
    };
  }
}
