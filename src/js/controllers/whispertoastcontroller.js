export default class WhisperToastController {
  constructor($mdToast) {
    'ngInject';

    this.$mdToast = $mdToast;
  }

  goToWhisper() {
    this.whisperCtrl.selectConversation(this.conversation);
  }
}
