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
  var fileId = null; // Drive file ID of journal.json
  var onAuthChange = null;
  var DB_CACHE_KEY = '';

  function init(opts) {
    CLIENT_ID = opts.clientId;
    FILE_NAME = opts.fileName || 'journal-trading.json';
    DB_CACHE_KEY = 'drive_cache_' + FILE_NAME;
    onAuthChange = opts.onAuthChange || function() {};

    // Try to restore token from session
    var saved = sessionStorage.getItem('drive_token');
    if (saved) {
      try {
        var t = JSON.parse(saved);
        if (t.expires_at > Date.now()) {
          accessToken = t.access_token;
        }
      } catch(e) {}
    }
  }

  function initTokenClient() {
    if (tokenClient) return;
    if (!window.google || !window.google.accounts) {
      console.error('Google Identity Services not loaded');
      return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: function(response) {
        if (response.error) {
          console.error('Auth error:', response);
          onAuthChange(false, response.error_description || response.error);
          return;
        }
        accessToken = response.access_token;
        // Save with expiry
        sessionStorage.setItem('drive_token', JSON.stringify({
          access_token: accessToken,
          expires_at: Date.now() + (response.expires_in || 3600) * 1000
        }));
        fileId = null; // re-discover file
        onAuthChange(true);
      }
    });
  }

  function signIn() {
    initTokenClient();
    if (!tokenClient) {
      onAuthChange(false, 'Google Identity Services non chargé. Rechargez la page.');
      return;
    }
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken);
    }
    accessToken = null;
    fileId = null;
    sessionStorage.removeItem('drive_token');
    onAuthChange(false);
  }

  function isSignedIn() {
    return !!accessToken;
  }

  // Raw fetch with auth
  function driveReq(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['Authorization'] = 'Bearer ' + accessToken;
    return fetch(url, opts).then(function(r) {
      if (r.status === 401) {
        // Token expired, try to refresh
        accessToken = null;
        sessionStorage.removeItem('drive_token');
        return Promise.reject(new Error('Session expirée. Reconnectez-vous.'));
      }
      return r;
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
    if (!accessToken) {
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
    // Always cache locally first
    localStorage.setItem(DB_CACHE_KEY, JSON.stringify(db));
    if (!accessToken) {
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
