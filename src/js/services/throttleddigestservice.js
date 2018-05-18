import _ from 'lodash';

function isParentOf(scopeA, scopeB) {
  if (!scopeA || !scopeB) return false;
  if (scopeA === scopeB) return true;
  return scopeB.$parent && isParentOf(scopeA, scopeB.$parent);
}

export default class ThrottledDigestService {
  constructor($document, $rootScope) {
    'ngInject';

    this.$rootScope = $rootScope;
    this.raf = null;
    this.scopesToDigest = [];
    this.scheduled = [];
    this.alwaysScheduled = [];
    this.unique = {};
  }

  $apply(scope, fun) {
    if (fun) fun();
    let inserted = false;
    for (let i = 0; i < this.scopesToDigest.length; ++i) {
      if (isParentOf(scope, this.scopesToDigest[i])) {
        if (inserted) {
          this.scopesToDigest[i] = null;
        } else {
          this.scopesToDigest[i] = scope;
          inserted = true;
        }
      } else if (isParentOf(this.scopesToDigest[i], scope)) {
        if (inserted) {
          console.error('Double digest: ', this.scopesToDigest);
          console.error('With scope added: ', scope);
        } else inserted = true;
      }
    }
    if (!inserted) this.scopesToDigest.push(scope);
    if (!this.raf) {
      this.raf = window.requestAnimationFrame(() => {
        // console.log('Starting RAF.');
        _.each(this.scopesToDigest, scopeToDigest => {
          if (scopeToDigest) {
            // console.log('Digesting ', scopeToDigest);
            scopeToDigest.$digest();
          }
        });
        _.each(this.scheduled, scheduled => { scheduled(); });
        _.each(this.alwaysScheduled, always => { always(); });
        this.scheduled = [];
        this.unique = {};
        this.raf = null;
        // console.log('RAF done.');
      });
    }
  }

  schedule(scope, fun) {
    this.scheduled.push(fun);
    this.$apply(scope);
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
