# 🎯 Checklist CFTV - Claro Regional Sul

Aplicação web para checklist de sites de câmeras CFTV da Claro, focada em agilizar rondas manuais de ~300 sites na região Sul (PR, SC, RS).

## ✅ Funcionalidades

### 📊 Dashboard Analítico
- **4 KPI Cards** — Disponibilidade geral (%), Sites online, Sites críticos, Câmeras OK, com indicadores de tendência
- **4 Cards de Resumo Regional** — PR, SC, RS e Geral com barras de progresso de alarmes e CFTV
- **4 Gráficos interativos (Chart.js)**:
  - Status de alarmes por regional (barras empilhadas)
  - Status de câmeras por regional (barras agrupadas)
  - Top 10 sites com mais problemas (barras horizontais)
  - Distribuição de tipos de problemas (rosca/doughnut)
- **Tabela de Problemas Ativos** — Paginação, ordenação por coluna, filtros por regional e tipo, busca por SIGLA
- **Timeline de Atividades** — Feed de últimas ações com tempo relativo ("há 2 horas")

### 🔍 Busca Global (Omnisearch)
- Campo de busca no header com atalho **Ctrl+K**
- Busca em tempo real em sites, regionais e ações do sistema
- Navegação por teclado (↑↓ + Enter) nos resultados
- Resultados agrupados por categoria (Sites, Regionais, Ações)

### 📄 Relatórios
- **Tela dedicada de Relatórios** (atalho `R`)
- **Disponibilidade** — Métricas por regional com gráfico de barras diárias
- **SLA** — Meta configurável, status por regional (✅/⚠️/❌)
- **Rondas** — Ranking de operadores, histórico de rondas recentes
- **Auditoria** — Log completo de alterações
- **Exportação** — Excel multi-abas e CSV

### 📥 Importador com Drag-and-Drop
- **Modal completo** com zona de arrastar-e-soltar
- **Preview** dos dados antes de importar (20 primeiros sites)
- **Estratégias** de importação: Mesclar, Apenas Novos, Sobrescrever
- **Barra de progresso** durante importação
- **Relatório pós-importação**: X novos, Y atualizados, Z ignorados

### 📋 Audit Log & Backup
- **Registro automático** de todas as ações: login, logout, marcações, importações
- **Exportar CSV** do histórico de auditoria
- **Backup completo** — Exporta JSON com banco de dados + configurações + audit log
- **Restaurar backup** — Importa e valida arquivo JSON antes de restaurar

### ⌨️ Atalhos de Teclado
| Atalho | Ação |
|--------|------|
| `Ctrl+K` | Abrir busca global |
| `N` | Iniciar nova ronda |
| `D` | Ir para Dashboard |
| `R` | Abrir Relatórios |
| `S` | Abrir Configurações |
| `Esc` | Fechar modal / voltar |
| `?` | Mostrar todos os atalhos |

### ⚙️ Configurações
- **Meta de SLA** configurável (padrão: 99.5%)
- **Modo escuro/claro** com persistência
- **Backup e Restore** direto das configurações
- **Webhooks** (stub, em breve)

### Funcionalidades Existentes Mantidas
- **Login de operador** — Identifica quem fez cada ronda
- **Dados demo automáticos** — 235 sites (PR: 86, SC: 83, RS: 66) ao primeiro login
- **Importação de XLSX** — Detecta regional automaticamente pelo nome do arquivo/aba
- **Modo Ronda rápida** — Interface focada: um site por vez com atalhos de teclado
  - `Espaço` / `Enter` = OK · `P` = Parcial · `O` = Offline · `S` = Pular
- **Marcação rápida** — Botões ✅ ⚠️ ❌ diretamente nos cards
- **Exportar Excel (multi-abas)** — PR, SC, RS, Consolidado e Resumo
- **Exportar PDF** — Relatório imprimível
- **Sincronização multi-usuário** — Exportar/importar JSON
- **Tema claro/escuro** — Toggle ☀️/🌙 persistente

## 🚀 Como Usar

1. Abra `index.html` no Chrome, Edge ou Firefox (versão 90+)
2. Digite seu nome e clique **Entrar**
   - 235 sites demo serão carregados automaticamente (PR: 86, SC: 83, RS: 66)
3. Para importar dados reais:
   - Clique **📥 Importar HTML** para planilhas HTML das regionais (drag-and-drop)
   - Clique **📥 Importar XLSX** para planilhas Excel/CSV
4. Explore o dashboard: KPIs, cards de resumo, gráficos e tabela de problemas ativos
5. Use os botões de exportação: **📊 Exportar Excel**, **📄 Exportar PDF** ou **📋 Copiar Resumo**
6. Clique **🚀 Iniciar Ronda** ou pressione `N` para começar a verificação
7. Acesse **Relatórios** (`R`) para análises detalhadas e exportações
8. Acesse **Configurações** (`S`) para ajustar SLA, temas e backups

## 🔄 Sincronização entre Operadores

1. **Operador A** faz a ronda e clica **📤 Exportar Sync**
2. Envia o arquivo JSON para o **Operador B** (WhatsApp, e-mail, etc.)
3. **Operador B** clica **📥 Importar Sync** e seleciona o arquivo
4. As rondas são mescladas automaticamente (ronda mais recente prevalece)

## 📥 Como Importar Dados das Regionais

### Formato HTML (com drag-and-drop)

1. Clique **📥 Importar HTML** na barra de ferramentas
2. Arraste os arquivos `SC.html`, `RS.html` para a zona de drop, ou clique para selecionar
3. Revise o preview dos dados (20 primeiros sites)
4. Escolha a estratégia: **Mesclar** (recomendado), **Apenas Novos** ou **Sobrescrever**
5. Clique **Importar** e aguarde a barra de progresso
6. Veja o relatório: X novos, Y atualizados, Z ignorados

A regional é detectada automaticamente pelo nome do arquivo (ex: `SC.html` → SC, `RS.html` → RS).

### Formato XLSX

A planilha deve conter pelo menos uma coluna de **SIGLA**. As demais colunas reconhecidas automaticamente:

| Coluna | Descrição |
|---|---|
| CONTA | ID numérico do site |
| SIGLA | Identificação (ex: PRFOZ1E) |
| STATUS / ALARME | ONLINE / DESCONECTADO / NÃO POSSUI |
| DATA | Timestamp de desconexão |
| O.S | Ordem de serviço aberta |
| ZONA | Número da zona com problema |
| PADRÃO DE CÂMERAS | Quantidade esperada |
| ONTEM | Câmeras funcionando ontem |
| HOJE | Câmeras funcionando hoje |
| STATUS2 / STATUS CFTV | OK / PARCIAL / DESCONECTADO |
| VEGETAÇÃO ALTA | TRUE / FALSE |
| REGIONAL / ESTADO / UF | PR / SC / RS (auto-detectado se não presente) |
| OBSERVAÇÃO / OBS | Observações sobre o site |

### Estrutura esperada das planilhas HTML exportadas

Os arquivos HTML podem ter:

1. **Cabeçalhos nomeados** — Linha de cabeçalho com nomes reconhecíveis (CONTA, SIGLA, STATUS, etc.)

2. **Formato posicional fixo** — Sem cabeçalhos; o sistema detecta SIGLA na coluna 3 e aplica mapeamento fixo:

| Col | Campo |
|-----|-------|
| B | CONTA |
| C | SIGLA |
| D | STATUS alarme |
| E | DATA desconexão |
| F | O.S. |
| G | ZONA |
| H | STATUS4 |
| I | PADRÃO CÂMERAS |
| J | ONTEM |
| K | HOJE |
| L | STATUS CFTV |
| M | DATA ALTERAÇÃO |
| N | VEGETAÇÃO ALTA |
| O–AC | Câmeras individuais (⬛ escura, 🔶 obstruída, 📶 sem sinal, ❌ offline) |
| AD | OBSERVAÇÃO |

#### Usando `parseRegionalHTML` programaticamente

```javascript
// Obter sites como objetos sem gravar no banco de dados
const sites = parseRegionalHTML(htmlString, 'PR');
console.log(sites.length, 'sites encontrados');

sites.forEach(s => {
  console.log(s.sigla, s.status_conexao, s.status2, s.observacao);
});

// A regional é opcional (auto-detectada se omitida)
const sitesAutoDetect = parseRegionalHTML(htmlString);

// Para importar direto no banco:
const result = importFromHTML(htmlString, 'SC');
console.log(`${result.imported} novos, ${result.updated} atualizados`);
```

## 💻 Tecnologias

- **[sql.js](https://github.com/sql-js/sql.js)** v1.10.3 — SQLite no navegador
- **[SheetJS](https://sheetjs.com/)** v0.18.5 — Leitura e escrita de XLSX
- **[Chart.js](https://www.chartjs.org/)** v4.4.0 — Gráficos interativos
- **[Inter](https://fonts.google.com/specimen/Inter)** — Tipografia (Google Fonts)
- HTML + CSS + JavaScript puro (sem framework, sem servidor)

## 📁 Estrutura de Arquivos

```
/
├── index.html          # Interface principal
├── css/
│   ├── styles.css      # Design base (dark/light theme)
│   ├── dashboard.css   # Estilos do dashboard
│   └── features.css    # KPIs, Timeline, Omnisearch, Modais, Relatórios
├── js/
│   ├── app.js          # Controlador principal + Settings + Keyboard shortcuts
│   ├── database.js     # Wrapper SQLite (sql.js)
│   ├── xlsx-import.js  # Importação de planilhas XLSX
│   ├── dataImporter.js # Importação HTML com modal drag-and-drop + dados demo
│   ├── dashboard.js    # Cards regionais, gráficos e tabela de problemas
│   ├── exporter.js     # Exportação Excel/PDF/Clipboard
│   ├── ronda.js        # Modo ronda
│   ├── sync.js         # Exportar/importar JSON multi-usuário
│   ├── kpi.js          # KPI cards + Timeline de atividades
│   ├── auditlog.js     # Audit log + Backup/Restore
│   ├── omnisearch.js   # Busca global (Ctrl+K)
│   └── reports.js      # Tela de Relatórios (Disponibilidade/SLA/Rondas/Auditoria)
└── README.md
```
