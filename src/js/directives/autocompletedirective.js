import _ from 'lodash';
import angular from 'angular';

import autocompletePanelTemplate from '../../templates/autocompletetemplate.html';

function getCurrentWord(element) {
  const selectionPos = element.prop('selectionStart');
  // find word (including special characters)
  const str = element.val();
  const wordStart = str.lastIndexOf(' ', selectionPos - 1) + 1;
  let wordEnd = str.indexOf(' ', selectionPos);
  if (wordEnd === -1) wordEnd = str.length;
  const selection = str.slice(wordStart, wordEnd);
  const trimmed = /\w+/.exec(selection);
  return {
    start: wordStart,
    end: wordEnd,
    text: selection,
    trimmed: trimmed && trimmed[0].toLowerCase()
  };
}

export default function autocompleteDirective($mdPanel, ThrottledDigestService) {
  'ngInject';

  return {
    restrict: 'A',
    require: 'ngModel',
    scope: {
      autocomplete: '='
    },
    link($scope, element, something, ngModel) {
      let panel = null;
      const panelInfo = {
        items: [],
        selectedIndex: 0,
        selectedItem: null
      };
      $scope.autocomplete.status = panelInfo;

      function applySelection(word, item) {
        const oldStr = ngModel.$viewValue;
        let newStr = oldStr.slice(0, word.start) + item.value + oldStr.slice(word.end);
        if (word.end === oldStr.length) newStr += ' ';
        ngModel.$setViewValue(newStr);
        ngModel.$render();
        setTimeout(() => {
          element.prop('selectionStart', word.start + item.value.length + 1);
          element.prop('selectionEnd', word.start + item.value.length + 1);
        }, 1);
      }

      function showAutoComplete() {
        if (panel) {
          panel.open();
        } else {
          const position = $mdPanel.newPanelPosition().relativeTo(element).addPanelPosition($mdPanel.xPosition.ALIGN_START, $mdPanel.yPosition.ABOVE);
          panel = $mdPanel.create({
            template: autocompletePanelTemplate,
            controller: 'AutocompletePanelController',
            controllerAs: 'autocompleteCtrl',
            bindToController: true,
            locals: {
              info: panelInfo
            },
            panelClass: 'autocomplete-panel',
            escapeToClose: true,
            clickOutsideToClose: true,
            focusOnOpen: false,
            trapFocus: false,
            propagateContainerEvents: true,
            origin: element,
            attachTo: angular.element(document.body),
            position,
            groupName: 'autocomplete',
            onCloseSuccess: (ref, reason) => {
              if (reason) applySelection(getCurrentWord(element), panelInfo.selectedItem);
            }
          });
          panel.open();
        }
        ThrottledDigestService.$apply();
      }

      function selectItem(index) {
        if (index < 0) index = 0;
        if (index >= panelInfo.items.length) index = panelInfo.items.length - 1;
        panelInfo.selectedIndex = index;
        panelInfo.selectedItem = panelInfo.items[index];
      }

      function onKey(event) {
        const word = getCurrentWord(element);

        if (event.key === 'Tab' || (event.key === 'Enter' && panelInfo.selectedItem)) {
          if (event.type === 'keydown' && panelInfo.selectedItem) {
            console.log('Tab completing', panelInfo);
            applySelection(word, panelInfo.selectedItem);
          }
          panel.hide();
          panelInfo.items = [];
          selectItem(-1);
          event.preventDefault(true);
          event.stopImmediatePropagation();
          return true;
        } else if (event.key === 'ArrowUp') {
          if (event.type === 'keydown') {
            selectItem(panelInfo.selectedIndex + 1);
          }
          event.preventDefault(true);
          return true;
        } else if (event.key === 'ArrowDown') {
          if (event.type === 'keydown') {
            selectItem(panelInfo.selectedIndex - 1);
          }
          event.preventDefault(true);
          return true;
        } else if (event.key === 'Escape') {
          return true;
        } else if (event.type === 'keyup') {
          if (word.text[0] === '@' && word.trimmed) {
            panelInfo.items = _.map(
              _.takeRight(
                _.sortBy(
                  _.filter($scope.autocomplete.users, userInfo => userInfo.user.name.startsWith(word.trimmed))
                  , 'relevance'
                )
                , 5
              )
              , item => ({ text: `@${item.user.displayName}`, value: `@${item.user.name}`, color: item.user.color })
            );
            if (panelInfo.items.length > 0) {
              selectItem(0);
              showAutoComplete();
              return true;
            }
          } else if (word.text[0] === '!' && word.trimmed) {
            // showAutoComplete($scope.autocomplete.commands);
          } else if (word.text[0] === ':' && word.trimmed) {
            const emotes = [];
            const containsEmotes = [];
            _.each($scope.autocomplete.emotes.local, emote => {
              if (emote.code.toLowerCase().startsWith(word.trimmed)) emotes.push(emote);
              else if (emote.code.toLowerCase().includes(word.trimmed)) containsEmotes.push(emote);
              if (emotes.length >= 5) return false;
              return true;
            });
            if (emotes.length < 5) {
              _.each($scope.autocomplete.emotes.global, emote => {
                if (emote.code.toLowerCase().startsWith(word.trimmed)) emotes.push(emote);
                else if (emote.prefixless && emote.prefixless.startsWith(word.trimmed)) emotes.push(emote);
                if (emotes.length >= 5) return false;
                return true;
              });
            }
            if (emotes.length < 5) {
              Array.prototype.push.apply(emotes, containsEmotes.slice(0, 5 - emotes.length));
            }
            panelInfo.items = _.map(emotes, emote => ({
              text: emote.code,
              value: emote.code,
              img: emote.url
            }));
            selectItem(0);
            if (panelInfo.items.length > 0) {
              showAutoComplete();
              return true;
            }
          }
          if (panel) {
            panel.hide();
            panelInfo.selectedIndex = -1;
            panelInfo.selectedItem = null;
          }
        }
        return true;
      }

      element.on('keydown', onKey);
      element.on('keyup', onKey);

      $scope.$on('$destroy', () => {
        element.off('keydown', onKey);
        element.off('keyup', onKey);
      });

      /* ctrl.$viewChangeListeners.push(() => {
        console.log('Show autocomplete?', ctrl);
      }); */
    }
  };
}
