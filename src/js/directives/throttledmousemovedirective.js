export default function throttledMousemoveDirective(ThrottledDigestService) {
  'ngInject';

  return {
    restrict: 'A',
    scope: {
      throttledMousemove: '&'
    },
    link($scope, $element) {
      const onMousemove = event => {
        ThrottledDigestService.$apply(() => {
          $scope.throttledMousemove(event);
        });
      };

      $element.on('mousemove', onMousemove);

      $scope.$on('$destroy', () => {
        $element.off('mousemove', onMousemove);
      });
    }
  };
}
