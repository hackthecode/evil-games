import { session, navigate } from '../app.js';
import { store } from '../store/index.js';
import { h, toast, AVATAR_COLORS } from '../ui.js';
import { txt, tr } from '../i18n.js';

export function renderAuth(view, mode, query) {
  const isReg = mode === 'register';
  const next = query.get('next') || '/';
  let color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const err = h('p', { class: 'form-error', role: 'alert' });
  const username = h('input', {
    name: 'username', autocomplete: 'username', required: true, minlength: 3, maxlength: 15,
    pattern: '[A-Za-z0-9_\\u0400-\\u04FF]+', placeholder: txt('e.g. ivan_88'), autocapitalize: 'off', spellcheck: 'false',
  });
  const password = h('input', {
    name: 'password', type: 'password', required: true, minlength: 6,
    autocomplete: isReg ? 'new-password' : 'current-password', placeholder: '••••••',
  });
  const password2 = isReg && h('input', { type: 'password', required: true, minlength: 6, autocomplete: 'new-password', placeholder: '••••••' });

  const swatches = isReg && h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': txt('Avatar colour') },
    AVATAR_COLORS.map((c) =>
      h('button', {
        type: 'button', class: `swatch ${c === color ? 'on' : ''}`, style: { background: c },
        'aria-label': c, onclick: (e) => {
          color = c;
          swatches.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
        },
      }),
    ),
  );

  const submit = h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, isReg ? txt('Sign up') : txt('Log in'));

  const form = h('form', {
    class: 'auth-form',
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const name = username.value.trim();
      if (isReg && password.value !== password2.value) {
        err.textContent = txt('The passwords don\'t match.');
        return;
      }
      submit.disabled = true;
      try {
        const user = isReg
          ? await store.register({ username: name, password: password.value, color })
          : await store.login({ username: name, password: password.value });
        session.setUser(user);
        toast(isReg ? txt('Welcome, {0}!', user.displayName) : txt('Hello, {0}!', user.displayName), 'success');
        navigate(next);
      } catch (ex) {
        err.textContent = tr(ex.message);
      } finally {
        submit.disabled = false;
      }
    },
  },
    h('label', null, h('span', null, txt('Username')), username),
    h('label', null, h('span', null, txt('Password')), password),
    isReg && h('label', null, h('span', null, txt('Repeat the password')), password2),
    isReg && h('div', { class: 'field' }, h('span', null, txt('Avatar colour')), swatches),
    err,
    submit,
  );

  view.append(
    h('section', { class: 'auth-wrap' },
      h('div', { class: 'auth-card glass' },
        h('h1', null, isReg ? txt('Create a profile') : txt('Log in')),
        h('p', { class: 'muted' }, isReg
          ? txt('Your profile keeps your statistics and puts you in the ranking.')
          : txt('Log in to play and rack up wins.')),
        form,
        h('p', { class: 'auth-switch' },
          isReg ? txt('Already have a profile? ') : txt('No profile yet? '),
          h('a', { href: `#/${isReg ? 'login' : 'register'}${next !== '/' ? '?next=' + encodeURIComponent(next) : ''}` },
            isReg ? txt('Log in') : txt('Sign up')),
        ),
      ),
    ),
  );
  setTimeout(() => username.focus(), 50);
}
