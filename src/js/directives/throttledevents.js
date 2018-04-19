import _ from 'lodash';

function throttledEventDirective(eventName) {
  const directiveName = _.camelCase(['throttled', eventName]);
  return ($parse, ThrottledDigestService) => {
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

export function throttledUserScrollDirective($parse, ThrottledDigestService) {
  'ngInject';

  return {
    restrict: 'A',
    compile($element, attr) {
      const fn = $parse(attr.throttledUserScroll);
      return (scope, element) => {
        fn(scope, { $event: null, $element: element });
        element.on('mousedown wheel DOMMouseScroll mousewheel keyup', event => {
          const callback = () => {
            fn(scope, { $event: event, $element: element });
          };
          ThrottledDigestService.$apply(callback);
        });
      };
    }
  };
}

export const throttledMousemoveDirective = throttledEventDirective('mousemove');
export const throttledKeydownDirective = throttledEventDirective('keydown');
export const throttledClickDirective = throttledEventDirective('click');
