/**
 * API client — thin wrapper over fetch() for all backend calls.
 * All methods return parsed JSON data (the "data" key from the server envelope).
 */
const API = (() => {
  const BASE = '/api';

  async function request(method, path, body, isFormData = false) {
    const opts = { method };
    if (body) {
      if (isFormData) {
        opts.body = body;                              // FormData, no Content-Type header
      } else {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(BASE + path, opts);
    const json = await res.json();
    if (!res.ok || json.status === 'error') {
      const err = new Error(json.message || `HTTP ${res.status}`);
      err.responseData = json;   // carry full payload (e.g. password_required)
      throw err;
    }
    return json.data;
  }

  const get    = (path)        => request('GET',    path);
  const post   = (path, body)  => request('POST',   path, body);
  const patch  = (path, body)  => request('PATCH',  path, body);
  const del    = (path)        => request('DELETE', path);

  // ---------- accounts ----------
  const Accounts = {
    list:   ()           => get('/accounts'),
    create: (data)       => post('/accounts', data),
    update: (name, data) => patch(`/accounts/${encodeURIComponent(name)}`, data),
    delete: (name)       => del(`/accounts/${encodeURIComponent(name)}`),
  };

  // ---------- transactions ----------
  const Transactions = {
    list: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
      ).toString();
      return get('/transactions' + (qs ? '?' + qs : ''));
    },
    update:  (id, data) => patch(`/transactions/${id}`, data),
    remove:  (id)       => del(`/transactions/${id}`),
  };

  // ---------- upload ----------
  const Upload = {
    upload: (file, accountName, password = null) => {
      const fd = new FormData();
      fd.append('file',    file);
      fd.append('account', accountName);
      if (password) fd.append('password', password);
      return request('POST', '/upload', fd, true);
    },
  };

  // ---------- analytics ----------
  const Analytics = {
    summary:    (params = {}) => get('/analytics/summary'    + _qs(params)),
    monthly:    (params = {}) => get('/analytics/monthly'    + _qs(params)),
    categories: (params = {}) => get('/analytics/categories' + _qs(params)),
    merchants:  (params = {}) => get('/analytics/merchants'  + _qs(params)),
    health:     ()            => get('/analytics/health'),
  };

  // ---------- detection ----------
  const Detection = {
    anomalies: (params = {}) => get('/anomalies' + _qs(params)),
    recurring: (params = {}) => get('/recurring' + _qs(params)),
  };

  // ---------- categorise ----------
  const Categorize = {
    run: (useLlm = false) => post('/categorize', { use_llm: useLlm }),
  };

  // ---------- categories ----------
  const Categories = {
    list: () => get('/categories'),
  };

  function _qs(params) {
    const str = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return str ? '?' + str : '';
  }

  return { Accounts, Transactions, Upload, Analytics, Detection, Categorize, Categories };
})();
