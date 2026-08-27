# Arquitetura

## Objetivo

Manter uma única lógica de gameplay para navegador e WebXR, com módulos pequenos
e fáceis de testar. O projeto evita dependências e abstrações que não resolvam um
problema concreto do MVP.

## Visão geral

```text
DesktopInput ─┐
              ├─> InputRouter -> SlingshotSystem -> ProjectileSystem
XRInput ──────┘                                │
                                               v
WaveSystem -> EnemySystem <------------ CollisionSystem
                  │                            │
                  └─────> Player / Score / Item Systems
                                               │
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
- `GameApp` já controla o único `setAnimationLoop`, a composição e o ciclo de
  vida da cena, limita o delta entre frames e pausa atualizações quando a aba
  está oculta.
- `GameSession` coordenará a ordem de atualização durante uma partida.
- Sistemas de gameplay não dependerão diretamente do mouse ou dos controles XR.
- `DesktopInput` e `XRInput` produzirão intenções comuns de mirar, tensionar e
  disparar.
- A interface convencional utilizará HTML/CSS; a interface imersiva será criada
  dentro da cena 3D.
- Um único `renderer.setAnimationLoop()` atenderá navegador e WebXR.
- A área central da arena permanece livre para o futuro estilingue e para o
  jogador estacionário.

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
