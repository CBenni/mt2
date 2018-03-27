export default function onScrollDirective() {
  return {
    restrict: 'A',
    scope: {
      onScroll: '&'
    },
    link($scope, $element, attrs) {
      console.log('Creating onscroll directive!', $scope, $element, attrs);
      const lastScroll = $element[0].scrollTop;
      const onScroll = event => {
        const direction = $element[0].scrollTop - lastScroll;
        $scope.onScroll({
          $event: event, $element, scrollPos: $element[0].scrollTop, direction
        });
      };

      onScroll(null);

      $element.on('scroll', onScroll);

      $scope.$on('$destroy', () => {
        $element.off('scroll', onScroll);
      });
    }
  };
}
