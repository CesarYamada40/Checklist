# 🎯 Checklist CFTV - Claro Regional Sul

Aplicação web para checklist de sites de câmeras CFTV da Claro, focada em agilizar rondas manuais de ~300 sites na região Sul (PR, SC, RS).

## ✅ Funcionalidades

- **Login de operador** — Identifica quem fez cada ronda
- **Dados demo automáticos** — Ao primeiro login, 235 sites das 3 regionais (PR, SC, RS) são carregados automaticamente para demonstração
- **Importação de XLSX** — Carrega a planilha de sites automaticamente, detectando a regional (PR/SC/RS) pelo nome da aba ou do arquivo
- **Importação de HTML** — Importa diretamente as planilhas HTML exportadas das regionais (PR.html, SC.html, RS.html)
- **Dashboard aprimorado** — Cards de resumo por regional no topo, métricas em tempo real e gráficos interativos
- **4 Cards de Resumo** — PR, SC, RS e Geral com barras de progresso de alarmes e CFTV
- **4 Gráficos interativos (Chart.js)**:
  - Status de alarmes por regional (barras empilhadas)
  - Status de câmeras por regional (barras agrupadas)
  - Top 10 sites com mais problemas (barras horizontais)
  - Distribuição de tipos de problemas (rosca/doughnut)
- **Tabela de Problemas Ativos** — Paginação (10/página), ordenação por coluna, filtros por regional e tipo de problema, busca por SIGLA
- **Exportar Excel (multi-abas)** — Gera arquivo XLSX com abas: Regional PR, Regional SC, Regional RS, Consolidado e Resumo
- **Exportar PDF** — Relatório imprimível com estatísticas e tabela de problemas
- **Copiar Resumo** — Copia um resumo executivo para a área de transferência
- **Métricas de Alarmes & CFTV** — Alarmes conectados/desconectados, CFTV OK/desconectado, Vegetação Alta direto no painel
- **Resumo por Regional (sidebar)** — Cards com estatísticas individuais de PR, SC e RS
- **Gráfico comparativo regional** — Barras mostrando alarmes e CFTV por regional
- **Filtros por regional** — Botões PR / SC / RS para exibir apenas sites de uma regional
- **Tema claro/escuro** — Toggle ☀️/🌙 com persistência em LocalStorage
- **Modo Ronda rápida** — Interface focada: um site por vez com botões grandes e atalhos de teclado
  - `Espaço` / `Enter` = OK · `P` = Parcial · `O` = Offline · `S` = Pular
  - Modal para registrar câmeras parciais e observação
- **Marcação rápida** — Botões ✅ ⚠️ ❌ diretamente nos cards e na tabela de problemas
- **Busca e filtros** — Por sigla, conta ou status (OK / Parcial / Offline / Não Verificado / Com O.S. / Vegetação)
- **Detalhes do site** — Histórico das últimas 10 rondas, observações e regional
- **Sincronização multi-usuário** — Exportar/importar JSON para compartilhar rondas
- **Backup automático** — LocalStorage a cada 5 minutos + backup de DB SQLite
- **Acessibilidade** — ARIA labels, navegação por teclado, contraste WCAG AA
- **Responsivo** — Layout adaptado para mobile (320px), tablet (768px) e desktop

## 🚀 Como Usar

1. Abra `index.html` no Chrome, Edge ou Firefox (versão 90+)
2. Digite seu nome e clique **Entrar**
   - 235 sites demo serão carregados automaticamente (PR: 86, SC: 83, RS: 66)
3. Para importar dados reais:
   - Clique **📥 Importar XLSX** para planilhas Excel/CSV
   - Clique **📥 Importar HTML** para planilhas HTML das regionais
4. Explore o dashboard: cards de resumo, gráficos e tabela de problemas ativos
5. Use os botões de exportação: **📊 Exportar Excel**, **📄 Exportar PDF** ou **📋 Copiar Resumo**
6. Clique **🚀 Iniciar Ronda** para começar a verificação
7. Ao finalizar, clique **📤 Exportar Sync** e compartilhe com a equipe

## 🔄 Sincronização entre Operadores

1. **Operador A** faz a ronda e clica **📤 Exportar Sync**
2. Envia o arquivo JSON para o **Operador B** (WhatsApp, e-mail, etc.)
3. **Operador B** clica **📥 Importar Sync** e seleciona o arquivo
4. As rondas são mescladas automaticamente (ronda mais recente prevalece)

## 📥 Como Importar Dados das Regionais

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

> **Dica de detecção de regional:** Se a aba da planilha ou o nome do arquivo contiver "PR", "Paraná", "SC", "Santa Catarina", "RS" ou "Rio Grande", a regional é atribuída automaticamente a todos os sites daquela aba.

### Formato HTML

Selecione os arquivos `PR.html`, `SC.html`, `RS.html` usando o botão **📥 Importar HTML**. O sistema detecta a regional automaticamente pelo nome do arquivo ou título da página.

#### Estrutura esperada das planilhas HTML exportadas

Os arquivos HTML podem ter:

1. **Cabeçalhos nomeados** (primeira forma) – A tabela tem uma linha de cabeçalho com nomes de coluna reconhecíveis:

| Col | Cabeçalho | Campo |
|-----|-----------|-------|
| B | CONTA | ID numérico do site |
| C | SIGLA | Código do site (ex: PRFOZ01) |
| D | STATUS | ONLINE / DESCONECTADO / NÃO POSSUI |
| E | DATA | Data de desconexão (DD/MM/AA ou DD/MM/AAAA) |
| F | O.S. / N TICKET | Número da ordem de serviço |
| G | ZONA | Zona afetada |
| H | STATUS 4 | Status monitoramento |
| I | PADRÃO DE CÂMERAS | Quantidade padrão de câmeras |
| J | ONTEM | Câmeras funcionando ontem |
| K | HOJE | Câmeras funcionando hoje |
| L | STATUS 2 / STATUS CFTV | OK / PARCIAL / DESCONECTADO |
| M | DATA DA ALTERAÇÃO | Data de alteração do CFTV (DD/MM/AA ou DD/MM/AAAA) |
| N | VEGETAÇÃO ALTA | VERDADEIRO / FALSO (ou TRUE / FALSE) |
| O–AC | (câmeras individuais) | ⬛ escura, 🔶 obstruída, 📶 sem sinal, ❌ offline |
| AD | O QUE HOUVE? / OBSERVAÇÃO | Observações operacionais |

2. **Formato posicional fixo** (segunda forma) – Para planilhas sem cabeçalhos reconhecíveis, o sistema detecta a SIGLA automaticamente pela posição (coluna 3) e aplica o mapeamento fixo acima.

> **Dicas:**
> - A regional é auto-detectada pelo nome do arquivo (ex: `PR.html` → PR, `SC.html` → SC)
> - Valores booleanos em português (`VERDADEIRO`/`FALSO`) são reconhecidos automaticamente
> - Datas no formato brasileiro DD/MM/AA e DD/MM/AAAA são convertidas automaticamente
> - Múltiplos arquivos podem ser importados de uma vez (segure Ctrl ao selecionar)

#### Usando `parseRegionalHTML` programaticamente

```javascript
// Obter sites como objetos sem gravar no banco de dados
const sites = parseRegionalHTML(htmlString, 'PR');
console.log(sites.length, 'sites encontrados');

sites.forEach(s => {
  console.log(s.sigla, s.status_conexao, s.status2, s.observacao);
});

// O parâmetro de regional é opcional (auto-detectado se omitido)
const sitesAutoDetect = parseRegionalHTML(htmlString);

// Para importar direto no banco:
const result = importFromHTML(htmlString, 'SC');
console.log(`${result.imported} novos, ${result.updated} atualizados`);
```

## 💻 Tecnologias

- **[sql.js](https://github.com/sql-js/sql.js)** v1.10.3 — SQLite no navegador
- **[SheetJS](https://sheetjs.com/)** v0.18.5 — Leitura e escrita de XLSX
- **[Chart.js](https://www.chartjs.org/)** v4.4.0 — Gráficos interativos
- HTML + CSS + JavaScript puro (sem framework, sem servidor)

## 📁 Estrutura de Arquivos

```
/
├── index.html          # Interface principal
├── css/
│   ├── styles.css      # Design (dark/light theme)
│   └── dashboard.css   # Estilos do dashboard aprimorado
├── js/
│   ├── app.js          # Controlador principal
│   ├── database.js     # Wrapper SQLite (sql.js)
│   ├── xlsx-import.js  # Importação de planilhas XLSX
│   ├── dataImporter.js # Importação de HTML + dados demo
│   ├── dashboard.js    # Cards, gráficos e tabela de problemas
│   ├── exporter.js     # Exportação Excel/PDF/Clipboard
│   ├── ronda.js        # Modo ronda
│   └── sync.js         # Exportar/importar JSON
└── README.md
```
