# Diagnóstico temporário de reconhecimento de voz Android

Experiência técnica fora do âmbito da V0.1. Não cria tarefas, não interpreta datas,
não guarda áudio e não envia transcrições para o backend. Os resultados ficam apenas
na memória deste ecrã, até sair. O serviço de voz do Android pode enviar áudio para
os seus próprios servidores: o teste não exige funcionamento offline.

## Projeto e compatibilidade

- Expo instalado: **58.0.19**; React Native: **0.88.0**; React: **19.3.0**.
- Navegação: React Navigation 7, drawer em `App.js`, após autenticação.
- Existe `android/` local gerado e ignorado pelo Git. O projeto não tem
  `expo-dev-client` nem `eas.json`; os scripts permitem Expo Go (`expo start`) e
  compilação nativa local (`expo run:android`). Não é possível inferir qual binário
  está instalado no telemóvel apenas a partir do repositório.
- Foi instalada apenas `expo-speech-recognition`, versão exata **58.0.1**.
  O [changelog oficial](https://github.com/jamsch/expo-speech-recognition/blob/main/CHANGELOG.md)
  alinha a versão 58 com Expo SDK 58 / RN 0.88 / React 19.3.
  A [documentação da biblioteca](https://github.com/jamsch/expo-speech-recognition#installation)
  descreve o config plugin, as APIs e a compilação nativa.
- `AGENTS.md` aponta para a documentação Expo 54; foi consultada, mas o projeto
  instalado é SDK 58. Foram verificadas também a documentação Expo 58 e as APIs
  da versão efetivamente instalada da biblioteca.

## Compilar e abrir no Samsung A55

É necessária **uma nova compilação nativa Android em modo debug**. O Expo Go e
uma compilação anterior sem o módulo não conseguem executar este teste. O módulo
é carregado apenas ao abrir o diagnóstico, para evitar falhar o arranque do Home
num binário antigo. Não foi acrescentado `expo-dev-client`: uma build debug local
é suficiente; o launcher adicional desse pacote não é necessário para esta prova.

No computador, instala/configura o JDK e o Android SDK exigidos pelo Expo SDK 58
e disponibiliza `adb` no PATH. No A55, ativa Opções de programador → Depuração USB,
liga-o por USB e aceita a autorização do computador.

```bash
cd /home/pedro/Projetos/TDAHapp/my-time
npm ci
adb devices
npx expo prebuild --platform android --no-clean --no-install --skip-dependency-update react,react-native
npx expo run:android --device
```

Seleciona o Samsung A55 na lista. Se o prebuild pedir o identificador Android,
mantém o `applicationId` já presente em `android/app/build.gradle`.
`--no-clean` aplica o plugin à pasta nativa existente, sem a recriar;
`--no-install` evita instalações implícitas. A configuração original do projeto
é preservada. O prebuild é explícito porque `run:android` pode reutilizar uma
pasta `android/` existente sem voltar a aplicar os plugins.

O último comando compila, instala e inicia o Metro. Em sessões posteriores,
com o mesmo binário já instalado, podes iniciar o Metro separadamente:

```bash
adb reverse tcp:8081 tcp:8081
npx expo start --localhost
```

Abre manualmente a aplicação instalada no A55. Não abras o projeto no Expo Go.
Não é necessário recompilar por cada alteração JavaScript; alterações ao plugin
ou ao módulo nativo exigem repetir o prebuild e a compilação.

Depois de iniciar sessão: abre o menu lateral → **Diagnóstico de voz
(desenvolvimento)**. A rota `SpeechRecognitionTest` e a entrada do menu só são
registadas quando `__DEV__` está ativo. Há um botão para voltar ao início.

## O que observar

- Android/API/modelo, lista de serviços visíveis à aplicação, pacote predefinido
  e disponibilidade. O plugin concede visibilidade a pacotes Google e Samsung e
  ao intent `android.speech.RecognitionService`; não seleciona nenhum motor.
- Os idiomas são consultados para o pacote predefinido identificado. Não se usa
  a consulta sem pacote: a biblioteca poderia consultar outro motor, de uso local.
- `locales` reúne idiomas online e/ou locais reportados pelo serviço;
  `installedLocales` identifica os modelos locais instalados reportados.
  Um idioma suportado não implica ter um modelo instalado.
- Erros, Android anterior a 13, listas vazias/inconclusivas e ausência de resposta
  em 10 segundos mostram **Não foi possível determinar**. Numa lista não vazia,
  a ausência é indicada como **Não consta da lista devolvida**.
- A consulta nunca bloqueia o teste de `pt-PT` ou `pt-BR`. O início pede permissão
  de microfone e omite `androidRecognitionServicePackage`, deixando o Android usar
  o seu serviço predefinido. Não há fallback automático entre idiomas ou motores.
- Resultados parciais são substituídos pelo resultado final. Um fim sem resultado
  final é erro. `Parar` pede um resultado final; sair do ecrã cancela a sessão e
  remove os listeners. Mudanças de `AppState` e de foco são registadas, sem
  cancelamento automático: no Android podem corresponder a Activities temporárias
  de permissões ou do serviço. Existem limites
  de espera para um serviço que não inicia ou não termina.

## Procedimento manual

1. Com ligação à internet, regista o pacote predefinido, serviços, idiomas e modelos
   instalados apresentados. Se alterares o serviço nas definições, usa
   **Atualizar diagnóstico** antes de repetir.
2. Seleciona `pt-PT`, toca em **Iniciar gravação**, aceita a permissão e espera por
   **a ouvir**. Diz uma frase. Espera pela conclusão ou toca em **Parar**.
3. Repete a mesma frase em `pt-BR` e compara os últimos resultados finais por idioma.
   Regista externamente cada par antes da frase seguinte: o ecrã conserva apenas
   o último resultado final de cada idioma.
4. Usa as três frases, também apresentadas no ecrã:

   - “Amanhã às dez e um quarto tenho de ir às compras.”
   - “Põe meia hora para arrumar a cozinha.”
   - “Na próxima sexta-feira às duas e meia, rever a aplicação.”

| Frase | Resultado pt-PT | Resultado pt-BR | Erro/código | Observações |
| --- | --- | --- | --- | --- |
| 1 | Por testar no A55 | Por testar no A55 | | |
| 2 | Por testar no A55 | Por testar no A55 | | |
| 3 | Por testar no A55 | Por testar no A55 | | |

5. Recusa a permissão e confirma a mensagem; autoriza nas definições e repete.
6. Testa silêncio, parar durante a captação e sair para o Home da aplicação durante
   a captação. Confirma que o indicador do microfone se apaga e é possível repetir.
   Testa também abrir/fechar uma interface temporária Android e passar para segundo
   plano: o `AppState` sozinho já não provoca `abort()`. A sessão continua limitada
   pelos eventos do serviço e pelos timeouts (15 s para iniciar/finalizar, 60 s de
   escuta). Esta experiência não implementa deteção de abandono real da aplicação.
7. Confirma no Home que criar/editar tarefas e navegar na timeline continuam a
   funcionar. Nenhum desses componentes foi alterado por esta experiência.

Para comparar com o sistema, opcionalmente:

```bash
adb shell settings get secure voice_recognition_service
adb shell dumpsys package queries
```

## Validação local e limites

Os testes do controlador usam um serviço simulado: verificam consultas, separação
de idiomas/modelos, permissão, opções de início, estados, cancelamento e limpeza.
Não constituem resultados de transcrição real.

Resultados desta implementação:

- 14 testes específicos do diagnóstico: passaram, incluindo transições temporárias
  de AppState durante a permissão/escuta e distinção entre erros e cancelamentos.
- `npx tsc --noEmit`: passou.
- Introspeção Expo: passou; confirmou `RECORD_AUDIO`, os pacotes configurados e
  o intent `android.speech.RecognitionService` no manifesto gerado.
- Exportações Android de produção e de desenvolvimento pelo Metro: passaram.
  São validações de bundle JavaScript, não uma compilação de APK.
- Auditoria estática da interface: sem findings.
- A suite geral tem 12 falhas em `taskDetailsInline`, `taskSheetTransition` e
  `uiConsistency`. As mesmas 12 falhas foram reproduzidas numa cópia limpa do
  `HEAD`, com os mesmos testes e dependências: incluem expectativas desatualizadas
  de pickers/geometria, `Image` ausente no harness do drawer e um `EPERM` ao criar
  um subprocesso na sandbox. A execução fora da sandbox não foi autorizada.
  Esses testes e os componentes de tarefas foram preservados.

```bash
node --test --test-isolation=none --test-reporter=spec tests/speechRecognitionDiagnostic.test.mjs
npx tsc --noEmit
npx expo config --type introspect --json
npx expo export --platform android --output-dir /tmp/tdahapp-speech-export
```

Só o A55 permite confirmar o serviço efetivamente disponível, a sua capacidade de
consultar idiomas, a aceitação real de `pt-PT`/`pt-BR`, a precisão das seis
transcrições, permissões e ciclo de vida na instalação do dispositivo. Na validação
inicial só foram gerados bundles; a investigação nativa de permissões abaixo
verifica separadamente o manifesto e o APK.

## Investigação de cancelamento por AppState

A mensagem “O teste foi cancelado porque a aplicação passou para segundo plano”
era gerada pelo nosso próprio listener: qualquer `change → background` chamava
`cancel()`, mesmo durante `requestMicrophonePermissionsAsync()`. Nessa fase,
invalidava a tentativa antes da resposta da permissão. Depois do início nativo,
chamava `abort()` e destruía a sessão. O React Native Android emite `background`
em `onHostPause`, inclusive perante Activities temporárias; os eventos de janela
`blur`/`focus` são distintos. Ver
[AppState](https://reactnative.dev/docs/appstate).

O listener passou a observar, sem cancelar. A permissão continua obrigatória antes
do início. Uma recusa/erro de permissão não chama `abort()` sem sessão nativa.
Sair da rota continua a remover todos os listeners e abortar uma sessão ativa.
Os timeouts continuam em vigor. Um erro `aborted` emitido após um cancelamento
da aplicação não substitui a causa já apresentada.

Não está confirmado que “Connection to speech recognition service lost” tenha
a mesma causa. O Android também pode emitir esse aviso ao desligar um serviço
sem listener de transcrição ativo, incluindo ligações usadas para consultar suporte.
A frase isolada não identifica a tentativa nem demonstra uma falha de microfone;
é preciso comparar a cronologia. Ver
[RemoteSpeechRecognitionService no AOSP](https://android.googlesource.com/platform/frameworks/base/+/e0e9d4ef4951deff6d22a0ed2f3c737ea3db38fd/services/core/java/com/android/server/speech/RemoteSpeechRecognitionService.java).

### Recolher os novos registos

Estas alterações são apenas JavaScript; **não exigem nova compilação nativa**
se o A55 já tem a build com `expo-speech-recognition@58.0.1` e as permissões nativas
corretas. Isto aplica-se à correção de AppState; a correção de manifesto descrita
abaixo **exige recompilar e reinstalar**. Liga ao Metro e faz
Reload da aplicação para carregar o código e remover os listeners antigos.

Abre o React Native DevTools (tecla `j` no terminal do Metro) e filtra a consola
por `[SpeechDiagnostic]`. Cada registo tem `timestamp`, `session`, `sequence`,
`attempt`, `appState`, `windowFocused`, `permissionPending`, estado e motivo do
último abort da aplicação. Não se registam áudio, URIs ou texto das transcrições.

| Evento | Significado |
| --- | --- |
| `appstate.initial/change/blur/focus` | Estado/foco observado; `action: observe-only` |
| `permission.request/result/denied/error` | Pedido, resposta e falhas do microfone |
| `command.start/stop/cancel/abort` | Ação da aplicação; inclui motivo do cancelamento |
| `recognition.start/audiostart/speechstart/speechend/audioend/result/end` | Eventos do serviço; resultados apenas com metadados |
| `recognition.error` | Erro, mensagem e `nativeCode`, com contexto `abortReason` |
| `diagnostics.services/locales.*` | Consulta de serviços/idiomas, separada da transcrição |
| `lifecycle.dispose` / `timeout` | Saída da rota ou limite de espera |

Para recolher os avisos nativos em paralelo, noutro terminal:

```bash
adb logcat -v threadtime ReactNativeJS:V ExpoSpeechService:V ESRModule:V RemoteSpeechRecognitionService:V SpeechRecognizer:V '*:S'
```

Usa o DevTools como fonte dos registos JavaScript; a presença de `console.info`
no logcat depende da build. Regista uma tentativa `pt-PT` com permissão concedida
e outra com o pedido de permissão visível. Repete `pt-BR`. A sequência esperada
é `permission.result(granted)` → `command.start` → eventos `recognition.*`.
Eventos `appstate.*` intercalados não devem originar `command.abort`. Se houver
erro, conserva a sequência completa desde o pedido até `recognition.end`, com
o aviso nativo e os respetivos horários. Um `command.abort` identifica explicitamente
se a aplicação cancelou por timeout, saída da rota ou cancelamento explícito.

## Investigação de `not-allowed` e Microfone ausente nas autorizações

Foi confirmada uma diferença entre a configuração declarada e a build nativa local:

- `app.json` já tinha o config plugin `expo-speech-recognition` configurado.
- O plugin instalado adiciona `android.permission.RECORD_AUDIO` ao manifesto
  durante o prebuild. A propriedade `microphonePermission` personaliza a mensagem
  iOS; no Android, a declaração é feita pelo próprio plugin.
- Antes desta correção, `android/app/src/main/AndroidManifest.xml`, o manifesto
  combinado de debug e o APK local `android/app/build/outputs/apk/debug/app-debug.apk`
  não declaravam `RECORD_AUDIO`. O módulo de voz já constava da build, mas o seu
  manifesto de biblioteca é vazio: autolinking não substitui a execução do plugin.
- A introspeção do Expo incluía a permissão; isso verificava o resultado esperado
  dos plugins, sem atualizar a pasta `android/` ou o APK existente.
- `requestMicrophonePermissionsAsync()` já era chamado antes de `start()`, e a
  captação só avança quando `granted === true`. A implementação Android dessa API
  pede precisamente `RECORD_AUDIO`. Não foi necessário alterar esse pedido.

A pasta nativa estava desatualizada relativamente ao plugin. Este defeito explica
por que uma build feita a partir dela não disponibiliza a autorização de Microfone.
Foi também consultado por ADB o Samsung A55 ligado (SM-A556B): o pacote instalado
`com.anonymous.mytime` não tinha `RECORD_AUDIO` em `requested permissions` e a lista
de permissões de runtime do utilizador 0 estava vazia. A ausência da declaração
foi assim confirmada no dispositivo, além do manifesto e APK locais anteriores.

Foi aplicado prebuild com `--no-clean --no-install`, mantendo as dependências.
`app.json` passou também a declarar explicitamente `android.permissions` com
`android.permission.RECORD_AUDIO` e `android.package: com.anonymous.mytime`, igual
ao `applicationId` nativo anterior. O manifesto local passou a incluir a permissão
e as consultas de serviços do plugin. Recursos visuais regenerados pelo prebuild
foram repostos para manter a alteração limitada à configuração de voz.
`android/` continua ignorado pelo Git; a configuração reproduzível é `app.json`.

Validação desta correção: prebuild concluído; `RECORD_AUDIO` confirmado na
introspeção e no manifesto combinado pelo Gradle, sem `maxSdkVersion`;
`:app:assembleDebug --offline --no-daemon` concluído com sucesso, com
`ANDROID_HOME=/home/pedro/Android/Sdk`; `aapt dump permissions` confirmou a
permissão dentro do APK final. Os 14 testes do diagnóstico passaram. Não foi
instalado o APK nem concedida qualquer permissão no A55 durante esta investigação.

### Validar no A55

É necessária uma nova compilação nativa e a instalação do APK corrigido. Reload,
limpeza da cache do Metro ou alteração apenas do JavaScript não atualizam permissões
do pacote Android. Ver [permissões no Expo](https://docs.expo.dev/guides/permissions/).

Com o A55 ligado por USB e autorizado:

O APK corrigido já foi gerado localmente. Para o instalar sem repetir a compilação:

```bash
cd /home/pedro/Projetos/TDAHapp/my-time
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
npx expo start --localhost
```

Abre manualmente a aplicação instalada. Em alternativa, para regenerar, compilar
e instalar a partir da configuração:

```bash
cd /home/pedro/Projetos/TDAHapp/my-time
export ANDROID_HOME=/home/pedro/Android/Sdk
adb devices
npx expo prebuild --platform android --no-clean --no-install --skip-dependency-update react,react-native
npx expo run:android --device
```

Seleciona o A55. O comando compila e instala a versão debug atualizada, preservando
o identificador `com.anonymous.mytime`. Não é necessário desinstalar nem limpar os
dados da aplicação.

Antes ou depois de iniciar o teste, confirma o pacote instalado:

```bash
adb shell dumpsys package com.anonymous.mytime | rg -n 'RECORD_AUDIO|requested permissions|runtime permissions'
```

Deve constar `android.permission.RECORD_AUDIO` nas permissões pedidas. Antes da
autorização, `granted=false` é normal. Abre o diagnóstico e toca em **Iniciar
gravação**. Aceita o pedido de Microfone; se já foi recusado definitivamente,
autoriza em Definições → Aplicações → my-time → Autorizações → Microfone.
Agora essa autorização deve estar disponível. Confirma nos logs
`permission.result` com `granted: true`, seguido de `command.start`, e volta a
testar `pt-PT` e `pt-BR`. Depois da autorização, o `dumpsys` deve indicar
`granted=true` para o utilizador Android atual.

Se o Microfone continuar ausente, confirma que foi atualizado esse mesmo pacote
e que não foi aberta outra instalação ou o Expo Go. Se a permissão estiver
concedida mas persistir `not-allowed`, conserva `recognition.error` com o código
nativo: será uma falha adicional do serviço, distinta da declaração de permissão.
