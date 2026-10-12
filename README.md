# RSOFT — Simulador de Dosagem (Rev01)

Aplicação web 100% cliente para simular ciclos de dosagem com bombas helicoidais
Netzsch NEMO acionadas por inversor Yaskawa GA800. Dois modos: ciclo por tempo
(com hidráulica) e dosagem por lógica de CLP (contagem de pulsos). Sem backend:
simulação determinística em TypeScript puro rodando em Web Worker, persistência
local em IndexedDB e exportação em Excel no navegador.

> Mais que código. Soluções para o seu futuro.

## Requisitos

- Node.js 22+

## Executar localmente

```bash
npm install
npm run catalog:generate   # gera src/data/catalog.json (versionado + hash)
npm run dev
```

Abra `http://localhost:5173`.

## Qualidade e build

```bash
npm run verify   # lint + typecheck + catalog:verify + testes + build
```

Scripts individuais:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run catalog:verify`
- `npm run build`

## Pressão discreta por bomba

A pressão **não** é um valor contínuo. Cada bomba publica uma lista de pressões
que existem nas curvas do fabricante (ex.: "0-2 bar", "4 bar", "6 bar") e o
usuário só pode escolher entre elas. Isso elimina interpolação/extrapolação
entre pressões. No Modo 1, a pressão calculada pela linha hidráulica
(Darcy-Weisbach) é encaixada na pressão publicada mais próxima
(`snapToPublishedPressure`), de modo que o motor sempre consulta uma curva que
existe no catálogo.

## Catálogo híbrido

O catálogo é um artefato JSON versionado, gerado offline a partir das curvas
reais do PDF Netzsch `NDB 106-06`. As curvas (vazão × RPM e potência × RPM, por
pressão) são **digitalizadas por detecção de pixel** sobre as páginas renderizadas
(`scripts/extract_curves.py`, usando pymupdf + numpy, com calibração automática
pelos rótulos de texto dos eixos). O resultado (`scripts/data/raw-curves.json`)
é combinado com a tabela de motor/motoredutor das páginas 10/14/22
(`scripts/data/motor-table.ts`) e ajustado a `valor = a·rpm + b` por
`npm run catalog:generate`, que grava `src/data/catalog.json` com:

- os pontos digitalizados (fonte auditável);
- os coeficientes da função ajustada e as métricas (R², RMSE);
- as pressões discretas reais de cada bomba;
- as opções de motor + motoredutor (NS) de cada bomba.

O conteúdo é protegido por hash verificado por `npm run catalog:verify`. Pontos
de controle para validação humana ficam em `scripts/data/catalog-control-points.md`.

> As curvas foram digitalizadas automaticamente; os pontos de controle devem ser
> conferidos contra o PDF antes de uso de engenharia. Algumas páginas de layout
> atípico ficam marcadas como `needsReview` no extrator.

## Motoredutor e relação de transformação (gearRatio)

Cada bomba publica suas opções de motor (kW) e motoredutor (ex.: `NS 27`),
transcritas das tabelas do PDF. A **relação de redução** de cada motoredutor NS
não é publicada pela Netzsch por código, então ela é **informada pelo usuário**
na interface (campo "relação de transformação", marcado "a validar"). O cálculo
da velocidade final usa esse valor: `pumpRpm = motorRpm / gearRatio`. As séries
com mancal (SY/SP) usam acionamento externo (polia/correia).

## Modelo de cálculo

```text
pulseHz   = outputHz × 2.4
motorRpm  = pulseHz × 12.5
pumpRpm   = motorRpm / gearRatio      (gearRatio informado pelo usuário)
K [p/kg]  = pulseHz × 3600 / (Q[m³/h] × ρ[kg/m³])
massKg    = volumeL × ρ / 1000
```

Consultas de vazão/potência fora da faixa publicada de RPM são bloqueadas com
erro explícito (`OutOfCurveRange`) — sem clamp nem extrapolação silenciosa.

## Arquitetura

- Domínio puro e determinístico em `src/domain` (sem dependência de UI/HTTP).
- Web Worker com passo fixo em `src/worker` emitindo snapshots decimados.
- Persistência via porta `SimulationRepository` (`src/infra`) com adapter
  IndexedDB (Dexie). Um adapter Supabase pode ser adicionado sem tocar no
  domínio/UI.
- UI React em `src/ui`, gráficos uPlot, exportação ExcelJS em `src/export`.

## Produção e deploy (GitHub Pages, gratuito)

A aplicação é estática (sem backend); o catálogo é empacotado no build. O deploy
é feito no **GitHub Pages** via **GitHub Actions** (plano gratuito, sem cold
start). Não são necessários secrets: o workflow usa o `GITHUB_TOKEN` automático.

- CI (`.github/workflows/ci.yml`): roda `npm run verify` (lint + typecheck +
  verificação do catálogo + testes + build) em cada push/PR.
- Deploy (`.github/workflows/deploy.yml`): em cada push para `main`, builda com
  `VITE_BASE=/<nome-do-repo>/` e publica `dist` no GitHub Pages.
- Docker é mantido apenas para paridade local (nginx servindo `dist`):
  `docker compose up --build` e acesse `http://localhost:8080`.

### Passos para publicar (uma vez)

O repositório ainda não tem remoto. Faça:

1. Crie um repositório **vazio** no GitHub (sem README/licença), por exemplo
   `simula-aplicacao`.
2. No projeto, faça o primeiro commit e aponte o remoto:
   ```bash
   git add -A
   git commit -m "RSOFT Rev01.2"
   git branch -M main
   git remote add origin https://github.com/<seu-usuario>/<repo>.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
4. O push dispara o workflow de deploy. A aplicação ficará em
   `https://<seu-usuario>.github.io/<repo>/`.

O `base` dos assets é derivado automaticamente do nome do repositório no
workflow (`VITE_BASE=/<repo>/`), então funciona para qualquer nome escolhido.
Para rodar localmente ou servir na raiz (nginx), o `base` padrão é `/`.

## Limitações conhecidas

- É uma simulação; não lê nem controla GA800/CLP físico.
- Curvas Netzsch referenciadas a água; fluidos viscosos geram resultado
  indicativo.
- Histórico restrito ao navegador até ativar um adapter de banco.
- A lógica PLC é simulada; o Structured Text equivalente requer validação no
  CLP real.
