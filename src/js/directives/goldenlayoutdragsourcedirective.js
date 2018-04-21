import _ from 'lodash';

export default function goldenLayoutDragSource() {
  return {
    restrict: 'A',
    scope: {
      goldenLayoutDragSource: '=',
      glDsLayout: '=',
      glDsChannel: '=',
      glDsTemplate: '=',
      glDsPreset: '=',
      glDsIcon: '='
    },
    link($scope, $element) {
      const config = {
        title: $scope.glDsChannel,
        type: 'component',
        componentName: 'angularModule',
        componentState: {
          module: 'mtApp',
          templateId: $scope.glDsTemplate,
          channel: $scope.glDsChannel,
          preset: $scope.glDsPreset,
          icon: $scope.glDsIcon
        }
      };

      $scope.$watch('glDsChannel', () => {
        config.title = $scope.glDsChannel;
        config.componentState.channel = $scope.glDsChannel;
      });
      $scope.$watch('glDsTemplate', () => {
        config.componentState.templateId = $scope.glDsTemplate;
      });
      const dragSource = $scope.glDsLayout.createDragSource($element[0], config);

      $scope.$on('$destroy', () => {
        dragSource._dragListener.destroy();
        _.pull($scope.glDsLayout._dragSources, dragSource);
      });
    }
  };
}
