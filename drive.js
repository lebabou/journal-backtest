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
  var pending = null;            // in-flight token request: { promise, resolve, reject, seq }
  var seq = 0;
  var refreshTimer = null;
  var sessionLive = false;       // a token was obtained/restored during THIS page session
  var announced = false;         // onAuthChange(true) already delivered for the current session

  function wasConnected() { try { return localStorage.getItem(REMEMBER) === '1'; } catch (e) { return false; } }
  function tokenValid() { return !!accessToken && tokenExp > Date.now() + 30000; }

  function whenGoogleReady(cb) {
    var tries = 0;
    (function poll() {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) return cb();
      if (++tries < 40) setTimeout(poll, 250);   // wait up to ~10 s for the Google script
    })();
  }

  function init(opts) {
    CLIENT_ID = opts.clientId;
    FILE_NAME = opts.fileName || 'journal-trading.json';
    DB_CACHE_KEY = 'drive_cache_' + FILE_NAME;
    onAuthChange = opts.onAuthChange || function() {};

    var saved = sessionStorage.getItem('drive_token');
    if (saved) {
      try {
        var t = JSON.parse(saved);
        if (t.expires_at > Date.now() + 30000) {
          accessToken = t.access_token; tokenExp = t.expires_at; sessionLive = true; announced = true;
        }
      } catch (e) {}
    }
    scheduleRefresh();

    if (!init._hooked) {
      init._hooked = true;
      // coming back to the tab after a long pause: renew quietly, only if we were connected in this session
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden && sessionLive && wasConnected() && !tokenValid()) {
          ensureToken(false).catch(function() {});
        }
      });
      // cold start after a previous connection: ONE quiet background attempt.
      // It never blocks the UI and never blocks the user's own click on "Connexion Google".
      if (wasConnected() && !tokenValid()) {
        whenGoogleReady(function() { ensureToken(false, 8000).catch(function() {}); });
      }
    }
  }

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
    var delay = tokenExp - Date.now() - 5 * 60 * 1000;   // renew 5 min before expiry
    if (delay < 0) delay = 0;
    if (delay > 24 * 3600 * 1000) return;
    refreshTimer = setTimeout(function() {
      if (sessionLive && wasConnected()) ensureToken(false).catch(function() {});
    }, delay);
  }

  // The session is really gone: stop pretending we are connected (but remember the user was)
  function failAuth() {
    accessToken = null; tokenExp = 0; sessionLive = false; announced = false;
    clearTimeout(refreshTimer);
    try { sessionStorage.removeItem('drive_token'); } catch (e) {}
    onAuthChange(false);
  }

  function initTokenClient() {
    if (tokenClient) return true;
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) return false;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: function(response) {
        var p = pending;
        // ignore a late answer that belongs to an older, superseded request
        if (p && response.state !== undefined && String(response.state) !== String(p.seq)) return;
        pending = null;
        if (response.error) {
          if (!tokenValid()) failAuth();     // a failed background renewal must not drop a still-valid token
          if (p) p.reject(new Error('AUTH_REQUIRED'));
          return;
        }
        storeToken(response);
        fileId = null;
        sessionLive = true;
        if (p) p.resolve(accessToken);
        if (!announced) { announced = true; onAuthChange(true); }   // only on a real (re)connection, never on a silent renewal
      },
      error_callback: function(err) {      // popup blocked / closed by the user
        var p = pending; pending = null;
        if (!tokenValid()) failAuth();
        if (p) p.reject(new Error(err && err.type === 'popup_closed' ? 'POPUP_CLOSED' : 'POPUP_BLOCKED'));
      }
    });
    return true;
  }

  /* Returns a valid token. interactive=true is meant for a user click and always
     takes priority over any silent request still in flight. */
  function ensureToken(interactive, timeoutMs) {
    if (tokenValid()) return Promise.resolve(accessToken);
    if (!initTokenClient()) return Promise.reject(new Error('GIS_NOT_LOADED'));
    if (pending) {
      if (!interactive) return pending.promise;
      var old = pending; pending = null; old.reject(new Error('SUPERSEDED'));   // a click must never wait behind a silent request
    }
    var p = { seq: ++seq };
    p.promise = new Promise(function(res, rej) { p.resolve = res; p.reject = rej; });
    pending = p;
    try {
      tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '', state: String(p.seq) });
    } catch (e) {
      pending = null;
      return Promise.reject(e);
    }
    var limit = timeoutMs || (interactive ? 180000 : 10000);
    setTimeout(function() {
      if (pending === p) { pending = null; p.reject(new Error('SILENT_FAILED')); }
    }, limit);
    return p.promise;
  }

  function friendly(m) {
    if (m === 'POPUP_BLOCKED') return 'La fen\u00eatre de connexion Google a \u00e9t\u00e9 bloqu\u00e9e. Autorisez les fen\u00eatres pop-up pour ce site, puis r\u00e9essayez.';
    if (m === 'POPUP_CLOSED') return 'Connexion annul\u00e9e.';
    if (m === 'SILENT_FAILED') return 'Google n\u2019a pas r\u00e9pondu. R\u00e9essayez dans un instant.';
    if (m === 'GIS_NOT_LOADED') return 'Google n\u2019est pas charg\u00e9. V\u00e9rifiez votre connexion internet puis rechargez la page.';
    if (m === 'AUTH_REQUIRED') return 'Google a refus\u00e9 la connexion. R\u00e9essayez.';
    return m;
  }

  function signIn() {
    if (tokenValid()) { announced = true; onAuthChange(true); return; }
    if (!initTokenClient()) { onAuthChange(false, friendly('GIS_NOT_LOADED')); return; }
    announced = false;                     // a successful click must reload the Drive data
    ensureToken(true).catch(function(e) {
      if (e && e.message === 'SUPERSEDED') return;
      onAuthChange(false, friendly(e && e.message));
    });
  }

  function signOut() {
    if (accessToken && window.google && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(accessToken); } catch (e) {}
    }
    accessToken = null; tokenExp = 0; fileId = null; sessionLive = false; announced = false;
    clearTimeout(refreshTimer);
    try { sessionStorage.removeItem('drive_token'); localStorage.removeItem(REMEMBER); } catch (e) {}
    onAuthChange(false);
  }

  function isSignedIn() {
    // "signed in" while the token is merely stale but silently renewable in this session
    return tokenValid() || (sessionLive && wasConnected() && !!CLIENT_ID);
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
        try { sessionStorage.removeItem('drive_token'); } catch (e) {}
        return driveReq(url, opts, true);          // one silent retry
      }
      if (r.status === 401) {
        failAuth();
        return Promise.reject(new Error('Session Google expir\u00e9e. Cliquez sur \u00ab Connexion Google \u00bb, vos donn\u00e9es sont conserv\u00e9es.'));
      }
      return r;
    }).catch(function(e) {
      var m = (e && e.message) || '';
      if (/^(SILENT_FAILED|AUTH_REQUIRED|POPUP_BLOCKED|POPUP_CLOSED|SUPERSEDED|GIS_NOT_LOADED)$/.test(m) ||
          /interaction_required|login_required|consent_required|access_denied/i.test(m)) {
        if (!tokenValid()) failAuth();
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
