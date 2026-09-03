# Fase 14 — Pontuação

## Objetivo da etapa

Adicionar um `ScoreManager` independente e idempotente, pontuando os eventos já
existentes da partida sem antecipar as telas de vitória e derrota.

## Resultado esperado

| Evento | Pontos |
| --- | ---: |
| Monstro fraco eliminado | 100 |
| Monstro médio eliminado | 250 |
| Monstro resistente eliminado | 500 |
| Onda concluída | 500 |
| Chefão eliminado | 2.000 |
| Fase concluída | 1.000 |

Os valores ficam em `GAMEPLAY_CONFIG.score`. O placar começa em zero em cada
sessão, aparece junto à vida do jogador e informa a última recompensa concedida.

## Arquivos envolvidos

- `client/src/config/gameplay-config.js` — valores de balanceamento;
- `client/src/gameplay/ScoreManager.js` — estado, eventos e deduplicação;
- `client/src/core/GameSession.js` — tradução dos desfechos em pontuação;
- `client/src/score-hud.js` — descrição pura do placar;
- `client/src/main.js`, `client/index.html` e `client/src/styles.css` — HUD;
- testes unitários e de integração da Fase 14;
- README, arquitetura, decisões e estratégia de testes.

## Implementação

Cada evento recebe uma identidade estável:

```text
enemy:<onda>:<inimigo>
wave:<onda>:completed
boss:eliminated
phase:completed
```

Antes de adicionar pontos, `ScoreManager` consulta um `Set` com os IDs já
processados. Um ID repetido retorna `false`, não altera o placar e não publica
outro callback. O estado e o último evento são snapshots imutáveis.

`GameSession` registra o estado do encontro antes de avançar a onda. Uma
eliminação normal vale os pontos do tipo; concluir o último encontro normal vale
também 500 pontos da onda. Contato não vale eliminação, embora o fim do último
encontro ainda conclua a onda. Eliminar o chefão concede 2.000 pontos e mais
1.000 pela fase; contato do chefão não concede esses bônus.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL continua opcional.

## Como testar manualmente

1. Confirme **Fase 14 concluída** na página inicial.
2. Pressione **Verificar API** e confirme `phase: 14`.
3. Abra a cena e confira **Pontuação 0**.
4. Elimine um Fraco e confirme **+100 · Monstro fraco eliminado**.
5. Elimine tipos Médio e Resistente e confira respectivamente +250 e +500.
6. No fim de cada onda, confirme o bônus adicional **+500 · Onda concluída**.
7. Permita um contato e confirme que não entram pontos de eliminação.
8. Elimine o chefão e confirme +2.000, seguido de +1.000 pela fase.
9. Em outra sessão, permita o contato do chefão e confirme que esses dois bônus
   não são concedidos.
10. Saia e entre novamente; o placar deve retornar a zero.
11. Confirme que ainda não existem telas de vitória ou derrota.
12. Confirme o Console sem erros não tratados.

## Testes automatizados esperados

```powershell
npm run check
```

Os testes cobrem configuração, valores, deduplicação, callbacks, lifecycle,
integração com ondas e chefão, HUD, API e regressões anteriores.

## Critérios de aceite

- [ ] Todos os valores definidos no roteiro estão centralizados.
- [ ] Cada eliminação normal concede os pontos do seu tipo.
- [ ] Cada uma das quatro ondas concede 500 pontos uma única vez.
- [ ] Contato não concede pontos de eliminação.
- [ ] Eliminar o chefão concede 2.000 pontos.
- [ ] A fase concluída concede mais 1.000 pontos.
- [ ] O contato do chefão não concede os bônus finais.
- [ ] Eventos duplicados não alteram o total nem notificam o HUD.
- [ ] Uma falha de observador não desfaz pontos já aplicados.
- [ ] O placar começa em zero em uma nova sessão.
- [ ] Vitória e derrota não foram antecipadas.
- [ ] `npm run check` termina sem falhas.

## Próximo passo

A Fase 15 criará a lógica e as telas de vitória e derrota.
