export default function goldenLayoutDragSource() {
  return {
    restrict: 'A',
    scope: {
      goldenLayoutDragSource: '=',
      glDsLayout: '=',
      glDsChannel: '=',
      glDsTemplate: '='
    },
    link($scope, $element) {
      const config = {
        title: $scope.glDsChannel,
        type: 'component',
        componentName: 'angularModule',
        componentState: {
          module: 'mtApp',
          templateId: $scope.glDsTemplate,
          channel: $scope.glDsChannel
        }
      };

      $scope.$watch('glDsChannel', () => {
        config.title = $scope.glDsChannel;
        config.componentState.channel = $scope.glDsChannel;
      });
      $scope.$watch('glDsTemplate', () => {
        config.componentState.templateId = $scope.glDsTemplate;
      });
      console.log('Enabling drag source for ', config);
      $scope.glDsLayout.createDragSource($element[0], config);
    }
  };
}
