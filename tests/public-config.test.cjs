const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publicConfig } = require('../scripts/public-site-config.cjs');
test('public deployment includes only client settings, excluding credentials', () => {
  const input = { projectId:'book-warehouse-staging-261115',apiKey:'public-key',authDomain:'app.firebaseapp.com',appId:'public-app',driveClientId:'public.apps.googleusercontent.com',sparkBorrowingEnabled:true,private_key:'never-publish',refresh_token:'never-publish' };
  const result = publicConfig(input);
  assert.equal(result.private_key, undefined); assert.equal(result.refresh_token, undefined);
  assert.equal(result.driveClientId,input.driveClientId);
  assert.throws(()=>publicConfig({...input,projectId:'other'}));
  assert.throws(()=>publicConfig({...input,sparkBorrowingEnabled:false}));
});
