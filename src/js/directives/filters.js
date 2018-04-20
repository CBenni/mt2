import _ from 'lodash';
import { formatDuration } from '../helpers';

export function timeAgoFilter() {
  return date => {
    if (!date) return '0';
    const d = Date.now();
    const age = (d - new Date(date).getTime()) / 1000;
    let res = '';
    if (age < 60) {
      res = '< 1 min';
    } else if (age < 3600) {
      const mins = Math.round(age / 60);
      res = `${mins} min`;
    } else if (age < 3600 * 24) {
      const hrs = Math.round(age / 3600);
      if (hrs === 1) res = '1h';
      else res = `${hrs} hrs`;
    } else if (age < 3600 * 24 * 365) {
      const days = Math.round(age / (3600 * 24));
      if (days === 1) res = '1 day';
      else res = `${days} days`;
    } else {
      const years = Math.round(age / (3600 * 24 * 365 / 10)) / 10;
      if (years === 1) res = '1 year';
      else res = `${years} years`;
    }
    return res;
  };
}

export function durationFilter() {
  return formatDuration;
}

export function largeNumberFilter() {
  return number => {
    if (!number) return '0';
    if (number < 1000) return number;
    else if (number < 1e4) {
      return `${Math.floor(number / 1e2) / 10}k`;
    } else if (number < 1e6) {
      return `${Math.floor(number / 1e3)}k`;
    }
    return `${Math.floor(number / 1e6)}M`;
  };
}

export function uniqueFilter() {
  return (list, by) => _.uniqBy(list, by);
}

/*
export default function () {
  return date => {
    const d = Date.now();
    const age = (d - new Date(date).getTime()) / 1000;
    let res = '';
    if (age < 60) {
      res = 'less than a minute ago';
    } else if (age < 3600) {
      const mins = Math.round(age / 60);
      if (mins === 1) res = 'a minute ago';
      else res = `${mins} minutes ago`;
    } else if (age < 3600 * 24) {
      const hrs = Math.round(age / 3600);
      if (hrs === 1) res = 'an hour ago';
      else res = `${hrs} hours ago`;
    } else if (age < 3600 * 24 * 365) {
      const days = Math.round(age / (3600 * 24));
      if (days === 1) res = 'yesterday';
      else res = `${days} days ago`;
    } else {
      const years = Math.round(age / (3600 * 24 * 365));
      if (years === 1) res = 'last year';
      else res = `${years} years ago`;
    }
    return res;
  };
}
*/
