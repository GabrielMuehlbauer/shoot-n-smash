# Fase 9 — Tipos normais de inimigo

## Objetivo

Introduzir os três tipos normais do Shoot 'n' Smash sem ampliar o encontro mínimo
da Fase 8. Cada nova sessão sorteia **Fraco, Médio ou Resistente**, aplica a
resistência correspondente e mostra a identidade no visual, no estado e no HUD.

Spawn, aproximação, colisão contínua, desempate entre impacto e contato e
desfechos continuam usando os contratos já validados. A fase diferencia uma
entidade por vez; ela ainda não cria ondas nem vida do jogador.

## Escopo entregue

- catálogo imutável com três descritores de tipo;
- IDs técnicos `weak`, `medium` e `resistant`;
- rótulos visíveis Fraco, Médio e Resistente;
- resistências de 1, 2 e 3 acertos, respectivamente;
- cor base distinta para reconhecer cada tipo na arena;
- seleção uniforme de um tipo exatamente uma vez por sessão;
- gerador aleatório do tipo injetável e separado do gerador de spawn;
- identidade do tipo exposta no estado, nos callbacks e no HUD;
- resistência máxima e atual apresentadas de acordo com o tipo sorteado;
- preservação do mesmo tipo quando a entidade é reiniciada por `reset()`;
- regressão do movimento, contato, colisão e desempate temporal da Fase 8.

## Fora do escopo

A Fase 9 ainda não implementa:

- vida, barra de vida, dano ou derrota do jogador;
- valores de dano de contato para os três tipos;
- respawn ou novo sorteio depois do primeiro desfecho;
- mais de um inimigo simultâneo;
- ondas, chefão, itens ou pontuação;
- banco de dados, partidas persistidas ou ranking;
- controles WebXR ou HUD imersivo;
- subclasses, ECS, engine física ou fábrica genérica de entidades.

O contato mantém a semântica da etapa anterior: publica `player-contact`, encerra
o encontro e remove o inimigo, mas não reduz qualquer valor de vida.

## Tipos canônicos

| ID | Rótulo | Resistência | Cor base |
|---|---|---:|---:|
| `weak` | Fraco | 1 acerto | `#6edcff` |
| `medium` | Médio | 2 acertos | `#6f8cff` |
| `resistant` | Resistente | 3 acertos | `#9e6fff` |

A força do projétil permanece `1`. Logo, sem contato anterior com o jogador, o
tipo Fraco é eliminado pelo primeiro impacto válido, o Médio pelo segundo e o
Resistente pelo terceiro. A resistência nunca fica negativa.

Os tipos compartilham todas as demais regras:

| Regra compartilhada | Valor |
|---|---:|
| Quantidade de inimigos por sessão | 1 |
| Raio do collider | 1,05 |
| Velocidade de aproximação | 1,25 unidade/s |
| Raio mínimo do spawn | 17 |
| Raio máximo do spawn | 20 |
| Altura do spawn | y = 1,05 |
| Centro lógico do jogador | (0, 1,05, 0) |
| Raio de contato | 1,5 |
| Força do projétil | 1 acerto |

O catálogo e os parâmetros compartilhados ficam em
`client/src/config/gameplay-config.js`.

## Catálogo e seleção uniforme

`EnemyTypes` valida o catálogo antes da seleção. Cada descritor exige ID e rótulo
não vazios, resistência inteira positiva e uma cor hexadecimal válida; IDs
duplicados são rejeitados.

Com os três descritores na ordem canônica, uma amostra em `[0, 1)` é dividida em
três intervalos de mesmo tamanho:

```text
[0, 1/3)   → weak
[1/3, 2/3) → medium
[2/3, 1)   → resistant
```

O resultado é um snapshot imutável. A seleção acontece somente na construção do
`EnemySystem`; receber dano, atualizar frames ou chamar `reset()` não consome uma
nova amostra e não muda o tipo.

## Aleatoriedade independente do spawn

O sorteio do tipo e o spawn têm geradores injetáveis diferentes:

```text
enemyTypeRandom → escolhe weak | medium | resistant
enemyRandom     → escolhe ângulo e distância no anel 17..20
```

Essa separação impede acoplamento entre duas regras. Fixar uma amostra para
testar o tipo não desloca as duas amostras usadas pelo spawn, e alterar o cálculo
de posição no futuro não muda silenciosamente a distribuição dos tipos.

Em execução real, ambos usam aleatoriedade da plataforma. O sorteio é uniforme
por sessão, mas uma sequência manual curta não precisa apresentar os tipos em
ordem nem garantir exatamente um terço de cada um.

## Estado, callbacks e reset

Os snapshots do inimigo carregam a identidade escolhida junto da resistência:

```text
type.id
type.label
resistance
maxResistance
ratio
active
outcome
```

Os callbacks de mudança, impacto e desfecho recebem o tipo necessário para que a
interface descreva o evento sem consultar configuração global. O HUD usa o
rótulo visível, o valor atual e o máximo, e mantém estados distintos para
aproximação, dano, eliminação e contato.

`reset()` restaura a resistência máxima e o estado ativo da mesma entidade, mas
preserva o descritor sorteado. Uma nova seleção ocorre somente ao iniciar uma
nova sessão e construir outro inimigo.

## Regras preservadas da Fase 8

O tipo altera somente resistência e aparência base. Cada inimigo continua:

- nascendo em qualquer direção no anel de raio 17 a 20;
- avançando radialmente a 1,25 unidade por segundo;
- preservando centros anterior e atual em cada frame;
- colidindo com projéteis por movimento relativo;
- gerando burst e consumindo somente o projétil de um impacto válido;
- parando no raio de contato `1,5`;
- comparando `impactRatio` e `contactRatio` quando os eventos disputam o frame;
- dando precedência ao impacto quando as frações são iguais;
- publicando somente `eliminated` ou `player-contact` e sendo removido uma vez.

Um impacto que não elimina o tipo Médio ou Resistente apenas reduz sua
resistência; o inimigo permanece ativo e continua a aproximação.

Na igualdade entre impacto e contato, o impacto continua sendo processado
primeiro. Se ele zerar a resistência, a eliminação cancela o contato pendente;
se não for letal, o projétil é consumido, a resistência diminui e o contato é
resolvido em seguida como `player-contact`. A precedência define a ordem causal,
não uma imunidade ao contato para tipos com resistência restante.

## Fluxo técnico

```text
GameSession cria EnemySystem
        │
        ├── EnemyTypes seleciona um descritor com enemyTypeRandom
        ├── spawn usa enemyRandom para ângulo e distância
        └── visual + resistência + HUD recebem o tipo
                         │
                         v
              GameSession.update(delta)
                         │
             movimento + colisão contínua
                         │
          ┌──────────────┴──────────────┐
          v                             v
 contato ocorre primeiro       impacto válido de força 1
 outcome player-contact                 │
                            ┌────────────┴────────────┐
                            v                         v
                resistência ainda > 0         resistência = 0
                continua aproximando          outcome eliminated
```

`GameApp` continua responsável pelo único `setAnimationLoop()`. A seleção de
tipo não conhece DOM, mouse ou WebXR e não adiciona qualquer endpoint à API.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL permanece opcional e pode aparecer como
`not-configured` no diagnóstico.

## Como testar manualmente

1. Confirme **Fase 9 concluída** na página inicial.
2. Pressione **Verificar API** e confirme `phase: 9`.
3. Pressione **Abrir cena 3D** e confira no HUD o tipo e a resistência sorteados.
4. Observe em 360° até localizar o único monstro de gelo.
5. Compare a cor do inimigo com seu tipo e confirme que ele se aproxima do
   centro da mesma forma para qualquer resistência.
6. Ative a mira e acerte o inimigo. Confirme burst branco, consumo da bola de
   neve e redução de exatamente um ponto de resistência.
7. Se o tipo for Médio ou Resistente, confirme que ele permanece ativo após um
   impacto não fatal e continua se aproximando.
8. Complete os impactos necessários e confirme eliminação somente em `1`, `2`
   ou `3` acertos, conforme o tipo mostrado.
9. Abra novas sessões para observar outros tipos. Lembre que o sorteio é
   uniforme, mas aleatório; tipos podem se repetir em sessões consecutivas.
10. Confirme que cada nova sessão ainda apresenta uma posição de spawn
    independente e somente uma entidade.
11. Abra uma sessão, não dispare e aguarde o contato. Confirme remoção do
    inimigo e mensagem de contato, sem redução da vida do jogador.
12. Dispare pouco antes do contato e confirme somente um desfecho, determinado
    pelo primeiro evento; na igualdade, o impacto continua vencendo.
13. Entre e saia da cena três vezes. Confirme um único canvas e ausência de
    inimigos, efeitos ou listeners residuais.
14. Confirme no Console que não existem erros não tratados e que não surgiram
    respawn, ondas ou pontuação.

## Testes automatizados esperados

Execute testes e build:

```powershell
npm run check
```

A cobertura desta fase deve incluir:

- catálogo canônico, ordenado e imutável;
- fronteiras dos três intervalos uniformes;
- rejeição de catálogos, descritores, IDs, cores e geradores inválidos;
- snapshot do tipo independente do catálogo de origem;
- seleção única sem consumir ou deslocar as amostras do spawn;
- escolha determinística dos três tipos por gerador injetado;
- resistência inicial, impactos não fatais e eliminação de cada tipo;
- ordenação cronológica de múltiplos impactos no mesmo frame;
- tipo preservado por snapshots, callbacks, desfechos e `reset()`;
- snapshots congelados contra mutação por observadores;
- HUD acessível para Fraco, Médio e Resistente;
- regressão da aproximação, colisão contínua, contato e desempate temporal;
- rollback de construção parcial e descarte idempotente;
- versão do cliente e diagnóstico da API na Fase 9.

## Critérios de aceite

- [ ] O catálogo contém somente os três tipos canônicos desta fase.
- [ ] Fraco, Médio e Resistente exigem exatamente 1, 2 e 3 impactos válidos.
- [ ] Cada tipo tem um ID estável, rótulo em português e cor base distinta.
- [ ] Uma sessão seleciona somente um tipo e mantém essa identidade até o fim.
- [ ] Os três tipos têm a mesma probabilidade teórica de seleção.
- [ ] O sorteio do tipo não altera as duas amostras usadas pelo spawn.
- [ ] Estado, callbacks e HUD informam o tipo sorteado.
- [ ] `reset()` restaura resistência e atividade sem trocar o tipo.
- [ ] Impacto não fatal mantém o inimigo ativo e em aproximação.
- [ ] Movimento, colisão e desempate preservam os contratos da Fase 8.
- [ ] Existe exatamente um inimigo por sessão e nenhum respawn.
- [ ] O contato ainda não reduz vida nem aplica dano ao jogador.
- [ ] Não existem ondas, pontuação, chefão, persistência ou WebXR antecipados.
- [ ] Três reinícios não deixam recursos ou listeners residuais.
- [ ] `npm run check` termina sem falhas.

## Solução de problemas

- O tipo é aleatório. Repetições consecutivas são válidas e não demonstram viés
  por si só; os limites uniformes são verificados por testes determinísticos.
- Se a resistência não corresponder ao rótulo, reinicie os processos de Vite e
  faça uma atualização completa para evitar módulos antigos em cache.
- Se o inimigo não estiver à frente, observe toda a arena: o spawn continua 360°.
- Para acertar a distância, use carga maior e compense a gravidade mirando um
  pouco acima do centro do inimigo.
- Se um tipo com resistência restante desaparecer, ele pode ter alcançado o raio
  de contato. Isso ainda encerra o encontro sem causar dano ao jogador.
- `database.status = not-configured` é esperado sem `DATABASE_URL`.
- Se **Ativar mira** estiver indisponível, use um navegador desktop com Pointer
  Lock e mantenha a janela em foco.

## Próximo incremento

A Fase 10 deverá criar a vida do jogador e definir quanto dano o contato de cada
tipo normal aplica. O novo sistema deverá consumir o desfecho de contato já
existente sem alterar resistência, spawn, movimento, colisão ou seleção de tipo.

Ondas, respawn, pontuação, chefão, persistência, ranking e WebXR continuam fora
desse próximo passo.
