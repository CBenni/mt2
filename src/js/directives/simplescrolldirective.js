import simpleScrollbar from 'simple-scrollbar';

export default function SimpleScrollbarDirective() {
  return {
    restrict: 'A',
    link($scope, element) {
      simpleScrollbar.initEl(element[0]);
    }
  };
}
