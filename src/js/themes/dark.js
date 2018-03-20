export default function registerDarkMode($mdThemingProvider) {
  $mdThemingProvider.theme('dark')
  .primaryPalette('grey', { default: '900' })
  .accentPalette('grey', { default: '700' })
  .dark();
}
