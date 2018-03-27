import 'jquery-ui/ui/widgets/sortable';

export default function () {
  return {
    restrict: 'A',
    link($scope, element, attrs) {
      const options = $scope.$eval(attrs.draggable);
      element.draggable(options);
    }
  };
}
