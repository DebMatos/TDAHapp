export const PASSWORD_RECOVERY_REDIRECT = 'mytime://reset-password';

const decode = (value) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
};

const readParameters = (value, target) => {
  if (!value) return;

  value.split('&').forEach((entry) => {
    if (!entry) return;
    const separator = entry.indexOf('=');
    const key = decode(separator === -1 ? entry : entry.slice(0, separator));
    const parameterValue = decode(separator === -1 ? '' : entry.slice(separator + 1));
    if (key) target[key] = parameterValue;
  });
};

export const parsePasswordRecoveryUrl = (url) => {
  if (typeof url !== 'string' || !/^mytime:\/\/reset-password(?:[/?#]|$)/i.test(url)) {
    return null;
  }

  const parameters = {};
  const queryStart = url.indexOf('?');
  const fragmentStart = url.indexOf('#');

  if (queryStart !== -1) {
    const queryEnd = fragmentStart !== -1 && fragmentStart > queryStart
      ? fragmentStart
      : url.length;
    readParameters(url.slice(queryStart + 1, queryEnd), parameters);
  }
  if (fragmentStart !== -1) {
    readParameters(url.slice(fragmentStart + 1), parameters);
  }

  if (parameters.type && parameters.type !== 'recovery') return null;

  const code = parameters.code || null;
  const accessToken = parameters.access_token || null;
  const refreshToken = parameters.refresh_token || null;
  if (!code && (!accessToken || !refreshToken)) {
    return { error: 'Este link de recuperação é inválido ou já expirou.' };
  }

  return { code, accessToken, refreshToken };
};
