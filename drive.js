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
  var fileId = null;             // Drive file ID of the journal
  var onAuthChange = null;
  var DB_CACHE_KEY = '';
  var REMEMBER = 'drive_connected';   // survives a tab close, unlike the token
  var sessionLive = false;       // a token was obtained/restored during THIS page session
  var announced = false;         // onAuthChange(true) already delivered for the current session
  var renewing = null;           // the one silent renewal in flight
  var returnError = '';          // error reported by Google when coming back from the login page

  function wasConnected() { try { return localStorage.getItem(REMEMBER) === '1'; } catch (e) { return false; } }
  function tokenValid() { return !!accessToken && tokenExp > Date.now() + 30000; }
  function dirtyKey() { return 'drive_dirty_' + FILE_NAME; }
  function isDirty() { try { return localStorage.getItem(dirtyKey()) === '1'; } catch (e) { return false; } }
  function setDirty(on) { try { if (on) localStorage.setItem(dirtyKey(), '1'); else localStorage.removeItem(dirtyKey()); } catch (e) {} }
  function rand() { var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function(b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  function parseFragment(h) {
    var out = {};
    String(h || '').replace(/^#/, '').split('&').forEach(function(kv) {
      var i = kv.indexOf('=');
      if (i > 0) { try { out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) {} }
    });
    return out;
  }

  // The address Google sends the user back to: exactly the app's own page (must be an authorised redirect URI)
  function appUrl() {
    var p = location.pathname.replace(/index\.html$/, '');
    if (!/\/$/.test(p)) p += '/';
    return location.origin + p;
  }
  function authUrl(state, prompt) {
    return 'https://accounts.google.com/o/oauth2/v2/auth' +
      '?client_id=' + encodeURIComponent(CLIENT_ID) +
      '&redirect_uri=' + encodeURIComponent(appUrl()) +
      '&response_type=token' +
      '&scope=' + encodeURIComponent(SCOPES) +
      '&include_granted_scopes=true' +
      '&state=' + encodeURIComponent(state) +
      (prompt ? '&prompt=' + prompt : '');
  }

  function storeToken(resp) {
    accessToken = resp.access_token;
    tokenExp = Date.now() + ((+resp.expires_in || 3600) * 1000);
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
    // Quiet reconnection in the background (hidden frame: no pop-up, nothing to block, nothing to click)
    if (!init._boot) {
      init._boot = true;
      if (wasConnected() && !tokenValid()) {
        setTimeout(function() {
          ensureToken().then(function() {
            if (!announced) { announced = true; onAuthChange(true); }
          }).catch(function() {});
        }, 700);
      }
    }
  }

  /* Silent renewal through a hidden frame (prompt=none). Works while the Google session is alive and
     third-party cookies are allowed; otherwise it simply fails and the user is asked to click once. */
  function silentRenew() {
    return new Promise(function(resolve, reject) {
      var st = 'r' + rand();
      var frame = document.createElement('iframe');
      frame.style.cssText = 'display:none;width:0;height:0;border:0';
      var done = false, timer = null;
      function finish(err) {
        if (done) return; done = true;
        window.removeEventListener('message', onMsg);
        clearTimeout(timer);
        try { frame.parentNode.removeChild(frame); } catch (e) {}
        if (err) reject(new Error(err)); else resolve(accessToken);
      }
      function onMsg(ev) {
        if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'oauth_fragment') return;
        var p = parseFragment(ev.data.hash);
        if (p.state !== st) return;
        if (p.access_token) { storeToken(p); sessionLive = true; finish(null); }
        else finish('AUTH_REQUIRED');
      }
      window.addEventListener('message', onMsg);
      timer = setTimeout(function() { finish('SILENT_FAILED'); }, 10000);
      frame.src = authUrl(st, 'none');
      (document.body || document.documentElement).appendChild(frame);
    });
  }

  function ensureToken() {
    if (tokenValid()) return Promise.resolve(accessToken);
    if (!(sessionLive || wasConnected())) return Promise.reject(new Error('AUTH_REQUIRED'));
    if (!renewing) {
      renewing = silentRenew().then(function(t) { renewing = null; return t; }, function(e) { renewing = null; throw e; });
    }
    return renewing;
  }

  // User click: full-page redirect to Google, then Google sends the user straight back here with the token.
  // No pop-up, so nothing depends on a channel between two windows.
  function signIn() {
    if (tokenValid()) { announced = true; onAuthChange(true); return; }
    var st = rand();
    try {
      sessionStorage.setItem('oauth_state', st);
      sessionStorage.setItem('oauth_return', location.hash || '');
    } catch (e) {}
    location.assign(authUrl(st));
  }

  function signOut() {
    accessToken = null; tokenExp = 0; fileId = null; sessionLive = false; announced = false;
    try { sessionStorage.removeItem('drive_token'); localStorage.removeItem(REMEMBER); } catch (e) {}
    onAuthChange(false);
  }

  function isSignedIn() {
    return tokenValid() || (sessionLive && wasConnected() && !!CLIENT_ID);
  }

  function takeReturnError() { var e = returnError; returnError = ''; return e; }

  // Authenticated fetch: renews the token quietly when needed and retries once on a 401
  function driveReq(url, opts, _retried) {
    opts = opts || {};
    return ensureToken().then(function(tok) {
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
      if (/^(SILENT_FAILED|AUTH_REQUIRED)$/.test(m)) {
        if (!tokenValid()) failAuth();
        return Promise.reject(new Error('Reconnexion Google n\u00e9cessaire. Cliquez sur \u00ab Connexion Google \u00bb, vos donn\u00e9es sont conserv\u00e9es sur cet appareil.'));
      }
      return Promise.reject(e);
    });
  }

  // Every Drive answer is checked: an HTTP error is an error, never a silent "saved"
  function jsonOk(r) {
    if (!r.ok) throw new Error('Google Drive a r\u00e9pondu ' + r.status + '.');
    return r.json();
  }

  // Find the journal on Drive
  function findFile() {
    if (fileId) return Promise.resolve(fileId);
    var q = encodeURIComponent("name='" + FILE_NAME + "' and trashed=false");
    return driveReq(DRIVE_API + '/files?q=' + q + '&spaces=drive&fields=files(id,name,modifiedTime)')
      .then(jsonOk)
      .then(function(data) {
        if (data.files && data.files.length > 0) { fileId = data.files[0].id; return fileId; }
        return null;
      });
  }

  function readFile(id) {
    return driveReq(DRIVE_API + '/files/' + id + '?alt=media').then(jsonOk);
  }

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
    }).then(jsonOk).then(function(data) { fileId = data.id; return data; });
  }

  function updateFile(id, content) {
    return driveReq(UPLOAD_API + '/files/' + id + '?uploadType=media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content, null, 1)
    }).then(jsonOk);
  }

  function getCached() {
    var cached = null;
    try { cached = localStorage.getItem(DB_CACHE_KEY); } catch (e) {}
    if (cached) { try { return JSON.parse(cached); } catch (e) {} }
    return null;
  }

  function load(defaultDb) {
    if (!isSignedIn()) {
      var c = getCached();
      if (c) return Promise.resolve({ db: c, source: 'cache' });
      return Promise.resolve({ db: defaultDb, source: 'default' });
    }
    return findFile().then(function(id) {
      var cached = getCached(), dirty = isDirty() && !!cached;
      if (!id) {
        // first time: create the file (from unsynced local edits if there are any)
        var seed = dirty ? cached : defaultDb;
        return createFile(seed).then(function() {
          try { localStorage.setItem(DB_CACHE_KEY, JSON.stringify(seed)); } catch (e) {}
          setDirty(false);
          return { db: seed, source: 'created' };
        });
      }
      if (dirty) {
        // edits made while disconnected are newer than Drive: send them up instead of overwriting them
        return updateFile(id, cached).then(function() {
          setDirty(false);
          return { db: cached, source: 'local-pushed' };
        });
      }
      return readFile(id).then(function(db) {
        try { localStorage.setItem(DB_CACHE_KEY, JSON.stringify(db)); } catch (e) {}
        return { db: db, source: 'drive' };
      });
    });
  }


  // Read-only look at ANOTHER journal file (Backtest vs Live). Never creates or writes anything.
  function peek(name) {
    var key = 'drive_cache_' + name, cached = null, dirty = false;
    try { cached = JSON.parse(localStorage.getItem(key)); dirty = localStorage.getItem('drive_dirty_' + name) === '1'; } catch (e) {}
    if (!isSignedIn() || (dirty && cached)) return Promise.resolve(cached ? { db: cached, source: 'cache' } : { db: null, source: 'none' });
    var q = encodeURIComponent("name='" + name + "' and trashed=false");
    return driveReq(DRIVE_API + '/files?q=' + q + '&spaces=drive&fields=files(id,modifiedTime)').then(jsonOk).then(function(d) {
      if (!d.files || !d.files.length) return cached ? { db: cached, source: 'cache' } : { db: null, source: 'none' };
      return readFile(d.files[0].id).then(function(db) { return { db: db, source: 'drive' }; });
    }).catch(function(e) { if (cached) return { db: cached, source: 'cache' }; throw e; });
  }

  function save(db) {
    // Always keep a local copy first, flagged as "not on Drive yet" until the upload succeeds
    try { localStorage.setItem(DB_CACHE_KEY, JSON.stringify(db)); } catch (e) {}
    setDirty(true);
    if (!isSignedIn()) {
      return Promise.reject(new Error('Non connect\u00e9. Connectez-vous avec Google pour enregistrer.'));
    }
    return findFile().then(function(id) {
      return id ? updateFile(id, db) : createFile(db);
    }).then(function(r) { setDirty(false); return r; });
  }

  /* Coming back from Google's login page: the address now carries #access_token=... (or #error=...).
     Read it, clean the address bar, and restore the page the user was on. Runs before the app starts. */
  (function captureReturn() {
    var h = location.hash || '';
    if (!/[#&](access_token|error)=/.test(h)) return;
    if (window.__OAUTH_FRAME__) return;            // hidden renewal frame: its parent page handles it
    var p = parseFragment(h), expect = null, back = '';
    try {
      expect = sessionStorage.getItem('oauth_state');
      back = sessionStorage.getItem('oauth_return') || '';
      sessionStorage.removeItem('oauth_state'); sessionStorage.removeItem('oauth_return');
    } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search + back); } catch (e) {}
    if (p.error) { returnError = 'Google a renvoy\u00e9 : ' + (p.error_description || p.error); return; }
    if (expect && p.state !== expect) { returnError = 'R\u00e9ponse Google inattendue. R\u00e9essayez de vous connecter.'; return; }
    if (p.access_token) { storeToken(p); sessionLive = true; announced = true; }
  })();

  root.Drive = {
    init: init, signIn: signIn, signOut: signOut, isSignedIn: isSignedIn,
    load: load, save: save, peek: peek, getCached: getCached, isDirty: isDirty, takeReturnError: takeReturnError
  };
})(window);
