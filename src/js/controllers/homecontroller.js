export default class HomeController {
  constructor($scope) {
    'ngInclude';

    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;

    this.debugTest(this);

    this.currentChannel = 'cbenni';
  }

  debugTest(...args) {
    console.log('Debug test: ', args);
  }
}
