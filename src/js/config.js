import devConfig from './config.dev.json';
import prodConfig from './config.prod.json';

let config; // eslint-disable-line import/no-mutable-exports
if (process.env.NODE_ENV === 'production') config = prodConfig;
else config = devConfig;
export default config;
