# Fase 12 — Quatro ondas

## Objetivo da etapa

Substituir o ciclo curto da fase 11 por quatro ondas configuráveis, aumentando
gradualmente quantidade, variedade e velocidade sem alterar as regras já
validadas de tiro, colisão, dano e vida.

## Resultado esperado

| Onda | Quantidade | Tipos permitidos | Velocidade | Intervalo |
| ---: | ---------: | ---------------- | ----------: | --------: |
| 1 | 3 | Fraco | 1,15 | 1,25 s |
| 2 | 4 | Fraco, Médio | 1,25 | 1,10 s |
| 3 | 5 | Fraco, Médio, Resistente | 1,40 | 0,95 s |
| 4 | 6 | Fraco, Médio, Resistente | 1,60 | 0,80 s |

Entre ondas existe uma pausa de 2,50 segundos. A sessão contém 18 inimigos no
total e mantém no máximo um ativo por vez.

## Arquivos envolvidos

- `client/src/config/gameplay-config.js` — balanceamento das ondas;
- `client/src/gameplay/WaveManager.js` — progressão e intervalos;
- `client/src/gameplay/EnemySystem.js` — tipo e velocidade por spawn;
- `client/src/core/GameSession.js` — coordenação com gameplay;
- `client/src/main.js`, `client/index.html` e `client/src/styles.css` — HUD;
- `WaveManager.test.js` e `GameSession.phase12.test.js` — cobertura nova;
- README, arquitetura, decisões e estratégia de testes.

## Implementação

`WaveManager` mantém quatro estados:

```text
active → between-enemies → active
active → between-waves   → active
active → complete
```

Cada snapshot informa onda atual, total de ondas, inimigo atual, quantidade da
onda, estado, intervalo restante, velocidade e IDs de tipos permitidos.

Quando um intervalo termina, `GameSession` obtém `spawnSettings` e chama:

```javascript
enemySystem.reset({
  rerollType: true,
  moveSpeed,
  typeIds,
});
```

A entidade conserva suas geometrias e materiais, mas recebe novo tipo,
resistência, velocidade e posição.

## Explicação

O gerenciador de ondas não conhece Three.js, interface ou vida. Essa separação
permite testar toda a progressão sem renderer e evita espalhar contadores pela
sessão e pelo HUD.

A quantidade e velocidade aumentam enquanto o intervalo diminui. Os valores são
um ponto inicial de balanceamento e deverão ser ajustados depois de testes reais.
Spawns simultâneos não foram introduzidos para manter o recorte previsível e
reutilizar a entidade criada na fase 11.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL continua opcional.

## Como testar manualmente

1. Confirme **Fase 12 concluída** na página inicial.
2. Pressione **Verificar API** e confirme `phase: 12`.
3. Abra a cena e confira **Onda 1 de 4 · Inimigo 1 de 3**.
4. Elimine ou permita o contato dos três inimigos; todos devem ser Fracos.
5. Confirme a pausa de aproximadamente 2,50 segundos antes da onda 2.
6. Na onda 2, confirme quatro inimigos e possíveis tipos Fraco/Médio.
7. Nas ondas 3 e 4, confirme que o Resistente também pode aparecer.
8. Observe que os inimigos ficam progressivamente mais rápidos.
9. Provoque contatos e confirme que a vida reduzida permanece nas ondas seguintes.
10. Após o sexto inimigo da onda 4, confirme “As quatro ondas foram concluídas”.
11. Aguarde e confirme que não surge uma quinta onda ou outro inimigo.
12. Saia e entre novamente; a sessão deve retornar à onda 1 e vida 100.
13. Confirme o Console sem erros não tratados.

## Testes automatizados esperados

```powershell
npm run check
```

Os testes cobrem configuração, estados, intervalos, progressão, pausa, tipos,
velocidades, reutilização de recursos, vida persistente, HUD, API e regressões.

## Critérios de aceite

- [ ] Existem exatamente quatro ondas configuradas.
- [ ] As quantidades são 3, 4, 5 e 6.
- [ ] A composição de tipos segue a progressão definida.
- [ ] Velocidade e intervalo são específicos de cada onda.
- [ ] A pausa entre ondas é distinta do intervalo entre inimigos.
- [ ] Há no máximo um inimigo ativo por vez.
- [ ] Tipo, resistência, velocidade e spawn são atualizados no respawn.
- [ ] A vida persiste entre todas as ondas.
- [ ] O HUD apresenta onda e inimigo atuais.
- [ ] A quarta onda termina sem criar outra entidade.
- [ ] Chefão, pontuação, derrota e WebXR não foram antecipados.
- [ ] `npm run check` termina sem falhas.

## Problemas possíveis

- Sorteios aleatórios podem repetir o mesmo tipo várias vezes dentro da faixa
  permitida; isso não viola a composição da onda.
- A sequência completa pode levar alguns minutos se todos os inimigos forem
  aguardados até o contato.
- O aviso de bundle do Three.js acima de 500 kB continua não bloqueante.

## Próximo passo

A Fase 13 criará o chefão de gelo com escala gigante, 10 acertos de resistência
e 10 pontos de dano.

