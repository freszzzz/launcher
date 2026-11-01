// Logowanie Microsoft -> Xbox Live -> XSTS -> Minecraft Services.
// Łańcuch: kod OAuth2 -> token MS (+refresh) -> token XBL -> token XSTS -> token Minecraft -> profil.
const { BrowserWindow } = require('electron');
const { HttpError, getJson, postJson, postForm, request } = require('./http');

// Tryb "live": publiczny client id używany przez wiele launcherów open-source (msmc itp.).
const LIVE = {
  mode: 'live',
  clientId: '00000000402b5328',
  authorize: 'https://login.live.com/oauth20_authorize.srf',
  token: 'https://login.live.com/oauth20_token.srf',
  redirect: 'https://login.live.com/oauth20_desktop.srf',
  scope: 'service::user.auth.xboxlive.com::MBI_SSL',
  rpsPrefix: ''
};

// Tryb "azure": własna aplikacja z Azure Portal (wymaga zatwierdzenia przez Mojang dla API Minecraft).
function azureConfig(clientId) {
  return {
    mode: 'azure',
    clientId,
    authorize: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    redirect: 'https://login.microsoftonline.com/common/oauth2/nativeclient',
    scope: 'XboxLive.signin offline_access',
    rpsPrefix: 'd='
  };
}

function getConfig(settings) {
  const id = (settings.msClientId || '').trim();
  return id ? azureConfig(id) : LIVE;
}

const XERR = {
  2148916233: 'To konto Microsoft nie ma profilu Xbox. Załóż go na xbox.com i spróbuj ponownie.',
  2148916235: 'Xbox Live jest niedostępny w kraju przypisanym do konta.',
  2148916236: 'Konto wymaga weryfikacji pełnoletności (Korea Płd.).',
  2148916237: 'Konto wymaga weryfikacji pełnoletności (Korea Płd.).',
  2148916238: 'Konto dziecka – rodzic musi dodać je do Rodziny Microsoft.'
};

class AuthError extends Error {
  constructor(message, code = 'auth') {
    super(message);
    this.code = code;
  }
}

/** Otwiera okno logowania Microsoft i zwraca kod autoryzacyjny z przekierowania. */
function promptForCode(cfg, parent) {
  const url = new URL(cfg.authorize);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    scope: cfg.scope,
    redirect_uri: cfg.redirect,
    prompt: 'select_account'
  }).toString();

  const win = new BrowserWindow({
    width: 520,
    height: 700,
    parent,
    modal: !!parent,
    autoHideMenuBar: true,
    title: 'Logowanie – Microsoft',
    backgroundColor: '#120d1a',
    webPreferences: {
      // Partycja w pamięci = zawsze świeża sesja (łatwa zmiana konta).
      partition: `mslogin-${Date.now()}`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  return new Promise((resolve, reject) => {
    let settled = false;

    const check = (navUrl) => {
      if (settled || !navUrl || !navUrl.startsWith(cfg.redirect)) return false;
      settled = true;
      const params = new URL(navUrl).searchParams;
      const code = params.get('code');
      const error = params.get('error');
      if (code) resolve(code);
      else if (error === 'access_denied') reject(new AuthError('Logowanie anulowane.', 'cancelled'));
      else reject(new AuthError(params.get('error_description') || error || 'Nieznany błąd logowania.'));
      setImmediate(() => !win.isDestroyed() && win.destroy());
      return true;
    };

    const onNav = (event, legacyUrl) => {
      if (check(event.url || legacyUrl)) event.preventDefault();
    };
    win.webContents.on('will-redirect', onNav);
    win.webContents.on('will-navigate', onNav);
    win.webContents.on('did-navigate', (_e, navUrl) => check(navUrl));
    win.webContents.on('did-fail-load', (_e, _code, _desc, failedUrl) => check(failedUrl));

    win.on('closed', () => {
      if (!settled) reject(new AuthError('Zamknięto okno logowania.', 'cancelled'));
    });

    win.loadURL(url.toString());
  });
}

const msToken = (cfg, fields) =>
  postForm(cfg.token, {
    client_id: cfg.clientId,
    scope: cfg.scope,
    redirect_uri: cfg.redirect,
    ...fields
  });

async function xboxChain(cfg, msAccessToken) {
  const xbl = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `${cfg.rpsPrefix}${msAccessToken}`
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  });
  const uhs = xbl.DisplayClaims.xui[0].uhs;

  let xsts;
  try {
    xsts = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    });
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      throw new AuthError(XERR[err.body?.XErr] || `Odmowa XSTS (${err.body?.XErr || 401}).`, 'xsts');
    }
    throw err;
  }

  let mc;
  try {
    mc = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
      identityToken: `XBL3.0 x=${uhs};${xsts.Token}`
    });
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      throw new AuthError(
        'Minecraft Services odrzuciło logowanie. Jeśli używasz własnego Azure Client ID, ' +
          'aplikacja musi zostać zatwierdzona przez Mojang (formularz „Minecraft API access”).',
        'mc'
      );
    }
    throw err;
  }

  return { mcToken: mc.access_token, mcExpiresAt: Date.now() + (mc.expires_in - 120) * 1000 };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function getProfile(mcToken) {
  try {
    return await getJson('https://api.minecraftservices.com/minecraft/profile', bearer(mcToken));
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      throw new AuthError('To konto nie posiada Minecraft: Java Edition.', 'nogame');
    }
    throw err;
  }
}

async function buildAccount(cfg, msTokens) {
  const mc = await xboxChain(cfg, msTokens.access_token);
  const profile = await getProfile(mc.mcToken);
  return {
    uuid: profile.id,
    name: profile.name,
    mcToken: mc.mcToken,
    mcExpiresAt: mc.mcExpiresAt,
    msRefreshToken: msTokens.refresh_token,
    authMode: cfg.mode,
    clientId: cfg.clientId
  };
}

/** Pełne logowanie interaktywne. */
async function login(parent, settings) {
  const cfg = getConfig(settings);
  const code = await promptForCode(cfg, parent);
  const tokens = await msToken(cfg, { grant_type: 'authorization_code', code });
  return buildAccount(cfg, tokens);
}

/** Odświeża token Minecraft przy pomocy refresh tokena MS, gdy wygasł. */
async function ensureValid(account, settings) {
  if (account.mcExpiresAt && Date.now() < account.mcExpiresAt) return account;

  const cfg = account.authMode === 'azure' ? azureConfig(account.clientId) : getConfig(settings);
  let tokens;
  try {
    tokens = await msToken(cfg, { grant_type: 'refresh_token', refresh_token: account.msRefreshToken });
  } catch (err) {
    if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
      throw new AuthError('Sesja wygasła – zaloguj się ponownie.', 'expired');
    }
    throw err;
  }
  return buildAccount(cfg, tokens);
}

async function setActiveCape(mcToken, capeId) {
  const url = 'https://api.minecraftservices.com/minecraft/profile/capes/active';
  if (!capeId) return request(url, { method: 'DELETE', headers: bearer(mcToken) });
  return request(url, {
    method: 'PUT',
    body: JSON.stringify({ capeId }),
    headers: { ...bearer(mcToken), 'Content-Type': 'application/json' }
  });
}

module.exports = { login, ensureValid, getProfile, setActiveCape, AuthError };
