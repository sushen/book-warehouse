import { signInWithEmailAndPassword } from 'firebase/auth';
export function emulatorLogin(auth) {
  const box = document.createElement('details'); box.className = 'wrap';
  const summary = document.createElement('summary'); summary.textContent = 'Local emulator only — fictional test accounts';
  const form = document.createElement('form'); form.className = 'admin-form';
  form.innerHTML = '<label>Fictional email<input name="email" type="email" required autocomplete="off"></label><label>Test password<input name="password" type="password" required autocomplete="off"></label><button type="submit" class="button button-outline">Sign in to emulator</button><p role="status"></p>';
  form.onsubmit = async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try { await signInWithEmailAndPassword(auth, form.elements.email.value, form.elements.password.value); form.querySelector('p').textContent = 'Signed into local emulator'; }
    catch { form.querySelector('p').textContent = 'Emulator sign-in failed'; }
    finally { button.disabled = false; }
  };
  box.append(summary, form); document.querySelector('main').prepend(box);
}
