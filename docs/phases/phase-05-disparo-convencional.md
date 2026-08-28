# Fase 5 — Disparo convencional

## Status

Concluída em 27 de agosto de 2026.

## Objetivo

Entregar o menor recorte jogável que valida o estilingue no navegador: ativar
a mira, carregar com o botão esquerdo, soltar para criar um projétil e acompanhar
sua trajetória até o descarte. A câmera e o jogador permanecem no centro da
arena de neve construída nas fases anteriores.

Esta fase reordena o roadmap original conforme aprovado na conversa de
continuidade. O fluxo de disparo foi separado de inimigos e ondas para permitir
testes e diagnóstico antes de acrescentar regras de combate.

## O que foi entregue

- entrada convencional baseada no botão esquerdo, ativa somente com Pointer Lock;
- carga normalizada de 0 a 1, atingindo 100% em 1,2 segundo;
- HUD HTML com `<progress>`, percentual `ratio * 100` e mensagens anunciadas por ARIA;
- instruções permanentes em três passos dentro da cena;
- velocidade de disparo proporcional à carga, de 10 a 24 unidades por segundo;
- projétil esférico de raio 0,18 seguindo a direção atual da câmera;
- trajetória com gravidade de -9,8;
- descarte ao tocar o chão em `y = 0,18`, após 5 segundos, fora do raio
  horizontal 40 ou ao exceder 24 projéteis ativos;
- cancelamento da carga ao liberar a mira, ocultar a página ou sair da cena;
- `DesktopFireController` isolando os eventos do mouse;
- `SlingshotSystem` isolando carga, direção, velocidade e callbacks do HUD;
- `GameSession` coordenando `SlingshotSystem` e `ProjectileSystem`;
- integração com o loop e o descarte já controlados por `GameApp`.

## Fora do escopo

A Fase 5 **não** inclui:

- inimigos ou alvos;
- detecção de acerto em alvos e aplicação de dano;
- vida do jogador, ondas, chefão ou itens;
- pontuação, resultados, MySQL ou ranking;
- estilingue modelado nas mãos;
- controles, HUD ou sessão WebXR.

O contato com o chão existe somente para remover o projétil. Não representa um
sistema genérico de colisão ou física.

## Controles

1. Pressione **Abrir cena 3D**.
2. Pressione **Ativar mira** para capturar o ponteiro.
3. Mova o mouse para definir a direção do disparo.
4. Segure o botão esquerdo para acumular tensão.
5. Solte o botão esquerdo para disparar.
6. Pressione `Esc` uma vez para cancelar uma carga e liberar o cursor.
7. Pressione `Esc` novamente, já com o cursor livre, para voltar ao menu.

## Como testar

### Preparação

Na raiz do projeto, instale as dependências e inicie cliente e API:

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/` em um navegador desktop com WebGL e Pointer Lock.
O MySQL não precisa estar configurado nesta fase.

### Roteiro manual principal

1. Confirme o selo **Fase 5 concluída** na tela inicial.
2. Pressione **Abrir cena 3D** e confirme arena, HUD de tensão e retículo.
3. Leia as três instruções no HUD e pressione **Ativar mira**.
4. Segure o botão esquerdo por aproximadamente meio segundo. Confirme que a
   barra e o percentual aumentam; solte e observe um projétil na direção da mira.
5. Repita segurando por pelo menos 1,2 segundo. Confirme 100% sem ultrapassar
   esse valor e observe velocidade maior que no disparo curto.
6. Mire para cima, dispare e confirme a queda causada pela gravidade. Mire para
   baixo e confirme o descarte quando a base do projétil toca o chão.
7. Comece outra carga, pressione `Esc` antes de soltar o mouse e confirme HUD em
   0%, cursor livre e ausência de disparo involuntário.
8. Reative a mira, dispare repetidamente e confirme que objetos antigos somem
   sem travamento nem crescimento indefinido de memória visual.
9. Pressione `Esc` para liberar a mira e novamente para voltar ao menu. Entre de
   novo e confirme HUD zerado, sensibilidade única e somente um canvas.
10. Redimensione a janela, alterne de aba durante uma carga e confirme retorno
    seguro, sem erros não tratados no Console.
11. Pressione **Verificar API** e confirme que a integração anterior continua
    respondendo.

### Verificação automatizada

Execute testes e build:

```bash
npm run check
```

Para executar apenas os testes:

```bash
npm test
```

## Critérios de aceite

- [ ] A cena só começa após ação explícita do usuário.
- [ ] A mira só captura o ponteiro após **Ativar mira**.
- [ ] Somente o botão esquerdo inicia uma carga.
- [ ] O HUD representa de 0% a 100% e fornece valor e estado acessíveis.
- [ ] A carga chega ao máximo em 1,2 segundo e permanece limitada.
- [ ] Soltar cria exatamente um projétil com velocidade proporcional à carga.
- [ ] A direção do disparo acompanha a mira sem mover o jogador.
- [ ] Gravidade e contato com o chão são visíveis e coerentes.
- [ ] Liberar a mira, ocultar a aba ou sair cancela a carga sem disparar.
- [ ] Projéteis expiram e o limite de 24 impede acúmulo indefinido.
- [ ] Entrar e sair repetidamente não duplica canvas, listeners ou sensibilidade.
- [ ] O build termina sem erro e o Console não apresenta erro não tratado.
- [ ] API e funcionalidades das Fases 1–4 continuam funcionando.
- [ ] Não há inimigos, dano, ondas, pontuação ou WebXR antecipados.

## Resultado esperado

Ao terminar o roteiro, o jogador deve conseguir executar repetidamente o fluxo
**ativar mira → segurar → acompanhar a carga → soltar → observar o projétil**.
O comportamento precisa permanecer previsível após cancelamentos e reentradas,
sem sugerir que os sistemas de combate ainda ausentes já estejam implementados.

## Solução de problemas

- Se **Ativar mira** estiver indisponível, use um navegador desktop com suporte
  a Pointer Lock e abra a página em uma janela ativa.
- Se a cena não abrir, confirme WebGL/aceleração de hardware e consulte o Console.
- Se o mouse não girar a câmera, clique em **Ativar mira** novamente; o navegador
  pode ter liberado o ponteiro ao trocar de aba.
- Se `npm run dev` informar porta ocupada, encerre a instância anterior antes de
  iniciar outra para evitar testar um build antigo.

## Próximo incremento

A Fase 6 deverá validar alvo, colisão e dano sobre este disparo antes de avançar
para ondas, pontuação, persistência ou WebXR. O escopo deve continuar pequeno e
ser aprovado antes da implementação.
