# Fase 15 — Vitória e derrota

## Objetivo da etapa

Adicionar um estado global de partida e uma tela de resultados acessível para
encerrar o ciclo jogável com vitória ou derrota, sem misturar essa regra com os
subestados das ondas.

## Resultado esperado

- a partida começa em `PLAYING`;
- eliminar o chefão depois das quatro ondas produz `VICTORY`;
- chegar a zero de vida produz `GAME_OVER`;
- um contato não letal do chefão causa 10 de dano, não pontua e reagenda o
  confronto com a resistência restaurada;
- um estado terminal interrompe novas atualizações, cargas e disparos;
- a tela final mostra nome do jogador, resultado, pontuação e cenário;
- **Jogar novamente** descarta os recursos atuais e inicia uma sessão limpa.

## Arquivos envolvidos

- `client/src/gameplay/GameStateManager.js` — estado global e transições
  terminais;
- `client/src/gameplay/WaveManager.js` — reagendamento do chefão após contato
  não letal;
- `client/src/core/GameSession.js` — coordenação entre vida, ondas, pontuação e
  estado global;
- `client/src/result-screen.js` — normalização do nome e descrição do resultado;
- `client/src/main.js`, `client/index.html` e `client/src/styles.css` — tela final
  e replay;
- testes unitários e de integração da Fase 15;
- README, arquitetura, decisões, API e estratégia de testes.

## Implementação

### Dois níveis de estado

`GameStateManager` mantém somente o estado causal da partida:

```text
PLAYING ──> VICTORY
    │
    └────> GAME_OVER
```

`WaveManager` continua responsável por `active`, `between-enemies`,
`between-waves`, `boss-pending`, `boss` e `complete`. Esses valores descrevem a
progressão do confronto, não o resultado do jogador.

As transições terminais são idempotentes: depois de vitória ou derrota, novas
sincronizações não publicam outro resultado. `GameSession` também deixa de
atualizar o gameplay e rejeita novas tentativas de carregar ou disparar.

### Vitória

A vitória exige simultaneamente:

1. `WaveManager` concluído;
2. inimigo atual identificado como `boss`;
3. desfecho do inimigo igual a `eliminated`;
4. vida do jogador acima de zero.

A pontuação é processada antes do estado global. Por isso, o placar apresentado
na tela já inclui 2.000 pontos pela eliminação do chefão e 1.000 pela conclusão
da fase, além das recompensas anteriores.

### Derrota e novo confronto com o chefão

A única condição de derrota é vida igual a zero. Ela tem precedência durante a
resolução de um contato.

Se o chefão alcançar o jogador e ainda restar vida, `WaveManager.retryBoss()`
retorna a `boss-pending`. Após a espera configurada de 3 segundos, a mesma
entidade 3D reaparece com resistência 10. O contato não concede pontos do
chefão nem da fase.

### Tela de resultados e replay

O nome informado é aparado, tem espaços repetidos reduzidos e fica limitado a
24 caracteres. Um valor vazio usa **Jogador**. A tela recebe dados consolidados
da sessão e apresenta:

- nome do jogador;
- Vitória ou Derrota;
- pontuação final;
- cenário Neve;
- ação **Jogar novamente**.

O replay não reaproveita sistemas encerrados. Ele descarta aplicação, controles,
sessão e recursos gráficos e então percorre novamente o fluxo normal de criação.
Vida, placar, ondas e estado global começam nos valores iniciais.

## O que não faz parte desta fase

- itens de recuperação ou munição especial;
- duração da partida;
- envio do resultado à API;
- persistência MySQL e ranking;
- WebXR ou HUD imersivo.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL continua opcional.

## Como testar manualmente

### Vitória

1. Confirme **Fase 15 concluída** na página inicial, use **Verificar API** e
   confira `phase: 15`.
2. Informe um nome e pressione **Iniciar partida**.
3. Complete os 18 encontros das quatro ondas.
4. Aguarde o chefão, acerte nove vezes e confirme que ele continua ativo.
5. Acerte pela décima vez e confirme os bônus de 2.000 e 1.000 pontos.
6. Confirme a tela **Vitória!** com nome, resultado, pontuação e cenário Neve.
7. Tente clicar ou disparar sobre a arena e confirme que o gameplay não avança.
8. Pressione **Jogar novamente** e confirme vida 100, placar zero e onda 1.

### Derrota

1. Inicie outra partida e avance pelas quatro ondas.
2. No chefão, não dispare e permita o contato.
3. Se ainda houver vida, confirme a perda de 10 pontos, ausência de bônus e o
   retorno do chefão após cerca de 3 segundos com resistência 10.
4. Repita os contatos até a vida chegar a zero.
5. Confirme a tela **Fim de jogo** com resultado Derrota e o placar preservado.
6. Pressione **Jogar novamente** e confirme uma nova sessão sem estado residual.

Ao final dos dois roteiros, confira o Console sem erros não tratados e repita três
ciclos de replay para verificar que canvas, listeners e controles não se
duplicam.

## Testes automatizados esperados

```powershell
npm run check
```

Os testes cobrem resolução e imutabilidade dos estados, transições terminais
únicas, precedência da derrota, reagendamento do chefão, ordem da pontuação,
bloqueio pós-resultado, normalização do nome, descrição da tela, replay,
metadados, API e regressões das fases anteriores.

## Critérios de aceite

- [ ] Existe somente uma transição global de `PLAYING` para um resultado final.
- [ ] Vida zero produz `GAME_OVER` e nenhum novo encontro é processado.
- [ ] Eliminar o chefão produz `VICTORY` depois da pontuação final.
- [ ] Contato não letal do chefão o reagenda com resistência cheia e sem bônus.
- [ ] A tela final mostra nome, resultado, pontuação e cenário.
- [ ] Nome vazio usa **Jogador** e entradas longas respeitam o limite.
- [ ] O estado terminal bloqueia atualizações, cargas e disparos.
- [ ] Replay cria uma sessão limpa sem duplicar recursos ou listeners.
- [ ] Persistência, ranking, itens e WebXR não foram antecipados.
- [ ] `npm run check` termina sem falhas.

## Próximo passo

A Fase 16 adicionará itens de recuperação de vida e uma munição especial com
spawn aleatório por onda.
