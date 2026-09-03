# Fase 13 — Chefão de gelo

## Objetivo da etapa

Adicionar um confronto final após as quatro ondas, com identidade visual e
parâmetros próprios, preservando as regras de tiro, colisão, dano e vida.

## Resultado esperado

Depois do 18º inimigo normal, a sessão aguarda 3 segundos e apresenta um chefão
de gelo gigante. Ele possui:

| Propriedade | Valor |
| --- | ---: |
| Resistência | 10 acertos |
| Dano por contato | 10 |
| Velocidade | 0,85 |
| Escala visual | 2,35 |
| Raio do collider | 2,20 |
| Altura de spawn | 2,20 |

Existe no máximo uma entidade hostil ativa. O chefão reutiliza o monstro já
criado, mas recebe descritor, resistência, dano, escala, collider, velocidade e
altura próprios.

## Arquivos envolvidos

- `client/src/config/gameplay-config.js` — perfil e intervalo do chefão;
- `client/src/gameplay/WaveManager.js` — transição após a quarta onda;
- `client/src/gameplay/EnemySystem.js` — aplicação do perfil dedicado;
- `client/src/core/GameSession.js` — coordenação do spawn e do dano;
- `client/src/main.js`, `client/index.html` e `client/src/styles.css` — HUD;
- testes de `WaveManager`, `GameSession`, HUD, metadados e API;
- README, arquitetura, decisões e estratégia de testes.

## Implementação

O final da progressão passa a seguir:

```text
active (último inimigo da onda 4)
  └── boss-pending ── 3 s ──> boss
                                 └── desfecho ──> complete
```

`WaveManager.update()` informa `spawnKind: "enemy"` para inimigos normais e
`spawnKind: "boss"` para o confronto final. Ao receber o segundo valor,
`GameSession` chama o reset da entidade com o perfil completo do chefão. Os
recursos gráficos permanecem compartilhados; apenas escala, posição, estado e
parâmetros de gameplay são restaurados.

Um impacto válido continua causando um ponto de resistência. Portanto, o chefão
permanece ativo após nove impactos e é eliminado no décimo. Caso o contato com o
jogador ocorra primeiro, a vida perde 10 pontos exatamente uma vez.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL continua opcional.

## Como testar manualmente

1. Confirme **Fase 13 concluída** na página inicial.
2. Pressione **Verificar API** e confirme `phase: 13`.
3. Abra a cena e conclua os 18 inimigos das quatro ondas.
4. Confirme a mensagem **O chefão de gelo surge em instantes**.
5. Aguarde cerca de 3 segundos e verifique o modelo gigante e o HUD
   **Chefão final · 10 acertos**.
6. Acerte nove projéteis; o HUD deve chegar a 1 / 10 sem remover o chefão.
7. Acerte o décimo projétil e confirme **Chefão derrotado** sem novo spawn.
8. Inicie outra sessão, complete as ondas e permita que o chefão alcance o
   jogador; a vida deve cair 10 pontos uma única vez.
9. Saia e entre novamente; a sessão deve retornar à onda 1 e vida 100.
10. Confirme o Console sem erros não tratados.

## Testes automatizados esperados

```powershell
npm run check
```

Os testes cobrem perfil, validação, intervalos, transição de estados, 10 impactos,
dano 10, reutilização de recursos, HUD, API e regressões das ondas anteriores.

## Critérios de aceite

- [ ] O chefão surge somente depois das quatro ondas.
- [ ] A espera anterior ao chefão é configurável e vale 3 segundos.
- [ ] O chefão é visualmente gigante e possui collider próprio.
- [ ] São necessários exatamente 10 impactos válidos para eliminá-lo.
- [ ] O contato causa exatamente 10 de dano uma única vez.
- [ ] A vida anterior é preservada durante o confronto.
- [ ] A entidade e os recursos gráficos existentes são reutilizados.
- [ ] O HUD identifica o chefão e sua resistência.
- [ ] Não há novo spawn após o desfecho final.
- [ ] Pontuação, vitória, derrota e WebXR não foram antecipados.
- [ ] `npm run check` termina sem falhas.

## Problemas possíveis

- A sequência manual completa pode demorar; os testes de integração usam ondas
  reduzidas para validar a mesma transição rapidamente.
- O raio visual e o collider são configurados separadamente para permitir ajustes
  de balanceamento sem acoplar colisão à geometria low-poly.
- O aviso de bundle do Three.js acima de 500 kB continua não bloqueante.

## Próximo passo

A Fase 14 introduzirá pontuação para inimigos normais e para o chefão.
