import devConfig from './config.dev.json';
import prodConfig from './config.prod.json';
import stagingConfig from './config.staging.json';

let config; // eslint-disable-line import/no-mutable-exports
if (process.env.NODE_ENV === 'production') config = prodConfig;
else if (process.env.NODE_ENV === 'staging') config = stagingConfig;
else config = devConfig;
export default config;
