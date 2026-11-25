const {test}=require('node:test');
const assert=require('node:assert/strict');
const {firestoreHost,PROJECT}=require('../protected/firestore-host.cjs');
test('application defaults to existing persistent Firebase, with no emulator fallback',()=>{
  assert.deepEqual(firestoreHost({}),{mode:'firebase',projectId:PROJECT,authMode:'google'});
  for(const env of [{FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'},{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'},{GCLOUD_PROJECT:'other-project'},{BW_PROTECTED_DATABASE:'unknown'}]) assert.throws(()=>firestoreHost(env));
});
test('temporary database is only allowed as an explicitly named automated-test mode',()=>{
  const env={BW_PROTECTED_DATABASE:'emulator',GCLOUD_PROJECT:'demo-book-warehouse',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'};
  assert.equal(firestoreHost(env).mode,'emulator');
  assert.throws(()=>firestoreHost({...env,FIRESTORE_EMULATOR_HOST:'remote.example:8080'}));
  assert.throws(()=>firestoreHost({...env,BW_PROTECTED_AUTH_MODE:'emulator'}));
  assert.equal(firestoreHost({...env,BW_PROTECTED_AUTH_MODE:'emulator',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}).authMode,'emulator');
});
