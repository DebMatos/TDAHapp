# Validar avisos locais no Android

Instala uma nova build nativa do MyTime num dispositivo físico. Se a pasta
`android/` já existir localmente, atualiza a configuração nativa para aplicar
o plugin antes de compilar. Usa `npx expo prebuild --platform android` e
`npx expo run:android --device` num checkout de teste.

1. Inicia sessão e abre **Menu → Notificações**. Confirma a preferência inicial
   de 15 minutos. Autoriza os avisos e confirma o canal **Avisos de tarefas**.
   No Android 12 ou superior, autoriza também **Alarmes e lembretes** quando a
   aplicação o pedir; numa instalação nova do Android 14 ou superior este acesso
   está desligado por defeito.
   Recusa a permissão num segundo ensaio e valida a recuperação pelas definições
   do Android.
2. Cria uma tarefa futura, testa primeiro os 15 minutos, depois muda para 5.
   Confirma um só aviso, com o título da tarefa. Desativa e reativa os avisos.
   Reabre a aplicação e confirma que ambas as preferências foram guardadas.
3. Repete com a aplicação visível, em segundo plano e removida dos recentes.
   Experimenta cada botão (+5, +15, +30), incluindo em modo avião. Confirma que
   a ação em segundo plano não abre a aplicação e que, ao voltar, a tarefa tem
   a hora original mais o intervalo escolhido, a mesma duração e o mesmo estado.
   Restabelece a ligação e confirma o horário noutro dispositivo.
4. Edita o horário e confirma que o aviso anterior é substituído. Testa concluir,
   abandonar e apagar tarefas. Testa um adiamento que cruza a meia-noite e outro
   cuja nova hora de aviso já passou.
5. Reinicia o telefone com um aviso pendente. Muda o fuso horário e volta à
   aplicação para confirmar a reconciliação com o horário local. Testa a opção
   **Alarmes e lembretes** do Android quando estiver disponível. Sem acesso
   a alarmes exatos, o Expo pode entregar o aviso com atraso.
6. Durante estes ensaios, recolhe o `adb logcat` filtrado por `Notificações`.
   Confirma, para cada tarefa, o identificador da tarefa e da notificação, a hora
   planeada, a hora de disparo, a lista reconciliada e cada operação de
   agendamento ou cancelamento. Confirma também os estados `permission` e
   `registered` do executor em segundo plano.

O teste de aplicação encerrada refere-se a remover a aplicação dos recentes, sem
usar **Forçar paragem**. Testa separadamente o ecrã bloqueado, Doze, modo de
poupança e restrições do fabricante. Uma paragem forçada impede alarmes e ações
em segundo plano até a aplicação voltar a ser aberta; alguns fabricantes também
podem adiar alarmes mesmo sem paragem forçada.
No Android, o serviço mantém todos os avisos elegíveis; a margem dos 60 avisos
mais próximos aplica-se apenas ao iOS. A reconciliação volta a correr ao entrar
na aplicação, ao receber um aviso em primeiro plano ou ao mudar tarefas e
preferências. O executor em segundo plano é registado para Android.
