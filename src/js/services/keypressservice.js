import { EventEmitter } from 'events';

export default class KeyPressService extends EventEmitter {
  constructor($document, ThrottledDigestService) {
    'ngInject';

    super();
    this.keysPressed = {};

    $document.on('keyup keydown', e => {
      this.keysPressed[window.event.code] = e.type === 'keydown';
      this.emit(window.event.type, window.event, e);
      ThrottledDigestService.$apply();
    });
  }
}
