(function () {
  var form = document.getElementById('quote-form');
  if (!form) return;
  var status = document.getElementById('q-status');
  var endpoint = form.getAttribute('data-endpoint') || '';
  var accessKey = form.getAttribute('data-key') || '';
  var toEmail = form.getAttribute('data-email') || '';

  var labels = {
    name: 'Name', company: 'Company', email: 'Email', phone: 'Phone',
    service: 'Service needed', item_type: 'Item type', location: 'Project location',
    needed_by: 'Date needed by', details: 'Project details'
  };

  function summary(data) {
    var lines = [];
    Object.keys(labels).forEach(function (k) {
      if (data[k]) lines.push(labels[k] + ': ' + data[k]);
    });
    return lines.join('\n');
  }

  function show(kind, html) {
    status.className = 'status ' + (kind === 'ok' ? 'status-ok' : 'status-err');
    status.innerHTML = html;
    status.hidden = false;
    status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function fallback(data, reason) {
    var text = summary(data);
    var subject = 'Quote request: ' + (data.service || 'project') + ' - ' + data.name;
    var mailto = 'mailto:' + toEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    show('err',
      '<strong>' + esc(reason) + '</strong>' +
      '<p>Copy your request below and email it to <span class="email-line">' + esc(toEmail) + '</span>.</p>' +
      '<pre id="q-summary">' + esc(text) + '</pre>' +
      '<div class="row"><button type="button" class="btn btn-primary" id="q-copy">Copy request</button>' +
      '<a class="btn btn-ghost" href="' + esc(mailto) + '">Open in email</a></div>');
    var copy = document.getElementById('q-copy');
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = 'Copied'; };
      try {
        navigator.clipboard.writeText(text).then(done, selectIt);
      } catch (e) { selectIt(); }
      function selectIt() {
        var r = document.createRange();
        r.selectNodeContents(document.getElementById('q-summary'));
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var data = {};
    fd.forEach(function (v, k) { data[k] = String(v).trim(); });
    if (data.botcheck) return;

    var firstBad = null;
    ['q-name', 'q-email', 'q-service', 'q-details'].forEach(function (id) {
      var el = document.getElementById(id);
      var bad = !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value.trim()));
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) {
      show('err', '<strong>Some required fields are missing.</strong><p>Fill in your name, a valid email, the service you need and the project details, then send again.</p>');
      firstBad.focus();
      return;
    }

    if (!endpoint) {
      fallback(data, 'Online sending is not switched on yet.');
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Sending…';
    var payload = Object.assign({}, data, {
      access_key: accessKey,
      subject: 'Quote request: ' + (data.service || 'project') + ' - ' + data.name,
      from_name: 'FCD website',
      replyto: data.email
    });
    delete payload.botcheck;

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.success !== false) {
          form.reset();
          show('ok', '<strong>Request sent.</strong><p>Thanks, ' + esc(data.name.split(' ')[0]) + '. We\'ll reply to ' + esc(data.email) + '. If you have drawings or photos, email them to <span class="email-line">' + esc(toEmail) + '</span>.</p>');
        } else {
          fallback(data, 'Your request did not go through.');
        }
      })
      .catch(function () { fallback(data, 'Your request did not go through.'); })
      .then(function () { btn.disabled = false; btn.textContent = 'Send quote request'; });
  });
})();
