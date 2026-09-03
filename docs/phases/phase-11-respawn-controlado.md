# Fase 11 — Respawn controlado

## Objetivo da etapa

Transformar o encontro único das fases anteriores em um ciclo curto e testável
de três inimigos sequenciais. Este incremento valida respawn e persistência da
vida antes da implementação das quatro ondas completas.

## Resultado esperado

- a sessão inicia no encontro 1 de 3;
- existe no máximo um inimigo ativo por vez;
- eliminação ou contato remove o inimigo imediatamente;
- o próximo inimigo surge após 1,25 segundo;
- cada respawn sorteia novamente tipo e posição;
- a entidade 3D e seus recursos são reutilizados;
- a vida atual permanece entre os encontros;
- depois do terceiro desfecho, o ciclo termina sem um quarto spawn.

## Arquivos envolvidos

- `client/src/config/gameplay-config.js` — quantidade e intervalo;
- `client/src/core/GameSession.js` — progressão e cronômetro;
- `client/src/gameplay/EnemySystem.js` — reset com sorteio opcional;
- `client/src/main.js` e `client/index.html` — progresso no HUD;
- `client/src/core/GameSession.phase11.test.js` — testes do ciclo;
- metadados, README e documentação técnica.

## Implementação

`GAMEPLAY_CONFIG.encounter` define `enemyCount: 3` e
`respawnDelaySeconds: 1.25`. `GameSession` expõe um snapshot imutável:

```text
{
  current: 1..3,
  total: 3,
  status: active | waiting | complete,
  respawnDelaySeconds: número
}
```

Ao receber `eliminated` ou `player-contact`, a sessão avança para `waiting` ou,
no terceiro encontro, para `complete`. Quando a espera termina,
`EnemySystem.reset({ rerollType: true })` restaura a resistência, sorteia tipo e
spawn e anexa novamente a mesma entidade à cena.

O `PlayerHealthSystem` não é recriado nem resetado. Assim, qualquer dano sofrido
continua visível no encontro seguinte.

## Explicação

O reset padrão continua preservando o tipo para não quebrar o contrato das fases
anteriores. O novo sorteio é explícito apenas no respawn. Isso permite reutilizar
geometrias e materiais, evitando criação e descarte repetidos a cada inimigo.

O cronômetro é pausado quando o encontro está desabilitado. Se um frame ultrapassa
o fim da espera, somente o tempo excedente é aplicado ao movimento do novo
inimigo; ele não avança durante o período em que ainda estava invisível.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL continua opcional nesta fase.

## Como testar manualmente

1. Confirme **Fase 11 concluída** na página inicial.
2. Pressione **Verificar API** e confirme `phase: 11`.
3. Abra a cena e confirme **Encontro 1 de 3**.
4. Elimine o inimigo ou deixe-o alcançar o jogador.
5. Confirme que ele desaparece e outro surge após cerca de 1,25 segundo.
6. Confirme **Encontro 2 de 3**, nova posição e tipo sorteado.
7. Se houve contato, confirme que a vida reduzida não voltou para 100.
8. Repita para o encontro 3.
9. Após o terceiro desfecho, confirme a mensagem de ciclo concluído.
10. Aguarde alguns segundos e confirme que não existe quarto respawn.
11. Saia e entre novamente; a nova sessão deve recomeçar em 1 de 3 e 100 de vida.
12. Confirme o Console sem erros não tratados.

## Testes automatizados esperados

```powershell
npm run check
```

A cobertura inclui configuração inválida, estados do ciclo, limite de três
encontros, intervalo de respawn, novo sorteio de tipo, persistência da vida, HUD,
metadados, API e regressões das fases anteriores.

## Critérios de aceite

- [ ] A configuração do ciclo está centralizada e imutável.
- [ ] Há no máximo um inimigo ativo.
- [ ] O respawn respeita 1,25 segundo.
- [ ] Tipo e spawn são sorteados novamente.
- [ ] A entidade e seus recursos visuais são reutilizados.
- [ ] A vida é preservada entre encontros.
- [ ] O HUD mostra o encontro atual.
- [ ] O ciclo termina exatamente no terceiro desfecho.
- [ ] Não há ondas completas, pontuação, chefão, derrota ou WebXR antecipados.
- [ ] `npm run check` termina sem falhas.

## Problemas possíveis

- Os três sorteios podem produzir o mesmo tipo; isso é válido em uma seleção
  aleatória uniforme.
- Um projétil antigo pode continuar sua trajetória durante a espera; ele só
  interage com um inimigo quando houver entidade ativa novamente.
- Sem `DATABASE_URL`, `database.status = not-configured` continua esperado.

## Próximo passo

A Fase 12 implementará quatro ondas configuráveis, com quantidade, composição de
tipos, velocidade e intervalo próprios. Chefão e pontuação permanecem posteriores.

