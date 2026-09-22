// Quote form: required-field checks, honeypot, JSON POST. On any failure the phone number
// is shown; the form is never the only path.
(function () {
  var form = document.querySelector('.quote-form');
  if (!form) return;
  var loadedAt = Date.now();   // the function treats submits under 3 s as automated
  var ok = document.querySelector('.form-result--ok');
  var fail = document.querySelector('.form-result--fail');
  var when = form.elements.when;
  var dateField = form.querySelector('[data-date-field]');
  var date = form.elements.date;
  var submit = form.querySelector('[type="submit"]');
  var submitLabel = submit.textContent;

  var nowNote = form.querySelector('[data-now-note]');

  function syncDate() {
    var scheduled = when.value === 'scheduled';
    dateField.hidden = !scheduled;
    date.required = scheduled;
    // "Now": point at the phone, faster than a form and a callback.
    if (nowNote) nowNote.hidden = when.value !== 'now';
  }

  var params = new URLSearchParams(location.search);
  // Back from a plain (no-script) form post: the function redirects with ?sent=1 or ?failed=1.
  if (params.get('sent') === '1') {
    form.hidden = true;
    ok.hidden = false;
    return;
  }
  if (params.get('failed') === '1') fail.hidden = false;

  // /quote/?when=scheduled pre-selects "scheduled" (Set Up a Scheduled Route).
  var preset = params.get('when');
  if (preset && when.querySelector('option[value="' + preset.replace(/[^a-z]/g, '') + '"]')) {
    when.value = preset;
  }
  syncDate();
  when.addEventListener('change', syncDate);

  // aria-describedby may already point at a hint; add and remove only the error's id.
  function describedBy(field, id, on) {
    var ids = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== id; });
    if (on) ids.push(id);
    if (ids.length) field.setAttribute('aria-describedby', ids.join(' '));
    else field.removeAttribute('aria-describedby');
  }

  function clearError(field) {
    field.removeAttribute('aria-invalid');
    var msg = document.getElementById(field.id + '-error');
    if (msg) msg.remove();
    describedBy(field, field.id + '-error', false);
  }

  function showError(field) {
    field.setAttribute('aria-invalid', 'true');
    if (document.getElementById(field.id + '-error')) return;
    var msg = document.createElement('p');
    msg.className = 'field__error';
    msg.id = field.id + '-error';
    msg.textContent = form.dataset.required;
    describedBy(field, msg.id, true);
    field.parentNode.appendChild(msg);
  }

  form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) clearError(e.target);
  });

  function show(result) {
    result.hidden = false;
    result.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    fail.hidden = true;

    var firstInvalid = null;
    Array.prototype.forEach.call(form.elements, function (field) {
      if (!field.required) return;
      if (field.value.trim()) {
        clearError(field);
      } else {
        showError(field);
        firstInvalid = firstInvalid || field;
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // Honeypot: bots fill it; people never see it. Pretend it worked.
    if (form.elements.company.value) {
      form.hidden = true;
      show(ok);
      return;
    }

    var data = {};
    ['pickup', 'dropoff', 'what', 'when', 'date', 'name', 'phone', 'email'].forEach(function (k) {
      data[k] = form.elements[k].value.trim();
    });
    if (data.when !== 'scheduled') delete data.date;
    data.elapsed = Date.now() - loadedAt;

    submit.disabled = true;
    submit.textContent = form.dataset.sending;
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 12000);

    fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        form.hidden = true;
        show(ok);
      })
      .catch(function () {
        show(fail);
      })
      .then(function () {
        clearTimeout(timer);
        submit.disabled = false;
        submit.textContent = submitLabel;
      });
  });
})();
