// Quote form: required-field checks, honeypot, JSON POST. On any failure the phone number
// is shown — the form is never the only path.
(function () {
  var form = document.querySelector('.quote-form');
  if (!form) return;
  var ok = document.querySelector('.form-result--ok');
  var fail = document.querySelector('.form-result--fail');
  var when = form.elements.when;
  var dateField = form.querySelector('[data-date-field]');
  var date = form.elements.date;
  var submit = form.querySelector('[type="submit"]');
  var submitLabel = submit.textContent;

  function syncDate() {
    var scheduled = when.value === 'scheduled';
    dateField.hidden = !scheduled;
    date.required = scheduled;
  }

  // /quote/?when=scheduled pre-selects "scheduled" (Set Up a Scheduled Route).
  var preset = new URLSearchParams(location.search).get('when');
  if (preset && when.querySelector('option[value="' + preset.replace(/[^a-z]/g, '') + '"]')) {
    when.value = preset;
  }
  syncDate();
  when.addEventListener('change', syncDate);

  function clearError(field) {
    field.removeAttribute('aria-invalid');
    var msg = document.getElementById(field.id + '-error');
    if (msg) msg.remove();
    field.removeAttribute('aria-describedby');
  }

  function showError(field) {
    field.setAttribute('aria-invalid', 'true');
    if (document.getElementById(field.id + '-error')) return;
    var msg = document.createElement('p');
    msg.className = 'field__error';
    msg.id = field.id + '-error';
    msg.textContent = form.dataset.required;
    field.setAttribute('aria-describedby', msg.id);
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
