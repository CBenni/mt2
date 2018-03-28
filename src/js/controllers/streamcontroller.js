export default class StreamController {
  constructor($sce, $scope) {
    'ngInject';

    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.$sce = $sce;

    this.container.setTitle(this.state.channel);
  }

  getEmbedUrl() {
    return this.$sce.trustAsResourceUrl(`https://player.twitch.tv/?channel=${this.state.channel}`);
  }
}
