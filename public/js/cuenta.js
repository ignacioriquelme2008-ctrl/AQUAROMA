(() => {
  const shell = document.querySelector('.account-shell');
  if (!shell) return;
  const passwordRegistro = shell.querySelector('#registro-password');
  if (passwordRegistro) {
    const reglas = [...shell.querySelectorAll('[data-regla]')];
    const actualizarReglas = () => {
      const valor = passwordRegistro.value;
      const criterios = {
        largo: regla => valor.length >= Number(regla.dataset.min) && valor.length <= Number(regla.dataset.max),
        mayuscula: () => /[A-Z]/.test(valor),
        minuscula: () => /[a-z]/.test(valor),
        numero: () => /[0-9]/.test(valor),
        especial: () => /[^A-Za-z0-9\s]/.test(valor),
        sinEspacios: () => valor.length > 0 && !/\s/.test(valor),
      };
      reglas.forEach(regla => {
        const cumple = criterios[regla.dataset.regla](regla);
        regla.classList.toggle('regla-cumplida', cumple);
        regla.setAttribute('aria-label', `${cumple ? 'Cumplido' : 'Pendiente'}: ${regla.textContent.trim()}`);
      });
    };
    passwordRegistro.addEventListener('input', actualizarReglas);
    passwordRegistro.addEventListener('change', actualizarReglas);
    window.addEventListener('pageshow', actualizarReglas);
    actualizarReglas();
  }
  const tabs = [...shell.querySelectorAll('.account-tabs a')];
  const select = (mode) => {
    shell.dataset.modo = mode;
    tabs.forEach((tab) => {
      if (tab.id === `tab-${mode}`) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    shell.querySelectorAll('[data-panel]').forEach(panel => {
      panel.hidden = panel.dataset.panel !== mode;
    });
  };
  tabs.forEach(tab => tab.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const mode = tab.id.slice(4);
    const url = new URL(tab.href);
    url.search = location.search;
    history.pushState(null, '', url.pathname + url.search);
    select(mode);
  }));
  window.addEventListener('popstate', () => select(location.pathname === '/registro' ? 'registro' : 'login'));
  shell.querySelectorAll('input[type="password"]').forEach(input => {
    const wrapper = document.createElement('div');
    wrapper.className = 'account-password';
    input.before(wrapper);
    wrapper.append(input);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Mostrar contraseña');
    toggle.setAttribute('aria-controls', input.id);
    toggle.setAttribute('aria-pressed', 'false');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
    wrapper.append(toggle);
  });
})();
