import $ from 'jquery';
import _ from 'lodash';

export default class KeyPressService {
  constructor($document, ThrottledDigestService) {
    'ngInject';

    this.keysPressed = {};
    this.keyWatchers = {};

    $document.on('keyup keydown', $event => {
      const event = $event.originalEvent;
      if (event.target) {
        if ($(event.target).parents('.no-global-hotkeys').length > 0) return;
      }
      this.emit(event);
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
    if (!event.code) return;
    let handledBy = null;
    if (event.type === 'keyup') this.keysPressed[event.code] = undefined;
    else if (event.type === 'keydown') this.keysPressed[event.code] = 0;
    _.each(this.keyWatchers[event.code], watcher => {
      if (watcher.callback(event)) {
        if (event.type === 'keydown') this.keysPressed[event.code] = watcher.priority;
        handledBy = watcher.priority;
        return false;
      }
      return true;
    });
    if (handledBy === null) {
      _.each(this.keyWatchers[event.type], watcher => {
        if (watcher.callback(event)) {
          if (event.type === 'keydown') this.keysPressed[event.code] = watcher.priority;
          return false;
        }
        return true;
      });
    }
  }
}
