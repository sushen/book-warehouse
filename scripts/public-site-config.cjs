'use strict';
const keys = ['apiKey','authDomain','projectId','appId','messagingSenderId','storageBucket','measurementId','driveClientId','sparkBorrowingEnabled'];
function publicConfig(input) {
  if (input.projectId !== 'book-warehouse-staging-261115') throw new Error('Unexpected public Firebase project');
  for (const name of ['apiKey','authDomain','appId','driveClientId']) if (typeof input[name] !== 'string' || !input[name]) throw new Error('Missing public setting: ' + name);
  if (!input.driveClientId.endsWith('.apps.googleusercontent.com')) throw new Error('Invalid public Drive client ID');
  if (input.sparkBorrowingEnabled !== true) throw new Error('Public borrowing must be explicitly enabled');
  return Object.fromEntries(keys.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
}
module.exports = { publicConfig };
