import _ from 'lodash';

function throttledEventDirective(eventName) {
  const directiveName = _.camelCase(['throttled', eventName]);
  return ($parse, $rootScope, ThrottledDigestService) => {
    'ngInject';

    return {
      restrict: 'A',
      compile($element, attr) {
        const fn = $parse(attr[directiveName]);
        return (scope, element) => {
          element.on(eventName, event => {
            const callback = () => {
              fn(scope, { $event: event });
            };
            ThrottledDigestService.$apply(callback);
          });
        };
      }
    };
  };
}

export const throttledMousemoveDirective = throttledEventDirective('mousemove');
export const throttledKeydownDirective = throttledEventDirective('keydown');
export const throttledClickDirective = throttledEventDirective('click');
