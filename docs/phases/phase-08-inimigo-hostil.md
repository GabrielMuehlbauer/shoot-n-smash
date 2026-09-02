# Fase 8 — Primeiro inimigo hostil

## Objetivo

Substituir o alvo de treinamento da Fase 7 pelo primeiro inimigo hostil do
Shoot 'n' Smash. O novo recorte valida o ciclo mínimo **spawn ao redor da arena
→ aproximação do centro → eliminação por projétil ou contato com o jogador**,
reutilizando a colisão contínua já comprovada nas fases anteriores.

## Escopo entregue

- um único monstro de gelo low-poly criado com primitivas do Three.js;
- spawn aleatório em 360° dentro de um anel de raio 17 a 20;
- centro lógico fixo do jogador em `(0, 1,05, 0)`;
- aproximação radial do inimigo a `1,25` unidade por segundo;
- contato quando a distância horizontal ao centro chega ao raio `1,5`;
- resistência genérica expressa em quantidade de acertos;
- resistência padrão igual a 1 e força padrão do projétil igual a 1;
- colisão contínua entre projétil e inimigo por movimento relativo;
- comparação temporal entre impacto e contato ocorridos no mesmo frame;
- remoção única do inimigo após eliminação ou contato com o jogador;
- callbacks separados para resistência, eliminação, impacto e contato;
- descarte idempotente dos recursos gráficos do inimigo.

## Fora do escopo

A Fase 8 ainda não implementa:

- redução da vida do jogador ao ocorrer contato;
- barra de vida, derrota ou reinício automático da partida;
- mais de um inimigo simultâneo;
- respawn ou novo inimigo depois do primeiro desfecho;
- tipos fraco, médio e resistente como entidades distintas;
- ondas, chefão, pontuação ou itens;
- pathfinding ou colisão do inimigo com a decoração da arena;
- ataques à distância, inimigos voadores ou animações finais;
- persistência MySQL, ranking ou WebXR.

O evento de contato encerra e remove o inimigo, mas não altera qualquer valor de
vida nesta etapa.

## Parâmetros canônicos

| Regra | Valor |
|---|---:|
| Quantidade de inimigos | 1 |
| Raio do collider do inimigo | 1,05 |
| Resistência padrão | 1 acerto |
| Força do projétil | 1 acerto |
| Velocidade de aproximação | 1,25 unidade/s |
| Raio mínimo do spawn | 17 |
| Raio máximo do spawn | 20 |
| Altura do spawn | y = 1,05 |
| Centro lógico do jogador | (0, 1,05, 0) |
| Raio de contato com o jogador | 1,5 |

Esses valores ficam centralizados em
`client/src/config/gameplay-config.js`. A resistência é um inteiro positivo e
pode ser alterada sem trocar a matemática de colisão ou a integração dos
projéteis.

## Inimigo low-poly

`EnemySystem` é dono da entidade hostil, de seu collider, resistência, movimento,
estado terminal e recursos Three.js. O visual provisório utiliza formas
geométricas simples para representar corpo, cabeça, braços, olhos e chifres de
gelo. Uma oscilação curta do corpo e dos braços fornece feedback de movimento
sem depender de assets externos.

Os estados terminais são distintos:

```text
eliminated      = resistência chegou a zero por um impacto válido
player-contact  = inimigo alcançou o raio lógico do jogador
```

Nos dois casos a entidade é removida da cena uma única vez. Geometrias e
materiais continuam sob responsabilidade do sistema e são liberados em
`dispose()`.

## Spawn em 360°

O spawn escolhe um ângulo em uma volta completa e uma distância entre 17 e 20:

```text
ângulo = aleatório entre 0 e 2π
raio   = aleatório entre 17 e 20

x = centro.x + cos(ângulo) × raio
z = centro.z + sen(ângulo) × raio
```

O gerador aleatório pode ser injetado nos testes. Assim, todos os quadrantes e
os limites do anel podem ser verificados de forma determinística, enquanto cada
nova sessão real pode apresentar o inimigo em outra direção da arena.

## Aproximação radial e contato

A cada frame, o inimigo calcula no plano horizontal o vetor entre sua posição e
o centro lógico fixo. O deslocamento é limitado pela velocidade e pela distância
restante até o raio de contato, evitando que a entidade ultrapasse o jogador.

O sistema preserva a posição anterior e a atual. Quando o passo alcançaria o
raio `1,5`, ele registra a fração normalizada do frame em que o contato ocorreu,
mas adia o desfecho até que os projéteis do mesmo frame sejam avaliados.

Com spawn entre 17 e 20 e velocidade 1,25, um inimigo sem oposição leva
aproximadamente de 12,4 a 14,8 segundos para alcançar o raio de contato.

## Colisão e desempate temporal

O `GameSession` reaproveita `intersectMovingSpheres()` do `CollisionSystem`.
Para o mesmo frame, são comparados:

```text
projétil anterior → projétil atual
inimigo anterior  → inimigo atual
```

O movimento relativo converte o teste em um segmento contra uma esfera com o
raio combinado do projétil e do inimigo. O resultado fornece o primeiro contato
em `t`, dentro de `[0, 1]`, sem depender apenas das posições finais e sem perder
projéteis rápidos entre frames.

Quando impacto e contato com o jogador podem ocorrer no mesmo frame, prevalece
o menor `t`:

- se `impactRatio <= contactRatio`, o projétil acerta primeiro, aplica a força
  do acerto e pode eliminar o inimigo;
- se `contactRatio < impactRatio`, o contato ocorre primeiro e o projétil não
  altera o inimigo;
- somente um dos desfechos terminais é publicado e a entidade é removida uma
  vez.

Na configuração padrão, um impacto reduz a resistência de `1` para `0`, cria o
burst 3D no centro do projétil, consome o projétil e elimina o inimigo.

## Fluxo técnico

```text
GameSession.update(delta)
        │
        ├── SlingshotSystem atualiza a carga
        ├── EnemySystem avança e calcula possível contactRatio
        ├── ImpactFeedbackSystem atualiza bursts existentes
        └── ProjectileSystem integra cada trajetória
                         │
                         v
              CollisionSystem: movimento relativo
                         │
             compara impactRatio e contactRatio
                         │
              ┌──────────┴──────────┐
              v                     v
       impacto primeiro       contato primeiro
       reduz resistência      outcome player-contact
       burst + consumo        remove inimigo
              │
              v
       resistência zero
       outcome eliminated
       remove inimigo
```

`GameApp` continua responsável pelo único `setAnimationLoop()`. Entrada desktop,
HUD e gameplay permanecem separados por callbacks, e nenhuma engine física foi
adicionada.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL continua opcional nesta etapa e pode
aparecer como `not-configured` no diagnóstico da API.

## Como testar manualmente

1. Confirme **Fase 8 concluída** na página inicial.
2. Pressione **Verificar API** e confirme que o diagnóstico informa `phase: 8`.
3. Pressione **Abrir cena 3D**.
4. Observe a arena em 360° até localizar um único monstro de gelo low-poly.
5. Confirme que ele surgiu longe do centro e avança diretamente na direção do
   jogador, mantendo a face voltada para o centro.
6. Pressione **Ativar mira**, acompanhe o inimigo e faça um disparo válido.
7. Confirme que um impacto cria o burst branco, consome a bola de neve e remove
   o inimigo após o primeiro acerto.
8. Saia da cena, abra uma nova sessão e não dispare. Aguarde aproximadamente 12
   a 15 segundos.
9. Confirme que o inimigo desaparece ao alcançar o raio de contato e que o jogo
   informa o contato sem reduzir vida do jogador.
10. Dispare pouco antes do contato e confirme que ocorre apenas um desfecho:
    eliminação ou contato, conforme o evento que aconteceu primeiro.
11. Erre um disparo e confirme que o inimigo continua se aproximando.
12. Repita pelo menos três novas sessões e confirme spawns em direções variadas,
    sempre dentro da ilha e fora da área central.
13. Entre e saia da cena três vezes. Confirme um único canvas, um único inimigo
    por sessão e ausência de listeners, meshes ou efeitos residuais.
14. Confirme no Console do navegador que não existem erros não tratados.

## Testes automatizados esperados

Execute testes e build:

```powershell
npm run check
```

A cobertura desta fase deve incluir:

- spawn determinístico nos limites do anel e em diferentes quadrantes;
- rejeição de configuração, posição, callback e gerador aleatório inválidos;
- criação de um único visual low-poly com collider explícito;
- aproximação radial independente da subdivisão dos frames;
- preservação dos centros anterior e atual do inimigo;
- parada exata no raio de contato e cálculo do `contactRatio`;
- contato publicado e remoção da cena uma única vez;
- resistência genérica, limite em zero e eliminação única;
- colisão contínua entre projétil e inimigo em movimento;
- consumo do projétil e criação do feedback somente em impacto válido;
- impacto anterior ao contato, contato anterior ao impacto e igualdade dos
  valores de `t`;
- ausência de dano ou consumo quando o disparo erra;
- consistência de estado quando um observador falha;
- estados acessíveis do HUD para aproximação, dano, eliminação e contato;
- reset, construção parcial e descarte idempotente dos recursos;
- integração e ordem de atualização coordenadas por `GameSession`.

## Critérios de aceite

- [ ] Existe exatamente um inimigo hostil no início de cada sessão.
- [ ] O spawn ocorre em qualquer direção, entre os raios 17 e 20.
- [ ] O inimigo nunca nasce dentro do raio de contato do jogador.
- [ ] A aproximação é radial, contínua e não depende da taxa de frames.
- [ ] A entidade não atravessa o raio de contato `1,5`.
- [ ] Um disparo fora do collider não altera a resistência.
- [ ] Um impacto válido com a configuração padrão elimina em um acerto.
- [ ] O impacto cria exatamente um burst e consome somente o projétil que acertou.
- [ ] O menor `t` decide entre impacto e contato no mesmo frame.
- [ ] Eliminação e contato são mutuamente exclusivos.
- [ ] Cada desfecho remove o inimigo da cena uma única vez.
- [ ] O contato não reduz a vida do jogador nesta fase.
- [ ] Não existe respawn, segunda entidade, onda ou pontuação antecipada.
- [ ] Três reinícios não deixam inimigos, efeitos, canvas ou listeners residuais.
- [ ] `npm run check` termina sem falhas.

## Solução de problemas

- O spawn é realmente 360°. Se o inimigo não estiver à frente da câmera, ative
  a mira e observe os lados e a parte posterior da arena.
- Como a posição é aleatória, cada sessão pode exigir uma direção de busca
  diferente. Reiniciar a cena cria uma nova amostra de spawn.
- Para compensar a gravidade, use carga maior e mire um pouco acima do centro do
  inimigo quando ele ainda estiver distante.
- Se o inimigo desaparecer sem ter sido atingido, ele provavelmente alcançou o
  raio lógico do jogador; isso representa contato, não perda de vida.
- Se **Ativar mira** estiver indisponível, use um navegador desktop com suporte
  a Pointer Lock e mantenha a janela em foco.
- `database.status = not-configured` continua sendo esperado quando não existe
  uma `DATABASE_URL` configurada.
- Se a página ainda mostrar a fase anterior, encerre processos antigos de Vite,
  reinicie `npm run dev` e faça uma atualização completa no navegador.

## Próximo incremento

A próxima fase deverá introduzir os tipos normais de inimigo e configurar suas
resistências em `1`, `2` e `3` acertos, preservando o mesmo contrato de colisão,
movimento e desfecho. Depois dessa diferenciação, um incremento separado deverá
criar a vida do jogador e fazer o contato aplicar o dano correspondente a cada
tipo. Ondas, pontuação, ranking e WebXR devem continuar fora desses dois passos.
