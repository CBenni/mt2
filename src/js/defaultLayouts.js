import { layoutMigrations } from './migrations';

export default [{
  settings: {
    showPopoutIcon: false
  },
  content: [
    {
      title: 'Home',
      type: 'component',
      componentName: 'angularModule',
      isClosable: false,
      componentState: {
        module: 'mtApp',
        templateId: 'homeTemplate',
        icon: {
          type: 'icon',
          code: 'home'
        }
      }
    }
  ],
  version: layoutMigrations.length
}];
