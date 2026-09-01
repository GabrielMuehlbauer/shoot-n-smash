# Arquitetura

## Objetivo

Manter uma única lógica de gameplay para navegador e WebXR, com módulos pequenos
e fáceis de testar. O projeto evita dependências e abstrações que não resolvam um
problema concreto do MVP.

## Visão geral

```text
DesktopLookController ──> câmera
DesktopFireController ──> GameSession ──┬─> SlingshotSystem ──> ProjectileSystem ─┐
XRInput (futuro) ───────────────────────┤                                        │
                                        ├─> EnemySystem ──> EnemyTypes            │
                                        ├─> CollisionSystem <─────────────────────┤
                                        ├─> ImpactFeedbackSystem <────────────────┤
                                        └─> DomHUD <───────────────────────────────┘

WaveSystem -> Player / Score / Item Systems (futuros)
                                         │
                                         v
                                StateMachine e XRHud
                                         │
                                         v
                                RankingClient -> Express -> MySQL
```

## Cliente

- `RenderContext` concentra `Scene`, `PerspectiveCamera`, `WebGLRenderer`,
  luzes, névoa, resize e descarte dos recursos gráficos.
- `SnowArena` compõe a ilha, placas de gelo, pedras, montanhas e partículas de
  neve com primitivas low-poly e recursos compartilhados.
- `GameApp` controla o único `setAnimationLoop`, a composição e o ciclo de vida
  da cena, limita o delta entre frames e pausa atualizações quando a aba está
  oculta. Desde a Fase 5, ele também coordena `DesktopFireController` e `GameSession`,
  além do controle de observação desktop.
- `DesktopLookController` adapta o `PointerLockControls` oficial do Three.js,
  limita o pitch a ±85°, mantém yaw livre e não expõe qualquer operação de
  translação. A posição da câmera permanece fixa no centro da arena.
- `DesktopFireController` converte os eventos do botão esquerdo em intenções
  delegadas a `GameSession`, independente do HUD. Ele só aceita disparo enquanto a mira via
  Pointer Lock está ativa e cancela a carga quando esse estado deixa de ser
  válido. Conexão, desconexão e descarte são idempotentes.
- `GameSession` expõe `beginCharge()`, `releaseShot()` e `cancelCharge()` como
  fachada da partida. Na Fase 9, seu `update(deltaSeconds)` preserva a ordem
  estilingue → inimigo → feedbacks existentes → projéteis → resolução do contato;
  `dispose()` encerra todos os sistemas de forma idempotente.
- `SlingshotSystem` normaliza a carga de 0 a 1, calcula a velocidade, obtém a
  posição e a direção mundiais da câmera e publica mudanças por callbacks. Ele
  não conhece mouse, Pointer Lock nem elementos do DOM.
- `ProjectileSystem` recebe origem, direção e carga, calcula a velocidade inicial
  entre 10 e 24 unidades por segundo e aplica gravidade de -9,8. Cada projétil é
  uma esfera visual de raio 0,18, preserva a posição anterior para a
  colisão por segmento e tem ciclo de vida limitado. `update()` e `dispose()`
  não dependem do DOM e são idempotentes.
- `EnemyTypes` valida o catálogo dos tipos normais e seleciona uniformemente um
  descritor imutável por sessão. O gerador aleatório dessa seleção é injetável e
  separado daquele usado para o ângulo e a distância de spawn.
- `EnemySystem` é dono do único monstro de gelo, de seu tipo, visual low-poly,
  collider, resistência, spawn, aproximação e transições terminais. Ele preserva
  os centros anterior e atual por frame, calcula a fração de um possível contato
  com o jogador, publica snapshots com a identidade do tipo por callbacks e não
  conhece elementos do DOM. `reset()` conserva o tipo sorteado na construção.
- `CollisionSystem` contém matemática pura para segmento–esfera estática e para
  duas esferas móveis. O segundo teste subtrai o movimento de um volume do outro,
  soma os raios e encontra o primeiro contato em `[0, 1]`, evitando tunneling sem
  introduzir uma engine física.
- `ImpactFeedbackSystem` mantém bursts 3D curtos no ponto de impacto. A geometria
  é compartilhada, os materiais são descartados individualmente e o limite FIFO
  impede o acúmulo de efeitos.
- O HUD HTML observa `onChargeChange({ charging, ratio })`, disparos, tipo,
  resistência, impactos, eliminação e contato por callbacks. O núcleo de gameplay
  não consulta nem altera elementos do DOM. Cancelamentos e desfechos informam
  motivos semânticos, sem transformar mensagens de interface em regra de jogo.
- `GAMEPLAY_CONFIG`, em `config/gameplay-config.js`, centraliza tempos, velocidades,
  gravidade, dimensões e limites do recorte para evitar números mágicos.
- `GameSession` já coordena a ordem do encontro mínimo e incorporará vida, ondas
  e pontuação quando uma partida completa for introduzida.
- Sistemas de gameplay não dependerão diretamente do mouse ou dos controles XR.
- Os controles de câmera e de disparo são os adaptadores de entrada desktop já
  concretos. Um futuro `XRInput` produzirá as mesmas intenções de tensionar e
  disparar, sem reutilizar eventos de mouse.
- A interface convencional utilizará HTML/CSS; a interface imersiva será criada
  dentro da cena 3D.
- Um único `renderer.setAnimationLoop()` atenderá navegador e WebXR.
- A área central da arena permanece livre. O jogador estacionário usa o centro
  lógico `(0, 1,05, 0)`, ainda sem corpo ou collider visual próprios.

## Recorte executável da Fase 5

```text
Pointer Lock ativo
        │
        v
botão esquerdo ──> carga 0..1 ──> HUD HTML
        │                │
        └── soltar ──────┘
                         v
                 criação do projétil
                         │
                         v
              gravidade e ciclo de vida
                         │
                         v
             chão | 5 s | raio 40 | limite 24
                         │
                         v
                       descarte
```

O limite de 24 projéteis ativos remove o mais antigo antes de aceitar o próximo.
A remoção também ocorre quando a base da esfera toca o chão em `y = 0,18`, após
5 segundos ou ao ultrapassar raio horizontal 40. Esses limites impedem acúmulo
indefinido de objetos e recursos durante o protótipo.

Este fluxo ainda não contém inimigos, detecção de acerto em alvos, dano, ondas,
pontuação ou qualquer entrada WebXR. A colisão com o chão existe apenas para
encerrar o ciclo de vida do projétil.

## Recorte executável da Fase 6

```text
projétil: posição anterior ─────────────> posição atual
                    │
                    v
          CollisionSystem segmento–esfera
                    │ acerto
                    v
          TargetSystem.applyDamage(25)
                    │
                    ├──> HUD 100 → 75 → 50 → 25 → 0
                    └──> consumo do projétil
```

O alvo estático tem raio 1,25 e ocupa `(4, 2,15, -11)`. Quando a vida chega a
zero, o collider deixa de aceitar dano e o visual assume estado destruído. Não
há respawn, pontuação, ataque ao jogador ou progressão de onda nesta fase.

## Recorte executável da Fase 7

```text
alvo anterior ────────────────> alvo atual (patrulha senoidal)
       ▲                              ▲
       │                              │
projétil anterior ───────────> projétil atual
                    │
                    v
        CollisionSystem: movimento relativo
                    │ primeiro contato em t
                    v
      dano + burst branco + consumo do projétil
                    │ impacto fatal
                    v
        alvo congelado na posição interpolada em t
```

O alvo percorre horizontalmente `-4,5 ≤ x ≤ 4,5` com velocidade linear de
referência 1,6 e rotação visual de 0,85 rad/s. A posição vem do tempo total da
sessão, portanto não acumula erro pela subdivisão dos frames. O teste de colisão
interpola os dois centros no mesmo instante normalizado; no quarto impacto, o
alvo é reposicionado nessa fração antes de permanecer destruído.

Cada impacto cria um icosaedro wireframe branco no centro do projétil. O efeito
expande, gira e desaparece em 0,32 segundo. No máximo 12 bursts coexistem, com
remoção do mais antigo e descarte do respectivo material.

## Recorte executável da Fase 8

```text
spawn 360° no raio 17..20
             │
             v
EnemySystem aproxima a 1,25 unidade/s ──> contato pendente em t (raio 1,5)
             ▲                                           │
             │                                           │
projétil anterior ──> projétil atual ──> impacto em t ────┤
                                                         v
                                           menor t define o desfecho
                                                │                 │
                                                v                 v
                                         eliminated        player-contact
                                                └──────┬──────────┘
                                                       v
                                            remove o inimigo uma vez
```

Existe exatamente um inimigo. O spawn usa um ângulo em 360° e uma distância no
anel de raio 17 a 20. Ele avança radialmente em direção ao centro lógico do
jogador e para no raio de contato `1,5`. O sistema registra a fração normalizada
do frame em que esse contato ocorreria e adia o desfecho até avaliar os projéteis.

`GameSession` reutiliza `intersectMovingSpheres()` e compara o primeiro impacto
com o contato pendente. O menor `t` vence; em igualdade, o impacto tem precedência.
A configuração padrão usa resistência `1` e força de acerto `1`, portanto um
impacto válido elimina a entidade. O outro desfecho é `player-contact`: ele remove
o inimigo, mas ainda não reduz vida. Não há respawn, segunda entidade, ondas ou
pontuação na Fase 8.

## Recorte executável da Fase 9

```text
início da sessão
       │
       v
EnemyTypes sorteia uniformemente 1 de 3 descritores
       │
       ├── weak      → Fraco       → resistência 1
       ├── medium    → Médio       → resistência 2
       └── resistant → Resistente  → resistência 3
       │
       v
EnemySystem cria uma entidade com tipo e cor definidos
       │
       ├── estado + callbacks + HUD expõem o tipo
       └── reset conserva o descritor sorteado
```

O tipo é escolhido exatamente uma vez durante a construção do inimigo. A
seleção usa intervalos de mesmo tamanho sobre a lista ordenada de descritores e
aceita um gerador aleatório injetável para testes. Outro gerador atende ao spawn;
assim, testar ou controlar o tipo não altera o ângulo nem a distância sorteados.

Os três descritores imutáveis usam os IDs técnicos `weak`, `medium` e
`resistant`, os rótulos visíveis Fraco, Médio e Resistente e resistências `1`,
`2` e `3`. Cada tipo também define uma cor base distinta, sem mudar collider,
velocidade, raio de spawn, regra de contato ou força do projétil.

Continua existindo somente um inimigo por sessão. Impactos reduzem um ponto de
resistência e preservam a colisão por movimento relativo e o desempate temporal
da Fase 8. O contato ainda produz somente `player-contact`, remove a entidade e
não reduz vida. Respawn, ondas, pontuação e dano ao jogador não fazem parte deste
recorte.

Não serão introduzidos ECS, engine de física ou barramento global de eventos no
MVP. As colisões atuais usam volumes simples e testes de segmento estático ou de
movimento relativo para os projéteis rápidos.

## Servidor

O servidor é um monólito modular Express:

```text
rota HTTP -> validação -> serviço -> repository -> MySQL
```

Em desenvolvimento, Vite encaminha `/api` para o Express. Em produção, o Express
serve o build estático do cliente e a API na mesma origem, eliminando a necessidade
de CORS aberto.

O servidor será a autoridade para o cálculo da pontuação persistida. O cliente
enviará um resumo validável da partida, não apenas o número final.

## Banco de dados

MySQL foi escolhido pela equipe. O acesso será feito com `mysql2`, queries
parametrizadas e migrations SQL. O MVP terá somente as entidades `players` e
`matches`; o ranking será derivado das partidas e não terá tabela própria.

## Estados previstos

```text
BOOT -> LOADING -> MENU -> PLAYING
                         <-> BETWEEN_WAVES
                         -> BOSS
PLAYING | BOSS -> GAME_OVER
BOSS -> VICTORY
GAME_OVER | VICTORY -> RESULTS
RESULTS -> MENU | REPLAY
```

`PAUSED` será um estado adicional. O ciclo da sessão XR permanecerá separado do
estado do jogo.

## Implantação

O deploy deverá executar Node.js, permitir conexão segura com MySQL e fornecer
HTTPS. A hospedagem final ainda não foi selecionada.
