# Estratégia de testes

## Definição de pronto de um incremento

Cada fase deve entregar:

- comportamento executável;
- teste automatizado da lógica apropriada;
- procedimento manual reproduzível;
- build sem erro;
- console sem erros não tratados;
- documentação afetada atualizada.

## Fase 1

### Testes automatizados

```bash
npm test
```

Os testes atuais verificam:

- nome, cenário e quatro integrantes aprovados;
- imutabilidade da lista de integrantes;
- distinção entre API indisponível e somente MySQL indisponível;
- `GET /api/health` sem banco configurado;
- retorno `503` quando o MySQL configurado está indisponível;
- erro JSON `404` para uma rota desconhecida da API;
- respostas controladas para JSON malformado, payload maior que 16 KB e
  codificação não suportada;
- rejeição de portas inválidas na configuração.

### Build

```bash
npm run build
```

### Verificação completa

```bash
npm run check
```

### Teste manual de regressão da base

1. Execute `npm run dev`.
2. Abra `http://localhost:5173`.
3. Confirme título, cenário e os quatro integrantes.
4. Pressione **Verificar API**.
5. Confirme a mensagem “API online”.
6. Acesse `http://127.0.0.1:3000/api/health`.
7. Sem `DATABASE_URL`, confirme `database.status = not-configured`.

## Fase 2

### Cobertura automatizada adicionada

- dimensões e proporção do viewport;
- limite do pixel ratio;
- atualização coordenada de câmera e renderer;
- idempotência de `GameApp.start()`, `stop()` e `dispose()`;
- limite do delta após pausas longas;
- suspensão das atualizações quando a aba está oculta;
- descarte de observer, listener, geometrias, materiais, renderer e canvas;
- limpeza transacional quando a inicialização da cena falha parcialmente.

### Verificação manual resumida

1. Execute `npm run dev`.
2. Abra `http://127.0.0.1:5173/`.
3. Pressione **Abrir cena 3D**.
4. Confirme chão, grade, iluminação e objeto azul girando.
5. Redimensione a janela e confirme que a imagem não fica deformada.
6. Saia com `Esc`, entre novamente e confirme que existe somente um canvas.
7. Use **Verificar API** e confirme que a Fase 1 continua funcionando.

O roteiro detalhado, os resultados esperados e a solução de problemas estão em
[Fase 2 — Cena base Three.js](phases/phase-02-cena-threejs.md).

## Fase 3

### Cobertura automatizada adicionada

- composição da ilha, placas de gelo, pedras, montanhas e neve suspensa;
- obstáculos decorativos fora do raio livre do jogador;
- posições determinísticas das partículas dentro dos limites da arena;
- animação atmosférica proporcional ao delta e protegida contra delta negativo;
- encaminhamento do delta pelo `RenderContext` para o cenário;
- metadados e diagnóstico da API atualizados para a Fase 3.

### Verificação manual resumida

1. Execute `npm run dev`.
2. Abra `http://127.0.0.1:5173/` e confirme **Fase 3 concluída**.
3. Pressione **Abrir cena 3D**.
4. Confirme ilha clara, gelo azulado, pedras, montanhas, névoa e neve suspensa.
5. Confirme que não existe mais grade e que a área central está livre.
6. Redimensione a janela, saia com `Esc` e entre novamente três vezes.
7. Confirme um único canvas, animação estável e console sem erros.
8. Use **Verificar API** e confirme que o diagnóstico continua funcionando.

O roteiro completo está em
[Fase 3 — Protótipo do cenário de neve](phases/phase-03-cenario-neve.md).

## Fase 4

### Cobertura automatizada adicionada

- conexão, desconexão e descarte idempotentes do controle desktop;
- captura e liberação de Pointer Lock sem duplicar listeners;
- movimento do mouse ignorado enquanto o ponteiro está livre;
- conversão da sensibilidade padrão em rotação da câmera;
- pitch limitado a ±85° e yaw sem clamp horizontal;
- posição da câmera preservada durante qualquer rotação;
- fallback quando Pointer Lock não é suportado;
- lifecycle do controle coordenado por `GameApp` e rollback se o loop falhar;
- liberação do ponteiro quando a aba fica oculta;
- metadados e diagnóstico da API atualizados para a Fase 4.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 4 concluída**, abra a cena e ative a visão 360°.
3. Gire horizontalmente uma volta completa e teste os limites para cima e baixo.
4. Confirme que a câmera não se desloca e que cliques não disparam nada.
5. Pressione `Esc` uma vez para liberar o cursor e novamente para voltar ao menu.
6. Repita três ciclos de entrada e saída, verificando canvas e sensibilidade únicos.
7. Redimensione a janela, verifique a API e confirme o Console sem erros.

O roteiro completo está em
[Fase 4 — Observação em 360°](phases/phase-04-observacao-360.md).

## Fase 5

### Cobertura automatizada adicionada

- carga normalizada entre 0 e 1 e saturação após 1,2 segundo;
- início somente com o botão esquerdo e enquanto a mira está ativa;
- disparo ao soltar o botão, com cancelamento seguro quando a mira é liberada;
- conversão da carga em velocidade linear entre 10 e 24 unidades por segundo;
- criação do projétil na direção atual da câmera;
- delegação e ordem de atualização entre `GameSession`, `SlingshotSystem` e
  `ProjectileSystem`;
- trajetória atualizada com gravidade de -9,8;
- descarte no contato com o chão, após 5 segundos ou fora do raio horizontal 40;
- limite de 24 projéteis ativos, removendo o mais antigo;
- reinício do HUD após disparo, cancelamento e saída da cena;
- integração do ciclo de atualização e descarte com `GameApp`.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 5 concluída**, abra a cena e pressione **Ativar mira**.
3. Segure o botão esquerdo e confirme que o HUD cresce de 0% a 100% em cerca
   de 1,2 segundo.
4. Solte antes da carga máxima e observe um disparo mais lento; repita com 100%
   e observe um disparo mais rápido.
5. Mire para cima e para baixo e confirme que os projéteis seguem a mira e
   descrevem uma trajetória com gravidade.
6. Inicie uma carga e pressione `Esc`; confirme cancelamento, HUD em 0% e
   nenhum disparo involuntário.
7. Confirme que os projéteis desaparecem ao tocar o chão e que disparos
   repetidos não degradam progressivamente a cena.
8. Verifique que não há inimigos, dano, ondas, pontuação ou controles WebXR.
9. Repita três ciclos de entrada e saída e confirme um único canvas, HUD zerado
   e Console sem erros.
10. Use **Verificar API** para confirmar que a regressão cliente/API não mudou.

O roteiro completo e os critérios de aceite estão em
[Fase 5 — Disparo convencional](phases/phase-05-disparo-convencional.md).

## Fase 6

### Cobertura automatizada adicionada

- interseção segmento–esfera com tunneling, tangência e início interno;
- validação de vetores, raios e segmentos degenerados;
- raio combinado do projétil e do alvo;
- consumo do projétil antes das regras ambientais de descarte;
- vida `100 → 75 → 50 → 25 → 0`, sem valor negativo;
- uma única transição para destruído e dano ignorado depois dela;
- visual, reset, callbacks e descarte idempotente do alvo;
- integração entre `GameSession`, projétil, colisão e alvo;
- metadados e diagnóstico da API atualizados para a Fase 6.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 6 concluída**, abra a cena e localize o alvo azul.
3. Ative a mira e confirme quatro impactos de 25 pontos no HUD.
4. Erre um disparo e confirme que a vida não muda.
5. Após 0 PV, confirme que novos disparos não causam dano adicional.
6. Entre e saia três vezes; cada sessão deve recomeçar em 100 PV.
7. Verifique a API e confirme o Console sem erros.

O roteiro completo está em
[Fase 6 — Alvo, colisão e dano](phases/phase-06-alvo-colisao-dano.md).

## Fase 7

### Cobertura automatizada adicionada

- movimento senoidal determinístico para diferentes subdivisões de frame;
- limites horizontais, direção inicial, rotação, reset e parada terminal;
- preservação dos centros anterior e atual do alvo em coordenadas mundiais;
- colisão contínua entre duas esferas móveis por movimento relativo;
- cruzamento de um alvo rápido com um projétil quase parado;
- interpolação e congelamento do alvo na fração do impacto fatal;
- criação do burst no centro do projétil no primeiro contato;
- expansão, opacidade, expiração, limite FIFO e descarte dos feedbacks;
- ordem de atualização entre estilingue, alvo, feedback e projéteis;
- integração de dano, consumo do projétil, feedback e ciclo da sessão;
- metadados e diagnóstico da API atualizados para a Fase 7.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 7 concluída**, verifique a API e abra a cena 3D.
3. Observe a patrulha suave do alvo entre os dois limites horizontais.
4. Ative a mira, acompanhe o alvo e confirme um burst branco em cada acerto.
5. Confirme no HUD a sequência `100 → 75 → 50 → 25 → 0`.
6. No quarto impacto, confirme que o alvo para exatamente onde foi atingido.
7. Erre um disparo e confirme que não há dano nem burst.
8. Aguarde um efeito e confirme que ele desaparece rapidamente.
9. Repita três ciclos de entrada e saída; cada sessão deve iniciar limpa.
10. Confirme o Console sem erros e o diagnóstico com `phase: 7`.

O roteiro completo está em
[Fase 7 — Alvo móvel e feedback de impacto](phases/phase-07-alvo-movel-impacto.md).

## Estratégia futura

- testes unitários para vida e dano do jogador, estados, pontuação e ondas;
- testes de integração para contato inimigo–jogador e partida completa;
- testes de API e migrations com um banco MySQL isolado;
- E2E convencional para menu, vitória, derrota, ranking e replay;
- mocks WebXR apenas para lógica de entrada;
- checklist manual obrigatório no Meta Quest 3;
- profiling e testes de reinício prolongados para detectar vazamentos.
