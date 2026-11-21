import { getApps, initializeApp } from 'firebase/app';
import { getAuth, updateCurrentUser, signOut } from 'firebase/auth';

export async function restoreReaderSession(config) {
  const app = getApps().find(item => item.name === '[DEFAULT]') || initializeApp(config);
  if (app.options.projectId !== config.projectId || app.options.appId !== config.appId) {
    throw new Error('setup');
  }
  const auth = getAuth(app);
  await auth.authStateReady();

  // Earlier Spark pages saved their login under a separate Firebase app name.
  const legacyApp = getApps().find(item => item.name === 'spark') || initializeApp(config, 'spark');
  const legacyAuth = getAuth(legacyApp);
  await legacyAuth.authStateReady();
  if (legacyAuth.currentUser) {
    if (!auth.currentUser) await updateCurrentUser(auth, legacyAuth.currentUser);
    await signOut(legacyAuth);
  }
  return { app, auth };
}
