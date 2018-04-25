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
  },
  null,
  null,
  config => {
    console.log('Applying button showing migration');
    _.each(config.settings.modButtons, button => {
      button.show = button.action.type === 'command' ? 'mod' : 'always';
    });
    _.each(config.settings.modCardButtons, button => {
      button.show = button.action.type === 'command' ? 'mod' : 'always';
    });
    _.each(config.settings.chatHeaderButtons, button => {
      button.show = 'always';
    });
  },
  config => {
    console.log('Applying button bannable migration');
    _.each(config.settings.modButtons, button => {
      if (button.action.type === 'command' && button.show === 'mod') {
        if (button.action.command.startsWith('/timeout') || button.action.command.startsWith('/ban')) {
          button.show = 'bannable';
        }
      }
    });
    _.each(config.settings.modCardButtons, button => {
      if (button.action.type === 'command' && button.show === 'mod') {
        if (button.action.command.startsWith('/timeout') || button.action.command.startsWith('/ban')) {
          button.show = 'bannable';
        }
      }
    });
  }
];

export const layoutMigrations = [];

export function migrateConfig(config) {
  if (!config.version) {
    config.version = 0;
  }
  while (config.version < configMigrations.length) {
    const migration = configMigrations[config.version];
    if (migration) migration(config);
    config.version++;
  }
}

export function migrateLayouts(layouts) {
  _.each(layouts, layout => {
    if (!layout.version) {
      layout.version = 0;
    }
    while (layout.version < layoutMigrations.length) {
      const migration = layoutMigrations[layout.version];
      if (migration) migration(layout);
      layout.version++;
    }
  });
}

