# Arquitetura

## Objetivo

Manter uma única lógica de gameplay para navegador e WebXR, com módulos pequenos
e fáceis de testar. O projeto evita dependências e abstrações que não resolvam um
problema concreto do MVP.

## Visão geral

```text
DesktopLookController ──> câmera
DesktopFireController ──> GameSession ──> SlingshotSystem ──> ProjectileSystem ─┐
XRInput (futuro) ───────────────────────────────────────────┤
                                                           v
WaveSystem -> EnemySystem (futuros) <──────────── CollisionSystem
                  │                                        │
                  └─────> Player / Score / Item Systems ───┤
                                                           v
                                              StateMachine e HUD
                                                ├─ DomHUD
                                                └─ XRHud
                                                           │
                                                           v
                                                  RankingClient
                                                           │
                                                           v
                                              Express -> MySQL
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
  fachada da partida. Na Fase 6, seu `update(deltaSeconds)` preserva a ordem
  estilingue → projéteis → resolução do impacto; `dispose()` encerra todos os
  sistemas de forma idempotente.
- `SlingshotSystem` normaliza a carga de 0 a 1, calcula a velocidade, obtém a
  posição e a direção mundiais da câmera e publica mudanças por callbacks. Ele
  não conhece mouse, Pointer Lock nem elementos do DOM.
- `ProjectileSystem` recebe origem, direção e carga, calcula a velocidade inicial
  entre 10 e 24 unidades por segundo e aplica gravidade de -9,8. Cada projétil é
  uma esfera visual de raio 0,18, preserva a posição anterior para a futura
  colisão por segmento e tem ciclo de vida limitado. `update()` e `dispose()`
  não dependem do DOM e são idempotentes.
- `TargetSystem` é dono do único alvo de treinamento, de seu visual, collider,
  vida e transição terminal. Ele publica snapshots de estado por callbacks e não
  conhece elementos do DOM.
- `CollisionSystem` contém matemática pura para segmento–esfera. O raio do
  projétil é somado ao raio do alvo e o primeiro contato em `[0, 1]` impede
  tunneling sem introduzir uma engine física.
- O HUD HTML observa `onChargeChange({ charging, ratio })` e o resultado do
  disparo por callbacks, convertendo `ratio * 100` para a apresentação. O núcleo
  de gameplay não consulta nem altera elementos do DOM. Cancelamentos informam
  um motivo semântico, sem transformar mensagens de interface em regra de jogo.
- `GAMEPLAY_CONFIG`, em `config/gameplay-config.js`, centraliza tempos, velocidades,
  gravidade, dimensões e limites do recorte para evitar números mágicos.
- `GameSession` coordenará também a ordem dos demais sistemas quando uma partida
  completa for introduzida.
- Sistemas de gameplay não dependerão diretamente do mouse ou dos controles XR.
- Os controles de câmera e de disparo são os adaptadores de entrada desktop já
  concretos. Um futuro `XRInput` produzirá as mesmas intenções de tensionar e
  disparar, sem reutilizar eventos de mouse.
- A interface convencional utilizará HTML/CSS; a interface imersiva será criada
  dentro da cena 3D.
- Um único `renderer.setAnimationLoop()` atenderá navegador e WebXR.
- A área central da arena permanece livre para o futuro estilingue e para o
  jogador estacionário.

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

Não serão introduzidos ECS, engine de física ou barramento global de eventos no
MVP. Colisões iniciais utilizarão volumes simples e teste de segmento para os
projéteis rápidos.

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
