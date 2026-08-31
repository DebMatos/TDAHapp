my-time-app/
├── src/
│   ├── assets/           # Onde vais guardar o teu avatar (gatinho.png), fontes, etc.
│   ├── components/       # Componentes reutilizáveis
│   │   ├── Header.js     # Barra superior fixa
│   │   ├── TimeBar.js    # A tua barra multicolorida de 24h
│   │   ├── Accordion.js  # Blocos colapsáveis (Parte 1-6)
│   │   └── TaskRow.js    # Linhas de tarefas dentro do bloco
│   ├── screens/
│   │   └── HomeScreen.js # Ecrã principal que junta tudo
│   ├── utils/
│   │   └── timeUtils.js  # Funções para calcular a posição do avatar na barra
│   └── App.js            # O ponto de entrada principal
└── package.json
