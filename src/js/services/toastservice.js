import objectToastTemplate from '../../templates/objecttoast.html';

export default class ToastService {
  constructor($mdToast) {
    'ngInject';

    this.$mdToast = $mdToast;
  }

  showToast(obj) {
    if (typeof (obj) === 'object') {
      this.$mdToast.show({
        template: objectToastTemplate,
        scope: {
          message: 'Success!',
          items: obj
        }
      });
    } else {
      this.$mdToast.show(this.$mdToast.simple().textContent(obj).hideDelay(3000));
    }
  }
}
