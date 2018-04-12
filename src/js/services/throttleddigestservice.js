export default class ThrottledDigestService {
  constructor($document, $rootScope) {
    'ngInject';

    this.$rootScope = $rootScope;
    this.raf = null;
    // this.throttledApply = _.throttle(() => this.$rootScope.$apply(), 100);
  }

  $apply(fun) {
    if (fun) fun();
    if (!this.raf) {
      this.raf = window.requestAnimationFrame(() => {
        this.$rootScope.$apply();
        this.raf = null;
      });
    }
  }
}
