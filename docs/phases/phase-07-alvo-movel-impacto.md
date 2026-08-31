# Fase 7 — Alvo móvel e feedback de impacto

## Objetivo

Evoluir o alvo estático da Fase 6 para um volume móvel e confirmar que projétil
e alvo podem se cruzar entre frames sem perder o impacto. Cada acerto também
deve produzir um feedback 3D curto no centro do projétil no primeiro contato.

## Escopo entregue

- patrulha horizontal senoidal do mesmo alvo de treinamento;
- movimento entre `x = -4,5` e `x = 4,5`;
- velocidade linear de referência `1,6` e rotação visual `0,85 rad/s`;
- posição anterior e atual do alvo preservadas por frame;
- colisão contínua entre duas esferas móveis por movimento relativo;
- congelamento do alvo na fração exata do frame do impacto fatal;
- burst 3D branco no centro do projétil no primeiro contato;
- feedback com duração de `0,32 s` e limite FIFO de 12 bursts;
- HUD e textos atualizados para o alvo móvel;
- versão `0.7.0` no cliente, servidor e diagnóstico da API.

## Fora do escopo

A Fase 7 ainda não cria inimigo hostil, ataque, vida do jogador, respawn, ondas,
pontuação, itens, resultados, persistência MySQL, ranking ou WebXR.

## Parâmetros canônicos

| Regra | Valor |
|---|---:|
| Limite esquerdo | x = -4,5 |
| Limite direito | x = 4,5 |
| Velocidade de referência | 1,6 |
| Direção inicial | esquerda (-1) |
| Rotação visual | 0,85 rad/s |
| Duração do burst | 0,32 s |
| Escala inicial/final | 0,18 / 0,72 |
| Máximo de bursts | 12 |
| Cor do burst | branco |

## Movimento senoidal

O alvo calcula sua posição a partir do tempo total da sessão, não somando
pequenos deslocamentos por frame. Assim, um passo de 1 segundo produz o mesmo
resultado que quatro passos de 0,25 segundo.

```text
x = centro + amplitude × sen(fase inicial + velocidade angular × tempo)
```

A senoide evita a mudança brusca de direção de um ping-pong linear. Quando o
alvo chega a 0 PV, o movimento para no ponto interpolado do contato fatal.

## Colisão relativa

Para o mesmo intervalo normalizado do frame:

```text
início relativo = projectileStart - targetStart
fim relativo    = projectileEnd   - targetEnd
```

O `CollisionSystem` testa esse segmento contra uma esfera na origem com raio
`projectileRadius + targetRadius`. Quando existe acerto, o mesmo `t` interpola
os centros mundiais do projétil e do alvo. As entradas originais não são
modificadas.

## Feedback de impacto

`ImpactFeedbackSystem` cria um icosaedro wireframe branco no centro do projétil
no instante do contato. Durante 0,32 segundo, o burst expande, gira e perde
opacidade. A geometria é compartilhada; cada material é descartado ao expirar.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL é opcional nesta etapa e pode aparecer
como `not-configured` no diagnóstico.

## Como testar

1. Confirme **Fase 7 concluída** na página inicial.
2. Pressione **Verificar API** e confirme que a resposta informa `phase: 7`.
3. Pressione **Abrir cena 3D**.
4. Observe o alvo patrulhando suavemente de um lado para o outro.
5. Confirme que ele desacelera visualmente perto dos limites, sem quina abrupta.
6. Pressione **Ativar mira** e acompanhe o alvo com o retículo.
7. Carregue o estilingue e solte; confirme um burst branco onde a bola o atinge.
8. Repita até observar no HUD `100 → 75 → 50 → 25 → 0`.
9. No quarto impacto, confirme que o alvo para no local do contato e não volta a
   se mover.
10. Dispare fora do alvo e confirme ausência de dano e de burst.
11. Aguarde após um impacto e confirme que o burst desaparece rapidamente.
12. Saia com `Esc`, volte ao menu e repita três ciclos. Cada nova sessão deve
    começar com alvo em 100 PV, em movimento, sem bursts antigos.
13. Confirme no Console do navegador que não existem erros não tratados.

## Testes automatizados

```powershell
npm run check
```

A cobertura acrescentada inclui:

- movimento senoidal independente da subdivisão dos frames;
- limites, direção, rotação, reset e paralisação após destruição;
- interpolação do alvo na fração fatal do frame;
- alvo atravessando um projétil quase parado;
- ausência de falso positivo em movimentos relativos paralelos;
- centros mundiais independentes e preservação das entradas;
- criação, animação, expiração, limite FIFO e descarte dos bursts;
- ordem `Slingshot → Target → ImpactFeedback → Projectile`;
- integração de dano, consumo, feedback e descarte de sessão.

## Critérios de aceite

- [ ] O alvo se mantém dentro de `-4,5 ≤ x ≤ 4,5`.
- [ ] A patrulha é contínua e não depende da taxa de frames.
- [ ] Um cruzamento entre alvo e projétil registra o impacto.
- [ ] Um movimento paralelo distante não gera colisão falsa.
- [ ] Cada acerto válido cria exatamente um burst e causa 25 de dano.
- [ ] Um disparo errado não cria burst nem altera a vida.
- [ ] O burst expira e libera seu material.
- [ ] O impacto fatal congela o alvo e não duplica a destruição.
- [ ] Três reinícios não deixam alvo, bursts, canvas ou listeners residuais.
- [ ] `npm run check` termina sem falhas.

## Solução de problemas

- Para compensar a gravidade, use carga máxima e mire levemente acima do centro.
- Se o alvo sair do retículo, mantenha o mouse acompanhando a patrulha antes de
  soltar o disparo.
- Se **Ativar mira** estiver indisponível, teste em navegador desktop com suporte
  a Pointer Lock.
- `database.status = not-configured` continua sendo esperado sem `.env` MySQL.

## Próximo incremento

A Fase 8 deverá definir o primeiro inimigo hostil, sua aproximação e o contato
com o jogador sobre os sistemas agora validados. Ondas, pontuação, ranking e
WebXR ainda devem permanecer fora desse passo.
