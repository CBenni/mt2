import raven from 'raven-js';
import angular from 'angular';

raven.config('https://9c0989719ae64953abeebc8f6c76e2ab@sentry.io/1193838')
.addPlugin(require('raven-js/plugins/angular'), angular)
.install();
