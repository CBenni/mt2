import _ from 'lodash';

export default class ThrottledDigestService {
  constructor($document, $rootScope) {
    'ngInject';

    this.$rootScope = $rootScope;
    this.raf = null;
    this.scheduled = [];
    this.alwaysScheduled = [];
    this.unique = {};
    // this.throttledApply = _.throttle(() => this.$rootScope.$apply(), 100);
  }

  $apply(fun) {
    if (fun) fun();
    if (!this.raf) {
      this.raf = window.requestAnimationFrame(() => {
        this.$rootScope.$apply();
        _.each(this.scheduled, scheduled => { scheduled(); });
        _.each(this.alwaysScheduled, always => { always(); });
        this.scheduled = [];
        this.unique = {};
        this.raf = null;
      });
    }
  }

  schedule(fun) {
    this.scheduled.push(fun);
    this.$apply();
  }

  scheduleOnce(id, fun) {
    if (this.unique[id]) return;
    this.schedule(fun);
    this.unique[id] = true;
  }

  always(fun) {
    this.alwaysScheduled.push(fun);
    return () => {
      _.pull(this.alwaysScheduled, fun);
    };
  }
}
