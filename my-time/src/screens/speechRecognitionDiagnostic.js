// Isolated, memory-only experiment. No task repository, storage or backend calls.
export const TEST_PHRASES = [
  'Amanhã às dez e um quarto tenho de ir às compras.',
  'Põe meia hora para arrumar a cozinha.',
  'Na próxima sexta-feira às duas e meia, rever a aplicação.',
];

export function localePresence(locales, locale) {
  if (!Array.isArray(locales) || locales.length === 0) return 'Não foi possível determinar';
  const normalize = value => value.replace(/_/g, '-').toLowerCase();
  return locales.some(value => normalize(value) === normalize(locale)) ? 'Sim' : 'Não consta da lista devolvida';
}

export function recognitionError(error) {
  const messages = {
    'not-allowed': 'Sem permissão de microfone. Autoriza o acesso nas definições da aplicação.',
    'service-not-allowed': 'O serviço de reconhecimento não está disponível ou está desativado. Verifica as definições de voz do Android.',
    'language-not-supported': 'O serviço recusou este idioma. Experimenta o outro idioma e verifica as definições de voz.',
    'language-unavailable': 'O idioma está temporariamente indisponível no serviço. Verifica a ligação e os modelos de voz.',
    'no-speech': 'Não foi detetada fala. Aproxima o telemóvel e tenta novamente.',
    'audio-capture': 'Não foi possível captar áudio. Verifica o microfone e se outra aplicação o está a utilizar.',
    network: 'Falha de rede no serviço de voz. Verifica a ligação e tenta novamente.',
    busy: 'O serviço de voz está ocupado. Aguarda e tenta novamente.',
    aborted: 'O reconhecimento foi cancelado.',
    'too-many-requests': 'O serviço recebeu demasiados pedidos. Aguarda antes de repetir.',
  };
  const code = error?.error || error?.code || 'desconhecido';
  return `${messages[code] || 'O serviço não conseguiu concluir o reconhecimento.'} (${code})${error?.message ? `\n${error.message}` : ''}`;
}

export function createSpeechDiagnostic(speech, onChange, writeLog = entry => console.info('[SpeechDiagnostic]', JSON.stringify(entry))) {
  let disposed = false;
  let pending = false;
  let started = false;
  let failed = false;
  let finalTranscript = '';
  let language = 'pt-PT';
  let watchdog;
  let queryTimer;
  let queryVersion = 0;
  let attempt = 0;
  let permissionPending = false;
  let appState = null;
  let windowFocused = null;
  let abortReason = null;
  let sequence = 0;
  const session = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let state = {
    status: 'inativo', busy: false, transcript: '', error: '', results: {},
    diagnostics: { loading: false, services: null, defaultService: null, available: null, locales: null, installedLocales: null, notes: [] },
  };
  const record = (event, details = {}) => {
    // No audio, transcript text or recording URI is written to diagnostic logs.
    const entry = {
      timestamp: new Date().toISOString(), session, sequence: ++sequence, attempt,
      event, appState, windowFocused, permissionPending, started, pending,
      status: state.status, abortReason, ...details,
    };
    try { writeLog(entry); } catch { /* Logging must not interrupt recognition. */ }
  };
  const abort = reason => {
    abortReason = reason;
    record('command.abort', { reason });
    try { speech.abort(); }
    catch (error) { record('command.abort.error', { message: error.message }); }
  };
  const publish = patch => {
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  const fail = message => {
    failed = true;
    publish({ status: 'erro', error: message });
  };
  const arm = (milliseconds, message) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      record('timeout', { milliseconds, message });
      fail(message);
      pending = false;
      started = false;
      publish({ busy: false });
      abort('timeout');
    }, milliseconds);
  };
  const subscriptions = [
    speech.addListener('start', () => {
      record('recognition.start', { ignored: !started });
      if (!started) return;
      publish({ status: 'a ouvir' });
      arm(60000, 'O serviço não terminou após 60 segundos. A captação foi cancelada; tenta uma frase de cada vez.');
    }),
    speech.addListener('audioend', () => {
      record('recognition.audioend', { ignored: !started || failed });
      if (!started || failed) return;
      publish({ status: 'a processar' });
      arm(15000, 'O serviço não devolveu um resultado final. Tenta novamente.');
    }),
    speech.addListener('result', event => {
      record('recognition.result', { isFinal: event.isFinal, alternatives: event.results.length, ignored: !started || failed });
      if (!started || failed) return;
      const transcript = event.results[0]?.transcript || '';
      publish({ transcript });
      if (event.isFinal) {
        finalTranscript = transcript;
        publish({ results: { ...state.results, [language]: transcript }, status: 'a processar' });
      }
    }),
    speech.addListener('nomatch', () => {
      record('recognition.nomatch', { ignored: !started });
      if (started) fail('O serviço não encontrou uma transcrição. Tenta repetir a frase.');
    }),
    speech.addListener('error', event => {
      record('recognition.error', { error: event.error, nativeCode: event.code, message: event.message, ignored: !started || failed });
      if (!started || failed) return;
      fail(recognitionError(event));
      // Wait for end before allowing another session on the same native module.
      arm(5000, state.error);
    }),
    speech.addListener('end', () => {
      record('recognition.end', { ignored: !started, failed, hasFinalResult: Boolean(finalTranscript) });
      if (!started) return;
      clearTimeout(watchdog);
      pending = false;
      started = false;
      if (!failed && !finalTranscript) fail('O serviço terminou sem uma transcrição final. Tenta novamente.');
      publish({ busy: false, status: failed ? 'erro' : 'concluído' });
    }),
    ...['audiostart', 'speechstart', 'speechend'].map(name =>
      speech.addListener(name, () => record(`recognition.${name}`)),
    ),
  ];

  return {
    observeAppState(event, value) {
      if (disposed) return;
      const previous = appState;
      if (event === 'change' || event === 'initial') appState = value;
      if (event === 'focus') windowFocused = true;
      if (event === 'blur') windowFocused = false;
      // Android background can mean a temporary system/service Activity.
      // It cannot establish user intent to cancel. Screen disposal and timeouts
      // still stop the bounded diagnostic session.
      record(`appstate.${event}`, { previous, value, action: 'observe-only' });
    },
    async refresh(androidApi) {
      const version = ++queryVersion;
      clearTimeout(queryTimer);
      const diagnostics = { loading: true, services: null, defaultService: null, available: null, locales: null, installedLocales: null, notes: [] };
      const current = () => !disposed && version === queryVersion;
      publish({ diagnostics: { ...diagnostics } });
      for (const [key, read] of [
        ['services', () => speech.getSpeechRecognitionServices()],
        ['defaultService', () => speech.getDefaultRecognitionService().packageName || null],
        ['available', () => speech.isRecognitionAvailable()],
      ]) {
        try { diagnostics[key] = read(); }
        catch (error) { diagnostics.notes.push(`${key}: ${error.message}`); }
      }
      publish({ diagnostics: { ...diagnostics } });
      record('diagnostics.services', { services: diagnostics.services, defaultService: diagnostics.defaultService, available: diagnostics.available });
      try {
        if (androidApi < 33) throw new Error('A consulta de idiomas requer Android 13 ou superior.');
        if (!diagnostics.defaultService) throw new Error('Não foi possível identificar o serviço predefinido para consultar os seus idiomas.');
        record('diagnostics.locales.request', { packageName: diagnostics.defaultService });
        const response = await Promise.race([
          speech.getSupportedLocales({ androidRecognitionServicePackage: diagnostics.defaultService }),
          new Promise((_, reject) => {
            queryTimer = setTimeout(() => reject(new Error('O serviço não respondeu à consulta de idiomas em 10 segundos.')), 10000);
          }),
        ]);
        if (!current()) return;
        diagnostics.locales = Array.isArray(response.locales) ? response.locales : null;
        diagnostics.installedLocales = Array.isArray(response.installedLocales) ? response.installedLocales : null;
        record('diagnostics.locales.result', { supportedCount: diagnostics.locales?.length, installedCount: diagnostics.installedLocales?.length });
      } catch (error) {
        if (!current()) return;
        record('diagnostics.locales.error', { code: error.code, message: error.message });
        diagnostics.notes.push(error.message);
      } finally {
        if (current()) {
          clearTimeout(queryTimer);
          publish({ diagnostics: { ...diagnostics, loading: false } });
        }
      }
    },
    async start(lang) {
      if (disposed || pending) {
        record('command.start.ignored', { disposed, lang });
        return;
      }
      pending = true; // Also guard rapid taps while the permission prompt is open.
      const currentAttempt = ++attempt;
      failed = false;
      finalTranscript = '';
      language = lang;
      abortReason = null;
      publish({ busy: true, status: 'a processar', error: '', transcript: '' });
      let nativeStartRequested = false;
      try {
        permissionPending = true;
        record('permission.request', { lang });
        const permission = await speech.requestMicrophonePermissionsAsync();
        permissionPending = false;
        record('permission.result', { granted: permission.granted, permissionStatus: permission.status, canAskAgain: permission.canAskAgain, ignored: disposed || currentAttempt !== attempt });
        if (disposed || currentAttempt !== attempt) return;
        if (!permission.granted) {
          record('permission.denied');
          throw { error: 'not-allowed', message: permission.canAskAgain ? 'Tenta novamente e permite o acesso.' : 'Abre Definições → Aplicações → My Time → Permissões → Microfone.' };
        }
        started = true;
        record('command.start', { lang, serviceSelection: 'android-default', reportedDefaultService: state.diagnostics.defaultService });
        arm(15000, 'O serviço não iniciou a captação em 15 segundos. Tenta novamente.');
        nativeStartRequested = true;
        speech.start({
          lang, interimResults: true, continuous: false, maxAlternatives: 1,
          requiresOnDeviceRecognition: false,
          recordingOptions: { persist: false },
          // Omit androidRecognitionServicePackage: Android chooses its default.
        });
      } catch (error) {
        const source = nativeStartRequested ? 'start' : 'permission';
        permissionPending = false;
        record(`${source}.error`, { error: error.error, code: error.code, message: error.message, ignored: disposed || currentAttempt !== attempt });
        if (disposed || currentAttempt !== attempt) return;
        clearTimeout(watchdog);
        fail(recognitionError(error));
        started = false;
        pending = false;
        publish({ busy: false });
        // There is no native session to abort when permission was refused.
        if (nativeStartRequested) abort('start-error');
      }
    },
    stop() {
      record('command.stop', { reason: 'user-stop', ignored: !started || failed });
      if (!started || failed) return;
      publish({ status: 'a processar' });
      arm(15000, 'O serviço não concluiu a transcrição depois de parar. Tenta novamente.');
      try { speech.stop(); }
      catch (error) {
        record('command.stop.error', { message: error.message });
        fail(recognitionError(error));
        arm(5000, state.error);
      }
    },
    cancel() {
      record('command.cancel', { reason: 'explicit-cancel', ignored: !pending });
      if (!pending) return;
      attempt++;
      fail('O teste foi cancelado explicitamente.');
      if (started) {
        arm(5000, state.error);
        abort('explicit-cancel');
      } else {
        pending = false;
        publish({ busy: false });
      }
    },
    dispose() {
      record('lifecycle.dispose', { reason: 'screen-blur-or-unmount' });
      disposed = true;
      queryVersion++;
      clearTimeout(watchdog);
      clearTimeout(queryTimer);
      subscriptions.forEach(subscription => subscription.remove());
      if (started) {
        abort('screen-blur-or-unmount');
      }
    },
  };
}
