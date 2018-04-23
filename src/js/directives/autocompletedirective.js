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
    text: selection.toLowerCase(),
    trimmed: trimmed && trimmed[0].toLowerCase()
  };
}

function pushByHeuristic(array, heuristic, value, maxlength, uniqueBy) {
  if (uniqueBy) {
    const duplicateIndex = _.findIndex(array, x => _.get(x.value, uniqueBy) === _.get(value, uniqueBy));
    if (duplicateIndex >= 0) {
      if (heuristic < array[duplicateIndex].heuristic) array[duplicateIndex] = value;
      return;
    }
  }

  const index = _.sortedIndexBy(array, { heuristic, value }, x => x.heuristic);
  if (index >= maxlength) return;
  array.splice(index, 0, { heuristic, value });
  if (array.length > maxlength) array.splice(maxlength);
}

function findEmotes(local, global, word) {
  const emotes = [];
  const originPenalties = {
    'twitch global': 0,
    'bttv global': 50,
    'ffz global': 50
  };

  let index = 0;
  _.each(global, emote => {
    if (emote.code.toLowerCase() === word.trimmed) pushByHeuristic(emotes, originPenalties[emote.origin] + 0, emote, 5, 'code');
    else if (emote.prefixless && emote.prefixless === word.trimmed) pushByHeuristic(emotes, originPenalties[emote.origin] + 0, emote, 5, 'code');
    else if (emote.code.toLowerCase().startsWith(word.text)) pushByHeuristic(emotes, 0, emote, 5, 'code');
    else if (emote.code.toLowerCase().startsWith(word.trimmed)) pushByHeuristic(emotes, originPenalties[emote.origin] + index++, emote, 5, 'code');
    else if (emote.prefixless && emote.prefixless.startsWith(word.trimmed)) pushByHeuristic(emotes, originPenalties[emote.origin] + index++, emote, 5, 'code');
    else if (emote.code.toLowerCase().includes(word.trimmed)) pushByHeuristic(emotes, originPenalties[emote.origin] + 500 + index++, emote, 5, 'code');
  });
  _.each(local, emote => {
    if (emote.code.toLowerCase() === word.trimmed) pushByHeuristic(emotes, 0, emote, 5, 'code');
    else if (emote.code.toLowerCase().startsWith(word.trimmed)) pushByHeuristic(emotes, index++, emote, 5, 'code');
    else if (emote.code.toLowerCase().includes(word.trimmed)) pushByHeuristic(emotes, 500 + index++, emote, 5, 'code');
  });
  return emotes.map(x => x.value);
}

export default function autocompleteDirective($mdPanel, KeyPressService, ThrottledDigestService) {
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

      function selectItem(index) {
        if (index < 0) index = 0;
        if (index >= panelInfo.items.length) index = panelInfo.items.length - 1;
        panelInfo.selectedIndex = index;
        panelInfo.selectedItem = panelInfo.items[index];
      }

      function applySelection(word, item) {
        const oldStr = ngModel.$viewValue;
        let newStr = oldStr.slice(0, word.start) + item.value + oldStr.slice(word.end);
        if (word.end === oldStr.length) newStr += ' ';
        ngModel.$setViewValue(newStr);
        ngModel.$render();
        if (panel) panel.hide();
        panelInfo.items = [];
        selectItem(-1);
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
              if (reason === 'click') applySelection(getCurrentWord(element), panelInfo.selectedItem);
            }
          });
          panel.open();
        }
        ThrottledDigestService.$apply();
      }

      let recentMessageSelection = null;
      function onKey(event) {
        if (event.target !== element[0]) return false;
        const word = getCurrentWord(element);

        const oldMessageSelection = recentMessageSelection;
        if (event.type === 'keydown') recentMessageSelection = null;

        if (event.key === 'Tab' || (event.key === 'Enter' && panelInfo.selectedItem)) {
          if (event.type === 'keydown' && panelInfo.selectedItem) {
            applySelection(word, panelInfo.selectedItem);
          }
          event.preventDefault(true);
          event.stopImmediatePropagation();
          return true;
        } else if (event.key === 'ArrowUp') {
          if (event.type === 'keydown') {
            if (panelInfo.items.length === 0 && $scope.autocomplete.messages.length > 0) {
              if (oldMessageSelection === null) recentMessageSelection = $scope.autocomplete.messages.length - 1;
              else recentMessageSelection = Math.max(oldMessageSelection - 1, 0);
              if (recentMessageSelection !== null) {
                const msg = $scope.autocomplete.messages[recentMessageSelection];
                if (msg) {
                  ngModel.$setViewValue(msg);
                  ngModel.$render();
                }
              }
            } else selectItem(panelInfo.selectedIndex + 1);
          }
          event.preventDefault(true);
          return true;
        } else if (event.key === 'ArrowDown') {
          if (event.type === 'keydown') {
            if (panelInfo.items.length === 0 && oldMessageSelection !== null) {
              if (oldMessageSelection < $scope.autocomplete.messages.length - 1) recentMessageSelection = oldMessageSelection + 1;
              if (recentMessageSelection !== null) {
                const msg = $scope.autocomplete.messages[recentMessageSelection];
                if (msg) {
                  ngModel.$setViewValue(msg);
                  ngModel.$render();
                }
              }
            } else selectItem(panelInfo.selectedIndex - 1);
          }
          event.preventDefault(true);
          return true;
        } else if (event.key === 'Escape') {
          panelInfo.items = [];
          selectItem(-1);
          event.preventDefault(true);
          event.stopImmediatePropagation();
          if (panel) panel.hide();
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
              , item => ({ text: `@${item.user.fullName}`, value: `@${item.user.name}`, color: item.user.color })
            );
            if (panelInfo.items.length > 0) {
              selectItem(0);
              showAutoComplete();
              return true;
            }
          } else if (word.text[0] === '!' && word.trimmed) {
            // showAutoComplete($scope.autocomplete.commands);
          } else if (word.text[0] === ':' && word.text.length > 1) {
            const emotes = findEmotes($scope.autocomplete.emotes.local, $scope.autocomplete.emotes.global, word);
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

      const keyEvents = [
        KeyPressService.on('keydown', onKey, 200),
        KeyPressService.on('keyup', onKey, 200)
      ];

      $scope.$on('$destroy', () => {
        _.each(keyEvents, keyEvent => keyEvent());
      });
    }
  };
}
