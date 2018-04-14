import { EventEmitter } from 'events';

export default class KeyDownService extends EventEmitter {
  constructor($document, $rootScope) {
    'ngInject';

    super();
    this.keysPressed = {};

    /* $document.on('keyup keydown', e => {
      this.keysPressed[window.event.code] = e.type === 'keydown';
      this.emit(window.event.type, window.event, e);
    }); */
  }
}
