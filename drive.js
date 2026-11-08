/* Google Drive read/write for journal.json — no server needed */
(function(root) {
  'use strict';
  var CLIENT_ID = ''; // set by init()
  var FILE_NAME = 'journal-trading.json'; // overridden by init()
  var SCOPES = 'https://www.googleapis.com/auth/drive.file';
  var DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  var DRIVE_API = 'https://www.googleapis.com/drive/v3';
  var UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

  var accessToken = null;
  var tokenExp = 0;              // epoch ms when the token dies
  var fileId = null;             // Drive file ID of journal.json
  var onAuthChange = null;
  var DB_CACHE_KEY = '';
  var REMEMBER = 'drive_connected';   // survives a tab close, unlike the token
  var pending = null;            // the ONE token request the app is currently waiting for
  var seq = 0;
  var sessionLive = false;       // a token was obtained/restored during THIS page session
  var announced = false;         // onAuthChange(true) already delivered for the current session
  var POPUP_GRACE_MS = 15000;    // a "popup closed" report can be a false alarm on mobile: wait before believing it

  function wasConnected() { try { return localStorage.getItem(REMEMBER) === '1'; } catch (e) { return false; } }
  function tokenValid() { return !!accessToken && tokenExp > Date.now() + 30000; }
  function gisReady() { return !!(window.google && window.google.accounts && window.google.accounts.oauth2); }

  function init(opts) {
    CLIENT_ID = opts.clientId;
    FILE_NAME = opts.fileName || 'journal-trading.json';
    DB_CACHE_KEY = 'drive_cache_' + FILE_NAME;
    onAuthChange = opts.onAuthChange || function() {};
    // Nothing here ever talks to Google: no background request is started without a user action.
    var saved = sessionStorage.getItem('drive_token');
    if (saved) {
      try {
        var t = JSON.parse(saved);
        if (t.expires_at > Date.now() + 30000) {
          accessToken = t.access_token; tokenExp = t.expires_at; sessionLive = true; announced = true;
        }
      } catch (e) {}
    }
  }

  function storeToken(resp) {
    accessToken = resp.access_token;
    tokenExp = Date.now() + ((resp.expires_in || 3600) * 1000);
    try {
      sessionStorage.setItem('drive_token', JSON.stringify({ access_token: accessToken, expires_at: tokenExp }));
      localStorage.setItem(REMEMBER, '1');
    } catch (e) {}
  }

  // The session is really gone: stop pretending we are connected (but remember the user was)
  function failAuth() {
    accessToken = null; tokenExp = 0; sessionLive = false; announced = false;
    try { sessionStorage.removeItem('drive_token'); } catch (e) {}
    onAuthChange(false);
  }

  /* One token request = one private token client. Every callback below is bound to
     THIS request, so a late answer from an older request can never cancel a newer one. */
  function startRequest(interactive) {
    var p = { seq: ++seq };
    p.promise = new Promise(function(res, rej) { p.resolve = res; p.reject = rej; });
    pending = p;
    var mine = p.seq, grace = null;
    function current() { return !!pending && pending.seq === mine; }
    function settle(code) {
      clearTimeout(grace);
      if (!current()) return;                       // stale: ignore
      var pp = pending; pending = null;
      if (!tokenValid()) failAuth();
      pp.reject(new Error(code));
    }
    try {
      var client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: function(response) {
          clearTimeout(grace);
          if (response.error) { settle('AUTH_REQUIRED'); return; }
          // a valid token is always welcome, even if it answers a request we already gave up on
          storeToken(response);
          fileId = null;
          sessionLive = true;
          if (current()) { var pp = pending; pending = null; pp.resolve(accessToken); }
          if (!announced) { announced = true; onAuthChange(true); }   // only on a real (re)connection
        },
        error_callback: function(err) {
          if (!current()) return;
          if (err && err.type === 'popup_closed') {
            // may be a false alarm (tab switch on mobile): give a late token a chance to arrive
            clearTimeout(grace);
            grace = setTimeout(function() { settle('POPUP_CLOSED'); }, POPUP_GRACE_MS);
            return;
          }
          settle('POPUP_BLOCKED');
        }
      });
      client.requestAccessToken({ prompt: (interactive && !wasConnected()) ? 'consent' : '' });
    } catch (e) {
      if (current()) pending = null;
      return Promise.reject(e);
    }
    setTimeout(function() { if (current()) settle('SILENT_FAILED'); }, interactive ? 180000 : 10000);
    return p.promise;
  }

  /* Returns a valid token. interactive=true is for a user click and always takes
     priority over any request still in flight. */
  function ensureToken(interactive) {
    if (tokenValid()) return Promise.resolve(accessToken);
    if (!gisReady()) return Promise.reject(new Error('GIS_NOT_LOADED'));
    if (pending) {
      if (!interactive) return pending.promise;
      var old = pending; pending = null; old.reject(new Error('SUPERSEDED'));
    }
    return startRequest(interactive);
  }

  function friendly(m) {
    if (m === 'POPUP_BLOCKED') return 'La fen\u00eatre de connexion Google a \u00e9t\u00e9 bloqu\u00e9e. Autorisez les fen\u00eatres pop-up pour ce site, puis r\u00e9essayez.';
    if (m === 'POPUP_CLOSED') return 'Connexion interrompue : la fen\u00eatre Google s\u2019est ferm\u00e9e avant la fin. R\u00e9essayez ; si elle affichait une erreur, notez son message.';
    if (m === 'SILENT_FAILED') return 'Google n\u2019a pas r\u00e9pondu. R\u00e9essayez dans un instant.';
    if (m === 'GIS_NOT_LOADED') return 'Google n\u2019est pas encore charg\u00e9. Patientez quelques secondes (ou rechargez la page) puis r\u00e9essayez.';
    if (m === 'AUTH_REQUIRED') return 'Google a refus\u00e9 la connexion. V\u00e9rifiez que votre adresse est bien autoris\u00e9e, puis r\u00e9essayez.';
    return m;
  }

  function signIn() {
    if (tokenValid()) { announced = true; onAuthChange(true); return; }
    if (!gisReady()) { onAuthChange(false, friendly('GIS_NOT_LOADED')); return; }
    announced = false;                     // a successful click must reload the Drive data
    ensureToken(true).catch(function(e) {
      if (e && e.message === 'SUPERSEDED') return;
      onAuthChange(false, friendly(e && e.message));
    });
  }

  function signOut() {
    if (accessToken && gisReady()) {
      try { google.accounts.oauth2.revoke(accessToken); } catch (e) {}
    }
    accessToken = null; tokenExp = 0; fileId = null; sessionLive = false; announced = false; pending = null;
    try { sessionStorage.removeItem('drive_token'); localStorage.removeItem(REMEMBER); } catch (e) {}
    onAuthChange(false);
  }

  function isSignedIn() {
    // "signed in" while the token is merely stale but renewable on the next user action
    return tokenValid() || (sessionLive && wasConnected() && !!CLIENT_ID);
  }

  // Authenticated fetch: renews the token on demand (inside the user's action) and retries once on a 401
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
        return driveReq(url, opts, true);
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
        if (m !== 'SUPERSEDED' && !tokenValid()) failAuth();
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
