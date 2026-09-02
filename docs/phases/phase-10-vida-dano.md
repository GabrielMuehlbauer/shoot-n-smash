# Fase 10 — Vida do jogador e dano de contato

## Objetivo

Introduzir a vida do jogador no encontro mínimo e fazer o contato já validado
aplicar o dano canônico do tipo sorteado. Toda nova sessão começa em **100 / 100**
e apresenta uma barra horizontal acessível na arena.

Spawn, aproximação, colisão contínua, resistência e desempate temporal continuam
inalterados. Ainda existe somente um inimigo por sessão.

## Escopo entregue

- vida inicial e máxima centralizadas em 100;
- `PlayerHealthSystem` independente de DOM e Three.js;
- snapshots imutáveis com vida, máximo, proporção e estado esgotado;
- dano inteiro positivo com limite mínimo zero;
- dano 1, 2 e 3 para Fraco, Médio e Resistente;
- aplicação do dano por `GameSession`, antes do observador externo do contato;
- atualização imediata do HUD por `onPlayerHealthChange`;
- barra horizontal com texto, porcentagem e atributos ARIA sincronizados;
- feedback visual vermelho e mensagem com tipo, dano e vida restante;
- preservação das regras de impacto versus contato das fases anteriores;
- reset natural para 100 ao criar uma nova sessão;
- metadados do cliente e diagnóstico da API atualizados para a Fase 10.

## Fora do escopo

A Fase 10 ainda não implementa:

- respawn ou mais de um inimigo;
- ondas, intervalos de spawn ou progressão de dificuldade;
- condição de derrota quando a vida chega a zero;
- chefão, itens, cura ou poderes;
- pontuação, resultados, persistência ou ranking;
- controles WebXR ou HUD imersivo.

Como o encontro termina no primeiro contato, o fluxo atual reduz no máximo três
pontos por sessão. O estado suporta o limite zero para os próximos incrementos,
mas a partida normal desta fase ainda não o alcança.

## Configuração canônica

```text
Jogador
vida inicial = 100
vida máxima  = 100

Fraco       → resistência 1 → dano 1
Médio       → resistência 2 → dano 2
Resistente  → resistência 3 → dano 3
```

Os valores ficam em `client/src/config/gameplay-config.js`. `EnemyTypes` valida e
copia `damage` para o snapshot imutável do tipo; observadores não podem alterar o
valor usado pelo contato.

## Estado do jogador

`PlayerHealthSystem.state` expõe:

```text
health
maxHealth
ratio
depleted
```

`applyDamage(amount)` exige um inteiro positivo. A vida resultante usa limite
inferior zero, e o evento informa também o dano solicitado e a perda efetivamente
aplicada. Se um observador falhar, a vida já reduzida permanece consistente.

`reset()` restaura a vida inicial sem emitir eventos. Na interface atual, sair da
arena descarta a sessão inteira; entrar novamente cria outro sistema já em 100.

## Fluxo do contato

```text
EnemySystem detecta contato pendente
               │
               v
GameSession avalia todos os projéteis do frame
               │
       ┌───────┴────────┐
       v                v
impacto letal vence   contato vence
       │                │
elimina inimigo        EnemySystem publica player-contact
vida permanece 100      │
                        v
               GameSession lê type.damage
                        │
                        v
               PlayerHealthSystem aplica dano
                        │
                        v
                 HUD atualiza imediatamente
```

O contato terminal continua sendo publicado somente uma vez. Atualizações
posteriores não reaplicam dano.

Na igualdade temporal, o impacto mantém precedência. Se for letal, não há
contato nem dano. Se não for letal, a resistência cai primeiro e o contato é
resolvido em seguida com o dano completo daquele tipo.

## HUD e acessibilidade

A interface exibe `Vida do jogador` e `100 / 100` em uma barra horizontal. O
elemento usa `role="progressbar"`, mínimo zero e máximo/current sincronizados com
o snapshot. `aria-valuetext` descreve o valor sem depender da cor ou da largura.

Ao receber dano, a largura diminui proporcionalmente, a cor passa de verde para
vermelho e o painel executa uma animação curta. A região de status do disparo,
que já é anunciada por tecnologia assistiva, informa o tipo, o dano e a vida
restante sem criar live regions concorrentes.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL continua opcional e pode aparecer como
`not-configured` no diagnóstico.

## Como testar manualmente

1. Confirme **Fase 10 concluída** na página inicial.
2. Pressione **Verificar API** e confirme `phase: 10`.
3. Abra a cena e confirme a barra de vida cheia em **100 / 100**.
4. Confira o tipo sorteado no HUD do inimigo e localize-o em 360°.
5. Elimine o inimigo antes do contato e confirme que a vida permanece 100.
6. Abra outra sessão, não dispare e aguarde o contato após cerca de 12,4 a 14,8
   segundos.
7. Confirme a remoção do inimigo, o feedback vermelho e a vida final:
   - Fraco: 99 / 100;
   - Médio: 98 / 100;
   - Resistente: 97 / 100.
8. Aguarde mais alguns segundos e confirme que o mesmo contato não aplica dano
   novamente.
9. Para um tipo Médio ou Resistente, provoque um impacto não letal pouco antes do
   contato; confirme resistência menor e apenas um dano de contato completo.
10. Saia e entre novamente; confirme que a nova sessão retorna a 100 / 100.
11. Repita três ciclos de entrada e saída, sem canvas, inimigos, efeitos ou
    listeners residuais.
12. Confirme que não surgiram respawn, ondas, pontuação, derrota ou erros não
    tratados no Console.

## Testes automatizados esperados

Execute testes e build:

```powershell
npm run check
```

A cobertura desta fase deve incluir:

- configuração imutável da vida 100 / 100;
- snapshots imutáveis do jogador;
- dano imediato, limite zero e rejeição de valores inválidos;
- estado preservado quando um observador falha;
- reset e descarte idempotentes;
- dano 1, 2 e 3 presente nos três descritores;
- contato de cada tipo resultando em 99, 98 e 97;
- dano publicado e aplicado somente uma vez;
- impacto letal anterior ou empatado preservando 100 de vida;
- impacto não letal empatado seguido de um único dano;
- HUD saudável, ferido e esgotado;
- progressbar estático com rótulos e atributos ARIA;
- regressão de spawn, movimento, colisão, resistência e desempate;
- metadados e diagnóstico da API na Fase 10.

## Critérios de aceite

- [ ] Toda nova sessão começa em 100 / 100.
- [ ] A vida inicial e máxima estão centralizadas na configuração.
- [ ] A vida nunca fica negativa, acima do máximo ou inválida.
- [ ] A barra horizontal representa imediatamente a proporção atual.
- [ ] Texto e atributos acessíveis acompanham a barra.
- [ ] Fraco, Médio e Resistente causam exatamente 1, 2 e 3 de dano.
- [ ] Um contato aplica dano uma única vez e remove o inimigo.
- [ ] Um impacto letal que vence o contato não causa dano.
- [ ] A lógica de vida não depende do DOM.
- [ ] Uma nova sessão restaura 100 / 100.
- [ ] Não existem respawn, ondas, derrota, pontuação ou WebXR antecipados.
- [ ] Três reinícios não deixam recursos ou listeners residuais.
- [ ] `npm run check` termina sem falhas.

## Solução de problemas

- O tipo é aleatório; use o rótulo do HUD para calcular a vida final esperada.
- Se a barra não mudar, faça uma atualização completa para evitar módulos antigos
  em cache e confirme `phase: 10` no diagnóstico.
- Se o inimigo for eliminado antes de tocar o centro, preservar 100 de vida é o
  comportamento correto.
- Se o tipo Médio ou Resistente desaparecer após um impacto não letal, ele pode
  ter alcançado o raio de contato no mesmo frame; nesse caso o dano deve aparecer.
- `database.status = not-configured` é esperado sem `DATABASE_URL`.

## Próximo incremento

A Fase 11 deverá criar respawn controlado e a base configurável das ondas,
preservando a mesma vida entre encontros. Chefão, pontuação, itens, resultados,
persistência, ranking e WebXR continuam posteriores.
