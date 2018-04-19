import _ from 'lodash';

export function genNonce() {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz';
  const result = [];
  window.crypto.getRandomValues(new Uint8Array(32)).forEach(c =>
    result.push(charset[c % charset.length]));
  return result.join('');
}

const rx = /^(?:@([^ ]+) )?(?:[:](\S+) )?(\S+)(?: (?!:)(.+?))?(?: [:](.+))?$/;
const rx2 = /([^=;]+)=([^;]*)/g;
const STATE_V3 = 1;
const STATE_PREFIX = 2;
const STATE_COMMAND = 3;
const STATE_PARAM = 4;
const STATE_TRAILING = 5;

export function parseIRCMessage(message) {
  const data = rx.exec(message);
  if (data === null) {
    console.error(`Couldnt parse message '${message}'`);
    return null;
  }
  const tagdata = data[STATE_V3];
  const tags = {};
  if (tagdata) {
    let m;
    do {
      m = rx2.exec(tagdata);
      if (m) {
        const [, key, val] = m;
        tags[key] = val.replace(/\\s/g, ' ').trim();
      }
    } while (m);
  }
  return {
    tags,
    command: data[STATE_COMMAND],
    prefix: data[STATE_PREFIX],
    param: data[STATE_PARAM],
    trailing: data[STATE_TRAILING]
  };
}

export function sdbmCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
  }
  return Math.abs(hash);
}
export const entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '{': '&#123;',
  '}': '&#125;'
};
export const htmlEntities = _.invert(entityMap);

export function formatTimespan(timespan) {
  let age = Math.round(parseInt(timespan, 10));
  const periods = [
    { abbr: 'y', len: 3600 * 24 * 365 },
    { abbr: 'm', len: 3600 * 24 * 30 },
    { abbr: 'd', len: 3600 * 24 },
    { abbr: ' hrs', len: 3600 },
    { abbr: ' min', len: 60 },
    { abbr: ' sec', len: 1 }
  ];
  let res = '';
  let count = 0;
  for (let i = 0; i < periods.length; ++i) {
    if (age >= periods[i].len) {
      const pval = Math.floor(age / periods[i].len);
      age %= periods[i].len;
      res += (res ? ' ' : '') + pval + periods[i].abbr;
      count++;
      if (count >= 2) break;
    }
  }
  return res;
}

export function formatCount(i) {
  return i <= 1 ? '' : ` (${i} times)`;
}

export function escapeHtml(string) {
  return String(string).replace(/[&<>"'\\/]/g, s => entityMap[s]);
}

export function formatTimeout(timeout) {
  const tags = timeout.tags;
  console.log('Formatting timeout: ', tags);
  if (timeout.type === 'timeout') {
    // timeout
    if (!tags.reasons || tags.reasons.length === 0) {
      return `<${tags['display-name']} has been timed out for ${formatTimespan(tags.duration)}${formatCount(tags.count)}>`;
    } else if (tags.reasons.length === 1) {
      return `<${tags['display-name']} has been timed out for ${formatTimespan(tags.duration)}. Reason: ${tags.reasons.join(', ')}${formatCount(tags.count)}>`;
    }
    return `<${tags['display-name']} has been timed out for ${formatTimespan(tags.duration)}. Reasons: ${tags.reasons.join(', ')}${formatCount(tags.count)}>`;
  }
  // banned
  if (timeout.type === 'ban') {
    if (!tags.reasons || tags.reasons.length === 0) {
      return `<${tags['display-name']} has been banned>`;
    } else if (tags.reasons.length === 1) {
      return `<${tags['display-name']} has been banned. Reason: ${tags.reasons.join(', ')}>`;
    }
    return `<${tags['display-name']} has been banned. Reasons: ${tags.reasons.join(', ')}>`;
  }
  return '<invalid timeout>';
}

export function capitalizeFirst(str) {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

export function jsonParseRecursive(thing) {
  if (typeof (thing) === 'object') {
    _.each(thing, (val, prop) => {
      thing[prop] = jsonParseRecursive(val);
    });
    return thing;
  } else if (typeof (thing) === 'string' && (thing[0] === '[' || thing[0] === '{')) {
    try {
      return jsonParseRecursive(JSON.parse(thing));
    } catch (err) {
      return thing;
    }
  } else return thing;
}

export function formatDuration(duration, baseUnit) {
  if (!duration) return '0';
  let res = '';
  duration = parseInt(duration, 10);
  if (baseUnit) {
    duration *= {
      minutes: 60, hours: 3600, days: 86400, years: 86400 * 365
    }[baseUnit];
  }
  if (duration < 60) {
    res = `${duration}s`;
  } else if (duration < 3600) {
    const mins = Math.round(duration / 60);
    res = `${mins}m`;
  } else if (duration < 3600 * 24) {
    const hrs = Math.round(duration / 3600);
    res = `${hrs}h`;
  } else if (duration < 3600 * 24 * 365) {
    const days = Math.round(duration / (3600 * 24));
    res = `${days}d`;
  } else {
    const years = Math.round(duration / (3600 * 24 * 365 / 10)) / 10;
    res = `${years}y`;
  }
  return res;
}

export function stringifyTimeout(timeoutNotice) {
  let res = null;
  if (timeoutNotice.duration <= 1) res = 'has been purged';
  else if (Number.isFinite(timeoutNotice.duration)) res = `has been timed out for ${formatDuration(timeoutNotice.duration)}`;
  else res = 'has been banned';
  if (timeoutNotice.count > 1) res += ` (${timeoutNotice.count} times)`;
  if (timeoutNotice.reasons.length === 1) {
    res += ` with reason: ${escapeHtml(timeoutNotice.reasons[0])}`;
  } else if (timeoutNotice.reasons.length > 1) {
    res += ` with reasons: ${escapeHtml(timeoutNotice.reasons.join(', '))}`;
  }
  return res;
}

// used to turn regex emote codes into proper names
export function instantiateRegex(regex) {
  return regex.replace(/\[([^\]])[^\]]*\]/g, '$1')
  .replace(/\(([^|)]*)(?:\|[^)]*)*\)/g, '$1')
  .replace(/\\?(.)\??/g, '$1')
  .replace(/&(\w+);/g, m => htmlEntities[m] || m);
}

export function alwaysResolve(promise) {
  return new Promise(resolve => {
    promise.then(resolve).catch(resolve);
  });
}

const textToCursorCache = new Map();
export function textToCursor(text, size, font) {
  const cacheKey = JSON.stringify([text, size, font]);
  const cached = textToCursorCache.get(cacheKey);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.height = size;
  let ctx = canvas.getContext('2d');
  ctx.font = `${size || 24}px '${font || 'Arial'}'`;
  canvas.width = ctx.measureText(text).width;
  ctx = canvas.getContext('2d');
  ctx.font = `${size || 24}px '${font || 'Arial'}'`;
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.strokeWidth = 5;
  ctx.fillText(text, 0, size);
  ctx.moveTo(0, 0);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 5);
  ctx.fill();
  const result = canvas.toDataURL();
  textToCursorCache.set(cacheKey, result);
  return result;
}
