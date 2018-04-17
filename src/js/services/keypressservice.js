import _ from 'lodash';

export default class KeyPressService {
  constructor($document, ThrottledDigestService) {
    'ngInject';

    this.keysPressed = {};
    this.keyWatchers = {};

    $document.on('keyup keydown', e => {
      this.keysPressed[window.event.code] = e.type === 'keydown';
      this.emit(window.event);
      ThrottledDigestService.$apply();
    });
  }

  on(key, callback, priority = 0) {
    if (!this.keyWatchers[key]) this.keyWatchers[key] = [];
    const watcher = { priority, callback };
    this.keyWatchers[key].push(watcher);
    this.keyWatchers[key] = _.orderBy(this.keyWatchers[key], ['priority'], ['desc']);
    return () => _.pull(this.keyWatchers[key], watcher);
  }

  emit(event) {
    _.each(this.keyWatchers[event.code], watcher => !watcher.callback(event));
    _.each(this.keyWatchers[event.type], watcher => !watcher.callback(event));
  }
}
