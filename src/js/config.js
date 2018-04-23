import devConfig from './config.dev.json';
import prodConfig from './config.prod.json';
import stagingConfig from './config.staging.json';

console.log('Using config ', process.env.NODE_ENV);

let config; // eslint-disable-line import/no-mutable-exports
if (process.env.NODE_ENV === 'prod') config = prodConfig;
else if (process.env.NODE_ENV === 'staging') config = stagingConfig;
else config = devConfig;
export default config;
