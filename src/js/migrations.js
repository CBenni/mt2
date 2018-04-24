import _ from 'lodash';
import { genNonce } from './helpers';

export const configMigrations = [
  config => {
    console.log('Applying chatPreset id migration');
    _.each(config.settings.chatPresets, preset => {
      if (!preset.id) preset.id = genNonce();
    });
  },
  config => {
    console.log('Applying twitchnotify filter migration');
    const chatPreset = _.find(config.settings.chatPresets, { id: 'default-chat' });
    if (chatPreset && chatPreset.settings.messageFilters.indexOf('subs') === -1) {
      chatPreset.settings.messageFilters.push('subs');
    }
  },
  config => {
    console.log('Applying extra mentions migration');
    config.settings.chatSettings.extraMentions = _.map(config.settings.chatSettings.extraMentions, mention => {
      let data = mention;
      let isRegex = /[\\^$.|?*+(){}[\]]/g.exec(mention);
      // only mark valid regexes as such
      if (isRegex) {
        try {
          RegExp(data);
        } catch (err) {
          isRegex = false;
        }
      }
      let type = isRegex ? 'regex' : 'word';
      let ignoreCase = true;
      if (isRegex && data.includes('(?-i)')) ignoreCase = false;
      const isSurroundedByWB = /^\\b([^\\^$.|?*+(){}[\]]*)\\b$/.exec(mention);
      if (isSurroundedByWB) {
        type = 'word';
        data = isSurroundedByWB[1];
      }
      return {
        type,
        data,
        ignoreCase
      };
    });
  }
];

export const layoutMigrations = [];

export function migrateConfig(config) {
  if (!config.version) {
    config.version = 0;
  }
  while (config.version < configMigrations.length) {
    configMigrations[config.version++](config);
  }
}

export function migrateLayouts(layouts) {
  _.each(layouts, layout => {
    if (!layout.version) {
      layout.version = 0;
    }
    while (layout.version < layoutMigrations.length) {
      layoutMigrations[layout.version++](layout);
    }
  });
}

