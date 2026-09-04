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
                                        ├─> PlayerHealthSystem                    │
                                        ├─> ScoreManager                           │
                                        ├─> GameStateManager ──> DomResults        │
                                        ├─> CollisionSystem <─────────────────────┤
                                        ├─> ImpactFeedbackSystem <────────────────┤
                                        └─> DomHUD <───────────────────────────────┘

WaveManager ──> GameStateManager / ScoreManager / Item Systems (parcial/futuros)
                                         │
                                         v
                                XRHud e RankingClient -> Express -> MySQL
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
  fachada da partida. Na Fase 15, seu `update(deltaSeconds)` preserva a ordem
  estilingue → inimigo → feedbacks existentes → projéteis → resolução do contato;
  quando o contato vence, aplica o dano pelo `PlayerHealthSystem` antes de
  notificar a interface. Também coordena o `WaveManager` e aplica seus pedidos de
  spawn à entidade reutilizada. Depois de um desfecho, sincroniza o
  `GameStateManager`; estados terminais tornam atualização e disparo inertes.
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
  conhece elementos do DOM. `reset()` conserva o tipo sorteado por padrão; as
  ondas podem solicitar explicitamente novo conjunto de tipos e velocidade; o
  chefão solicita descritor, velocidade, escala, altura e collider próprios.
- `WaveManager` mantém a progressão pura das quatro ondas, inimigo atual,
  intervalos entre spawns, pausas entre ondas e a transição para o chefão. Ele
  publica snapshots imutáveis e não conhece Three.js, vida, colisões ou DOM. Um
  contato não letal com o chefão retorna ao subestado `boss-pending`, permitindo
  reagendar o mesmo perfil com resistência restaurada.
- `GameStateManager` mantém o estado global `PLAYING`, `VICTORY` ou `GAME_OVER`
  sem conhecer Three.js ou DOM. Ele interpreta snapshots do inimigo, da vida e
  das ondas, publica uma única transição terminal e impede que observadores
  externos dupliquem o encerramento.
- `CollisionSystem` contém matemática pura para segmento–esfera estática e para
  duas esferas móveis. O segundo teste subtrai o movimento de um volume do outro,
  soma os raios e encontra o primeiro contato em `[0, 1]`, evitando tunneling sem
  introduzir uma engine física.
- `ImpactFeedbackSystem` mantém bursts 3D curtos no ponto de impacto. A geometria
  é compartilhada, os materiais são descartados individualmente e o limite FIFO
  impede o acúmulo de efeitos.
- `PlayerHealthSystem` mantém vida inicial e máxima, aplica dano inteiro positivo,
  limita o resultado a zero e publica snapshots imutáveis. Ele não conhece o
  inimigo, a cena ou o DOM e começa uma nova instância em cada sessão.
- `ScoreManager` recebe eventos semânticos identificados, consulta os valores
  centralizados de balanceamento e mantém o total. Um `Set` de IDs processados
  torna cada recompensa idempotente, mesmo se um callback for repetido.
- O HUD HTML observa `onChargeChange({ charging, ratio })`, disparos, tipo,
  resistência, vida, impactos, eliminação e contato por callbacks. O núcleo de
  gameplay não consulta nem altera elementos do DOM. Cancelamentos e desfechos
  informam motivos semânticos, sem transformar mensagens de interface em regra
  de jogo. A tela de resultados observa o estado global e recebe nome, resultado,
  pontuação e cenário já consolidados.
- `GAMEPLAY_CONFIG`, em `config/gameplay-config.js`, centraliza tempos, velocidades,
  gravidade, dimensões, vida máxima e dano de cada tipo para evitar números
  mágicos.
- `GameSession` coordena a progressão das quatro ondas sem duplicar regras de
  spawn, tipo ou velocidade dentro da interface.
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

## Recorte executável da Fase 10

```text
nova GameSession
       │
       ├──> PlayerHealthSystem inicia em 100 / 100
       └──> EnemySystem sorteia weak | medium | resistant
                                      │
                           contato vence o frame
                                      │
                                      v
                         remove inimigo uma única vez
                                      │
                                      v
                    aplica damage 1 | 2 | 3 ao jogador
                                      │
                                      v
                       onHealthChange atualiza o HUD
```

Os descritores dos tipos passam a carregar `damage` junto de ID, rótulo,
resistência e cor. O valor é validado como inteiro positivo e o snapshot do tipo
o preserva até o desfecho. `GameSession` consome esse dado no callback interno de
contato; a regra não fica em `main.js` e, portanto, não depende da existência do
HUD convencional.

O jogador inicia toda nova sessão com `initialHealth = 100` e
`maxHealth = 100`. `PlayerHealthSystem.applyDamage()` limita o mínimo a zero,
publica a perda efetiva e mantém a transição mesmo se um observador falhar. A
interface apenas descreve o snapshot, atualiza texto, atributos ARIA e a largura
da barra horizontal.

O desempate temporal continua inalterado. Um impacto letal anterior ou empatado
com o contato elimina o inimigo e preserva a vida em 100. Um impacto não letal no
empate reduz a resistência primeiro; o contato ainda ocorre em seguida e aplica
o dano daquele tipo uma única vez.

A Fase 10 conserva um inimigo por sessão. Por isso o fluxo jogável perde no
máximo três pontos antes de encerrar o encontro e ainda não alcança derrota,
respawn, ondas, pontuação ou telas de resultado.

Não serão introduzidos ECS, engine de física ou barramento global de eventos no
MVP. As colisões atuais usam volumes simples e testes de segmento estático ou de
movimento relativo para os projéteis rápidos.

## Recorte executável da Fase 11

```text
encontro 1 ativo
       │ eliminação ou contato
       v
espera configurável de 1,25 s
       │ reset da mesma entidade 3D
       │ novo tipo + novo spawn
       v
encontro 2 ativo → espera → encontro 3 ativo
                              │
                              v
                           complete
```

`GAMEPLAY_CONFIG.encounter` centraliza o total de três inimigos e o intervalo de
respawn. O cronômetro só avança com o encontro habilitado e usa apenas o excesso
do delta após a espera para mover o novo inimigo, evitando movimento invisível
durante a pausa.

O `reset()` padrão de `EnemySystem` continua preservando o tipo, mantendo o
contrato das fases anteriores. Somente o respawn coordenado solicita
`reset({ rerollType: true })`; a entidade reutiliza geometrias e materiais,
restaura resistência e visual, sorteia outro descritor e recebe nova posição no
anel de spawn.

A vida permanece no mesmo `PlayerHealthSystem` durante todo o ciclo. O HUD recebe
snapshots imutáveis de progresso, mostra “Encontro N de 3” e anuncia o próximo
spawn ou a conclusão. Ainda não existem quatro ondas, dificuldade crescente,
pontuação, chefão ou derrota.

## Recorte executável da Fase 12

```text
Onda 1: 3 × Fraco                    · velocidade 1,15 · intervalo 1,25 s
Onda 2: 4 × Fraco/Médio              · velocidade 1,25 · intervalo 1,10 s
Onda 3: 5 × Fraco/Médio/Resistente   · velocidade 1,40 · intervalo 0,95 s
Onda 4: 6 × Fraco/Médio/Resistente   · velocidade 1,60 · intervalo 0,80 s
                    │
                    └── pausa entre ondas: 2,50 s
```

`WaveManager` separa a progressão da coordenação gráfica. Ao terminar um inimigo,
ele escolhe `between-enemies`, `between-waves` ou `complete`. Quando o cronômetro
termina, `GameSession` aplica `spawnSettings` ao `EnemySystem`, que reutiliza a
mesma entidade com novo tipo, resistência, velocidade e posição.

Os catálogos de tipos são restritos por onda: a primeira ensina o inimigo fraco,
a segunda introduz o médio e as duas últimas liberam o resistente. Quantidade e
velocidade crescem, enquanto o intervalo diminui. Todos esses valores ficam em
`GAMEPLAY_CONFIG.waves` e podem ser balanceados sem alterar a lógica.

O HUD apresenta onda e inimigo atuais. A vida continua pertencendo à sessão e
não é restaurada entre spawns ou ondas. Ainda não existem chefão, bônus de
conclusão, pontuação, derrota ou tela de resultados.

## Recorte executável da Fase 13

```text
quarta onda concluída
        │
        └── espera 3 s ──> chefão de gelo
                              │
                              ├── escala visual 2,35 · collider 2,20
                              ├── velocidade 0,85 · resistência 10
                              └── contato: 10 de dano
```

Após o último inimigo normal, `WaveManager` entra em `boss-pending` e, ao fim do
intervalo, publica `spawnKind: "boss"`. `GameSession` aplica o perfil dedicado
ao `EnemySystem` com `reset({ enemyType, moveSpeed, radius, visualScale,
spawnHeight })`. A mesma entidade e seus recursos gráficos são reutilizados.

Durante o confronto, o gerenciador permanece em `boss`; qualquer desfecho
terminal leva a `complete`. O HUD diferencia o chefão dos tipos normais e mostra
sua resistência. A fase encerra a progressão de encontros, mas ainda não traduz
o resultado em vitória, derrota, pontuação ou tela final.

## Recorte executável da Fase 14

```text
eliminação normal ──> 100 | 250 | 500
fim de cada onda ───> +500
chefão eliminado ───> +2.000
fase concluída ─────> +1.000
                           │
                           └──> ScoreManager ──> HUD
```

`GameSession` captura a identidade da onda e do inimigo antes de avançar o
`WaveManager`. Eliminações recebem IDs `enemy:onda:inimigo`; bônus de onda usam
`wave:onda:completed`, e os dois eventos finais possuem IDs fixos. O
`ScoreManager` ignora IDs já processados e publica snapshots imutáveis somente
quando o total realmente muda.

Contatos não concedem pontos de eliminação. O último encontro normal ainda
conclui sua onda e concede o respectivo bônus; já o contato do chefão não concede
os bônus de chefão ou de fase. Vitória e derrota continuam sem estado e tela
próprios até a Fase 15.

## Recorte executável da Fase 15

```text
                           GameStateManager
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
vida chega a 0 ──> GAME_OVER       VICTORY <── chefão eliminado
                   │                           │
                   └──────────> resultados <──┘
                                  │
                                  └── jogar novamente ──> nova sessão

chefão + contato + vida > 0 ──> boss-pending ──> boss com resistência cheia
```

O `GameStateManager` separa o estado global da partida dos subestados de
progressão do `WaveManager`. Enquanto o estado global é `PLAYING`, as ondas podem
estar em `active`, `between-enemies`, `between-waves`, `boss-pending` ou `boss`.
Somente a eliminação do chefão, depois das quatro ondas, produz `VICTORY`; vida
igual a zero produz `GAME_OVER` em qualquer encontro.

Um contato não letal com o chefão aplica 10 de dano, não concede pontos e usa
`WaveManager.retryBoss()` para voltar a `boss-pending`. Depois da espera
configurada, `GameSession` restaura o perfil completo do chefão e o confronto
continua. Isso mantém a condição de derrota ligada exclusivamente à vida, sem
confundir um contato com vitória ou fim inconclusivo.

A pontuação do desfecho é registrada antes da transição global. Assim, a tela de
vitória já recebe os 2.000 pontos do chefão e os 1.000 da fase. Depois de qualquer
estado terminal, a sessão recusa novas cargas e disparos e deixa de atualizar os
sistemas de gameplay. A interface libera a mira e apresenta nome normalizado do
jogador, resultado, pontuação e cenário. **Jogar novamente** descarta os recursos
atuais e constrói uma nova sessão, restaurando vida, ondas e placar sem reutilizar
estado terminal.

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

## Estados da partida

```text
estado global
PLAYING ──> VICTORY
    │
    └────> GAME_OVER

subestado do WaveManager enquanto PLAYING
active <──> between-enemies
   │
   └─────> between-waves ──> boss-pending <──> boss ──> complete
```

Menu, tela final e replay pertencem ao fluxo da interface, não são confundidos
com o estado causal do gameplay. `PAUSED` poderá ser adicionado depois. O ciclo
da sessão XR permanecerá separado do estado do jogo.

## Implantação

O deploy deverá executar Node.js, permitir conexão segura com MySQL e fornecer
HTTPS. A hospedagem final ainda não foi selecionada.
