# Validar avisos locais no Android

Instala uma nova build nativa do MyTime num dispositivo físico. Se a pasta
`android/` já existir localmente, atualiza a configuração nativa para aplicar
o plugin antes de compilar. Usa `npx expo prebuild --platform android` e
`npx expo run:android --device` num checkout de teste.

1. Inicia sessão e abre **Menu → Notificações**. Confirma a preferência inicial
   de 15 minutos. Autoriza os avisos e confirma o canal **Avisos de tarefas**.
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

O teste de aplicação encerrada refere-se a remover a aplicação dos recentes.
Testa separadamente **Forçar paragem**, modo de poupança e restrições do fabricante.
O Android pode impedir alarmes ou execução em segundo plano nestas condições.
O serviço mantém os 60 avisos elegíveis mais próximos e volta a reconciliar ao
entrar na aplicação, ao receber um aviso em primeiro plano ou ao mudar tarefas
e preferências. O executor em segundo plano é registado para Android.
