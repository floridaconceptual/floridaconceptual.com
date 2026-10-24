(function () {
  var form = document.getElementById('quote-form');
  if (!form) return;
  var status = document.getElementById('q-status');
  var endpoint = form.getAttribute('data-endpoint') || '';
  var accessKey = form.getAttribute('data-key') || '';

  var labels = {
    inquiry: 'Inquiry', name: 'Name', company: 'Company', email: 'Email', phone: 'Phone',
    service: 'Service needed', project_type: 'Project type', item_type: 'Metal element',
    location: 'Project location', needed_by: 'Date needed by', details: 'Message'
  };

  function summary(data) {
    var lines = [];
    Object.keys(labels).forEach(function (k) {
      if (data[k]) lines.push(labels[k] + ': ' + data[k]);
    });
    return lines.join('\n');
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function show(kind, html) {
    status.className = 'status ' + (kind === 'ok' ? 'status-ok' : 'status-err');
    status.innerHTML = html;
    status.hidden = false;
    status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function failed(data) {
    var text = summary(data);
    show('err',
      '<strong>Your message did not go through.</strong>' +
      '<p>Nothing was lost. Please try sending again in a few minutes. Your details are below if you want to keep a copy.</p>' +
      '<pre id="q-summary">' + esc(text) + '</pre>' +
      '<div class="row"><button type="button" class="btn btn-ghost" id="q-copy">Copy my message</button></div>');
    var copy = document.getElementById('q-copy');
    copy.addEventListener('click', function () {
      function selectIt() {
        var r = document.createRange();
        r.selectNodeContents(document.getElementById('q-summary'));
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      }
      try { navigator.clipboard.writeText(text).then(function () { copy.textContent = 'Copied'; }, selectIt); }
      catch (e) { selectIt(); }
    });
  }

  function isQuote() {
    var r = form.querySelector('input[name="inquiry"]:checked');
    return !r || r.value === 'Quote request';
  }

  function syncInquiry() {
    var quote = isQuote();
    form.querySelectorAll('.quote-only').forEach(function (el) { el.hidden = !quote; });
    var star = document.getElementById('q-service-req');
    if (star) star.hidden = !quote;
  }
  form.querySelectorAll('input[name="inquiry"]').forEach(function (r) { r.addEventListener('change', syncInquiry); });
  syncInquiry();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var data = {};
    fd.forEach(function (v, k) { data[k] = String(v).trim(); });
    if (data.botcheck) return;
    if (!isQuote()) { delete data.service; delete data.project_type; delete data.item_type; delete data.location; delete data.needed_by; }

    var required = ['q-name', 'q-email', 'q-details'];
    if (isQuote()) required.splice(2, 0, 'q-service');
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    var firstBad = null;
    required.forEach(function (id) {
      var el = document.getElementById(id);
      var bad = !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value.trim()));
      if (bad) { el.setAttribute('aria-invalid', 'true'); if (!firstBad) firstBad = el; }
    });
    if (firstBad) {
      show('err', '<strong>Some required fields are missing.</strong><p>Fill in the fields marked * and send again.</p>');
      firstBad.focus();
      return;
    }

    if (!endpoint) { failed(data); return; }

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Sending…';
    var subject = (isQuote() ? 'Quote request: ' + (data.service || 'project') : 'Website contact') + ' - ' + data.name;
    var payload = Object.assign({}, data, { access_key: accessKey, subject: subject, from_name: 'FCD website', replyto: data.email });
    delete payload.botcheck;

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.success !== false) {
          form.reset(); syncInquiry();
          show('ok', '<strong>Message sent.</strong><p>Thanks, ' + esc(data.name.split(' ')[0]) + '. We\'ll reply to ' + esc(data.email) + '. If you mentioned drawings or photos, we\'ll send you a link to upload them.</p>');
        } else {
          failed(data);
        }
      })
      .catch(function () { failed(data); })
      .then(function () { btn.disabled = false; btn.textContent = 'Send message'; });
  });
})();
