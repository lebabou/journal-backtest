/* Google Drive read/write for journal.json — no server needed */
(function(root) {
  'use strict';
  var CLIENT_ID = ''; // set by init()
  var FILE_NAME = 'journal-trading.json'; // overridden by init()
  var SCOPES = 'https://www.googleapis.com/auth/drive.file';
  var DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  var DRIVE_API = 'https://www.googleapis.com/drive/v3';
  var UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

  var tokenClient = null;
  var accessToken = null;
  var tokenExp = 0;              // epoch ms when the token dies
  var fileId = null;             // Drive file ID of journal.json
  var onAuthChange = null;
  var DB_CACHE_KEY = '';
  var REMEMBER = 'drive_connected';   // survives a tab close, unlike the token
  var pending = null;            // { resolve, reject } for an in-flight token request
  var refreshTimer = null;

  function init(opts) {
    CLIENT_ID = opts.clientId;
    FILE_NAME = opts.fileName || 'journal-trading.json';
    DB_CACHE_KEY = 'drive_cache_' + FILE_NAME;
    onAuthChange = opts.onAuthChange || function() {};

    var saved = sessionStorage.getItem('drive_token');
    if (saved) {
      try {
        var t = JSON.parse(saved);
        if (t.expires_at > Date.now() + 30000) { accessToken = t.access_token; tokenExp = t.expires_at; }
      } catch (e) {}
    }
    scheduleRefresh();

    // Reacquire quietly when the user comes back to the tab after a long pause
    if (!init._hooked) {
      init._hooked = true;
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden && wasConnected() && !tokenValid()) {
          ensureToken(false).then(function() { onAuthChange(true); }).catch(function() {});
        }
      });
    }
  }

  function wasConnected() { try { return localStorage.getItem(REMEMBER) === '1'; } catch (e) { return false; } }
  function tokenValid() { return !!accessToken && tokenExp > Date.now() + 30000; }

  function storeToken(resp) {
    accessToken = resp.access_token;
    tokenExp = Date.now() + ((resp.expires_in || 3600) * 1000);
    try {
      sessionStorage.setItem('drive_token', JSON.stringify({ access_token: accessToken, expires_at: tokenExp }));
      localStorage.setItem(REMEMBER, '1');
    } catch (e) {}
    scheduleRefresh();
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (!tokenExp) return;
    // renew 5 minutes before the token dies, so a save never hits an expired one
    var delay = tokenExp - Date.now() - 5 * 60 * 1000;
    if (delay < 0) delay = 0;
    if (delay > 24 * 3600 * 1000) return;
    refreshTimer = setTimeout(function() {
      if (wasConnected()) ensureToken(false).catch(function() {});
    }, delay);
  }

  function initTokenClient() {
    if (tokenClient) return true;
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) return false;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: function(response) {
        var p = pending; pending = null;
        if (response.error) {
          // the silent renewal was refused: the user must click once to reconnect
          accessToken = null; tokenExp = 0;
          try { sessionStorage.removeItem('drive_token'); localStorage.removeItem(REMEMBER); } catch (e) {}
          onAuthChange(false);
          if (p) p.reject(new Error('AUTH_REQUIRED'));
          return;
        }
        storeToken(response);
        fileId = null;                 // re-discover the file with the new token
        if (p) p.resolve(accessToken);
        onAuthChange(true);
      }
    });
    return true;
  }

  /* Returns a valid token, renewing it silently when possible.
     interactive=true shows the Google popup; false tries a quiet renewal. */
  function ensureToken(interactive) {
    if (tokenValid()) return Promise.resolve(accessToken);
    if (!initTokenClient()) return Promise.reject(new Error('Google non charg\u00e9. Rechargez la page.'));
    if (pending) return pending.promise;          // one request at a time
    var p = {};
    p.promise = new Promise(function(res, rej) { p.resolve = res; p.reject = rej; });
    pending = p;
    try {
      // prompt:'' = no popup when the user already granted access
      tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    } catch (e) {
      pending = null;
      return Promise.reject(e);
    }
    // guard against a silent request that never calls back (popup blocked, session gone)
    setTimeout(function() {
      if (pending === p) { pending = null; p.reject(new Error('SILENT_FAILED')); }
    }, 20000);
    return p.promise;
  }

  function signIn() {
    if (!initTokenClient()) { onAuthChange(false, 'Google Identity Services non charg\u00e9. Rechargez la page.'); return; }
    ensureToken(true).then(function() { onAuthChange(true); })
      .catch(function(e) { onAuthChange(false, e.message); });
  }

  function signOut() {
    if (accessToken && window.google && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(accessToken); } catch (e) {}
    }
    accessToken = null; tokenExp = 0; fileId = null;
    clearTimeout(refreshTimer);
    sessionStorage.removeItem('drive_token');
    try { localStorage.removeItem(REMEMBER); } catch (e) {}
    onAuthChange(false);
  }

  function isSignedIn() {
    // still "signed in" while the token is merely stale but silently renewable
    return tokenValid() || (wasConnected() && !!CLIENT_ID);
  }

  // Authenticated fetch: renews the token once and retries on a 401
  function driveReq(url, opts, _retried) {
    opts = opts || {};
    return ensureToken(false).then(function(tok) {
      var o = { method: opts.method, body: opts.body, headers: {} };
      Object.keys(opts.headers || {}).forEach(function(k) { o.headers[k] = opts.headers[k]; });
      o.headers['Authorization'] = 'Bearer ' + tok;
      return fetch(url, o);
    }).then(function(r) {
      if (r.status === 401 && !_retried) {
        accessToken = null; tokenExp = 0;
        sessionStorage.removeItem('drive_token');
        return driveReq(url, opts, true);     // one silent retry
      }
      if (r.status === 401) {
        accessToken = null; tokenExp = 0;
        sessionStorage.removeItem('drive_token');
        try { localStorage.removeItem(REMEMBER); } catch (e) {}
        onAuthChange(false);
        return Promise.reject(new Error('Session Google expir\u00e9e. Cliquez sur \u00ab Connexion Google \u00bb, vos donn\u00e9es sont conserv\u00e9es.'));
      }
      return r;
    }).catch(function(e) {
      var m = e && e.message;
      if (m === 'SILENT_FAILED' || m === 'AUTH_REQUIRED' || /interaction_required|login_required|consent_required|access_denied/i.test(m || '')) {
        accessToken = null; tokenExp = 0;
        try { sessionStorage.removeItem('drive_token'); localStorage.removeItem(REMEMBER); } catch (e2) {}
        onAuthChange(false);
        return Promise.reject(new Error('Reconnexion Google n\u00e9cessaire. Cliquez sur \u00ab Connexion Google \u00bb, vos donn\u00e9es sont conserv\u00e9es sur cet appareil.'));
      }
      return Promise.reject(e);
    });
  }


  // Find journal.json on Drive
  function findFile() {
    if (fileId) return Promise.resolve(fileId);
    var q = encodeURIComponent("name='" + FILE_NAME + "' and trashed=false");
    return driveReq(DRIVE_API + '/files?q=' + q + '&spaces=drive&fields=files(id,name,modifiedTime)')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.files && data.files.length > 0) {
          fileId = data.files[0].id;
          return fileId;
        }
        return null;
      });
  }

  // Read file content
  function readFile(id) {
    return driveReq(DRIVE_API + '/files/' + id + '?alt=media')
      .then(function(r) { return r.json(); });
  }

  // Create file
  function createFile(content) {
    var metadata = { name: FILE_NAME, mimeType: 'application/json' };
    var body = JSON.stringify(content, null, 1);
    var boundary = '---journalboundary';
    var multipart =
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' +
      body +
      '\r\n--' + boundary + '--';

    return driveReq(UPLOAD_API + '/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body: multipart
    }).then(function(r) { return r.json(); })
      .then(function(data) { fileId = data.id; return data; });
  }

  // Update file content
  function updateFile(id, content) {
    var body = JSON.stringify(content, null, 1);
    return driveReq(UPLOAD_API + '/files/' + id + '?uploadType=media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body
    }).then(function(r) { return r.json(); });
  }

  // Public API
  function load(defaultDb) {
    if (!isSignedIn()) {
      // Return cached version if available
      var cached = localStorage.getItem(DB_CACHE_KEY);
      if (cached) {
        try { return Promise.resolve({ db: JSON.parse(cached), source: 'cache' }); }
        catch(e) {}
      }
      return Promise.resolve({ db: defaultDb, source: 'default' });
    }
    return findFile().then(function(id) {
      if (!id) {
        // First time: create file on Drive with default data
        return createFile(defaultDb).then(function() {
          localStorage.setItem(DB_CACHE_KEY, JSON.stringify(defaultDb));
          return { db: defaultDb, source: 'created' };
        });
      }
      return readFile(id).then(function(db) {
        localStorage.setItem(DB_CACHE_KEY, JSON.stringify(db));
        return { db: db, source: 'drive' };
      });
    });
  }

  function save(db) {
    // Always cache locally first, so nothing is lost even if the network call fails
    try { localStorage.setItem(DB_CACHE_KEY, JSON.stringify(db)); } catch (e) {}
    if (!isSignedIn()) {
      return Promise.reject(new Error('Non connecté. Connectez-vous avec Google pour enregistrer.'));
    }
    return findFile().then(function(id) {
      if (!id) {
        return createFile(db);
      }
      return updateFile(id, db);
    });
  }

  // Get cached DB (for offline use)
  function getCached() {
    var cached = localStorage.getItem(DB_CACHE_KEY);
    if (cached) { try { return JSON.parse(cached); } catch(e) {} }
    return null;
  }

  root.Drive = {
    init: init, signIn: signIn, signOut: signOut, isSignedIn: isSignedIn,
    load: load, save: save, getCached: getCached
  };
})(window);
