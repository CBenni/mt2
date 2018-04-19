import chatLineTemplate from '../../templates/chatline.html';

export function onScrollDirective() {
  return {
    restrict: 'A',
    link($scope, $element, attrs) {
      $element.bind('scroll', event => {
        $scope.$eval(attrs.onScroll, { $event: event, $element, scrollPos: $element[0].scrollTop });
      });
    }
  };
}

export function compileDirective($compile) {
  'ngInject';

  return {
    restrict: 'A',
    link: ($scope, $element, attrs) => {
      $scope.$watch(scope => scope.$eval(attrs.compile), value => {
        $element.html(value);
        $compile($element.children('.compile'))($scope);
      });
    }
  };
}

export function chatLineDirective() {
  return {
    restrict: 'AC',
    template: chatLineTemplate
  };
}

export function isntEmptyFilter() {
  return obj => obj && Object.keys(obj).length > 0;
}
