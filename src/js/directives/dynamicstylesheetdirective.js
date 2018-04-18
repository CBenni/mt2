export default function DynamicStylesheetDirective() {
  'ngInject';

  return {
    restrict: 'A',
    scope: {
      dynamicStylesheet: '='
    },
    link: ($scope, element) => {
      element.attr('href', $scope.dynamicStylesheet);

      $scope.$watch('dynamicStylesheet', () => {
        element.prop('disabled', 'disabled');
        setTimeout(() => {
          element.attr('href', $scope.dynamicStylesheet);
          element.prop('disabled', '');
        }, 10);
      });
    }
  };
}
