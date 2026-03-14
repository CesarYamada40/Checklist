# 🎯 Checklist CFTV - Claro Regional Sul

Aplicação web para checklist de sites de câmeras CFTV da Claro, focada em agilizar rondas manuais de ~300 sites na região Sul (PR, SC, RS).

## ✅ Funcionalidades

- **Login de operador** — Identifica quem fez cada ronda
- **Importação de XLSX** — Carrega a planilha de sites automaticamente, detectando a regional (PR/SC/RS) pelo nome da aba ou do arquivo
- **Dashboard em tempo real** — Total de sites, OK / Parcial / Offline / Não Verificado, gráfico de pizza e sites críticos
- **Métricas de Alarmes & CFTV** — Alarmes conectados/desconectados, CFTV OK/desconectado, Vegetação Alta direto no painel
- **Resumo por Regional** — Cards com estatísticas individuais de PR, SC e RS (alarmes + CFTV + vegetação)
- **Gráfico comparativo regional** — Barras mostrando alarmes e CFTV por regional lado a lado
- **Filtros por regional** — Botões PR / SC / RS para exibir apenas sites de uma regional
- **Filtro de vegetação** — Filtrar sites com vegetação alta
- **Tema claro/escuro** — Toggle ☀️/🌙 com persistência em LocalStorage
- **Modo Ronda rápida** — Interface focada: um site por vez com botões grandes e atalhos de teclado
  - `Espaço` / `Enter` = OK · `P` = Parcial · `O` = Offline · `S` = Pular
  - Modal para registrar câmeras parciais e observação
- **Marcação rápida** — Botões ✅ ⚠️ ❌ diretamente nos cards da lista
- **Badge regional** — Cada card de site exibe a regional (PR/SC/RS) com cores distintas
- **Busca e filtros** — Por sigla, conta ou status (OK / Parcial / Offline / Não Verificado / Com O.S. / Vegetação)
- **Detalhes do site** — Histórico das últimas 10 rondas, observações e regional do site
- **Sincronização multi-usuário** — Exportar/importar JSON para compartilhar rondas via WhatsApp ou e-mail
- **Exportar relatório** — JSON da ronda finalizada com resumo e sites com problemas
- **Exportar XLSX** — Planilha atualizada com dados da última ronda (inclui coluna REGIONAL e OBSERVAÇÃO)
- **Backup automático** — LocalStorage a cada 5 minutos + backup de DB SQLite

## 🚀 Como Usar

1. Abra `index.html` no Chrome, Edge ou Firefox (versão 90+)
2. Digite seu nome e clique **Entrar**
3. Clique **📥 Importar XLSX** e selecione a planilha de checklist
   - O sistema detecta automaticamente a regional pelo nome da aba (ex: "PR", "SC", "RS") ou pelo nome do arquivo
4. Clique **🚀 Iniciar Ronda** para começar a verificação
5. Use os botões ou atalhos de teclado para marcar cada site
6. Ao finalizar, clique **📤 Exportar Relatório** e compartilhe com a equipe

## 🔄 Sincronização entre Operadores

1. **Operador A** faz a ronda e clica **📤 Exportar Sync**
2. Envia o arquivo JSON para o **Operador B** (WhatsApp, e-mail, etc.)
3. **Operador B** clica **📥 Importar Sync** e seleciona o arquivo
4. As rondas são mescladas automaticamente (ronda mais recente prevalece)

## 🗃️ Estrutura da Planilha XLSX

A planilha deve conter pelo menos uma coluna de **SIGLA**. As demais colunas reconhecidas automaticamente:

| Coluna | Descrição |
|---|---|
| CONTA | ID numérico do site |
| SIGLA | Identificação (ex: PRFOZ1E) |
| STATUS / ALARME | ONLINE / DESCONECTADO / NÃO POSSUI |
| DATA | Timestamp de desconexão |
| O.S | Ordem de serviço aberta |
| ZONA | Número da zona com problema |
| STATUS4 | ABERTA / ANULADA |
| PADRÃO DE CÂMERAS | Quantidade esperada |
| ONTEM | Câmeras funcionando ontem |
| HOJE | Câmeras funcionando hoje |
| STATUS2 / STATUS CFTV | OK / PARCIAL / DESCONECTADO |
| VEGETAÇÃO ALTA | TRUE / FALSE |
| REGIONAL / ESTADO / UF | PR / SC / RS (auto-detectado se não presente) |
| OBSERVAÇÃO / OBS | Observações sobre o site |

> **Dica de detecção de regional:** Se a aba da planilha ou o nome do arquivo contiver "PR", "Paraná", "SC", "Santa Catarina", "RS" ou "Rio Grande", a regional é atribuída automaticamente a todos os sites daquela aba.

## 💻 Tecnologias

- **[sql.js](https://github.com/sql-js/sql.js)** v1.10.3 — SQLite no navegador
- **[SheetJS](https://sheetjs.com/)** v0.18.5 — Leitura e escrita de XLSX
- **[Chart.js](https://www.chartjs.org/)** v4.4.0 — Gráficos (pizza + barras)
- HTML + CSS + JavaScript puro (sem framework, sem servidor)

## 📁 Estrutura de Arquivos

```
/
├── index.html          # Interface principal
├── css/
│   └── styles.css      # Design (dark/light theme)
├── js/
│   ├── app.js          # Controlador principal
│   ├── database.js     # Wrapper SQLite (sql.js)
│   ├── xlsx-import.js  # Importação de planilhas
│   ├── ronda.js        # Modo ronda
│   └── sync.js         # Exportar/importar JSON
└── README.md
```
