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

export function scrollToBottomDirective() {
  return {
    restrict: 'A',
    link($scope, $element) {
      const scrollToBottomFirst = setInterval(() => {
        $element[0].scrollTop = $element[0].scrollHeight;
      }, 10);
      $element.one('scroll', () => {
        clearInterval(scrollToBottomFirst);
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
