# Fase 22 — WebXR

## Objetivo da etapa

Adicionar entrada em `immersive-vr` e permitir que a partida existente seja
jogada com dois controles rastreados, preservando integralmente o modo desktop.

## Resultado esperado

- o botão de VR só é habilitado após a confirmação de suporte do navegador;
- dispositivos sem WebXR continuam jogando com mouse e Pointer Lock;
- uma sessão `immersive-vr` usa o espaço de referência `local-floor`;
- a mão esquerda posiciona o estilingue e a direita puxa a munição;
- a distância entre as mãos define a tensão de 0% a 100%;
- a direção do tiro vai da mão que puxa em direção à mão do estilingue;
- o disparo XR usa o mesmo `ProjectileSystem`, colisões, dano e pontuação do desktop;
- encerrar a sessão restaura os controles convencionais sem reiniciar a partida.

## Arquivos envolvidos

- `client/src/xr/XRSessionManager.js`: detecção e ciclo da sessão imersiva;
- `client/src/xr/XRSlingshotController.js`: rastreamento, tensão e pose do tiro;
- `client/src/gameplay/SlingshotSystem.js`: carga manual e pose externa;
- `client/src/core/GameSession.js`: fronteira comum para entradas desktop e XR;
- `client/src/core/GameApp.js`: atualização do adaptador XR no loop existente;
- `client/src/core/RenderContext.js`: ativação WebXR no renderer;
- `client/src/main.js`, `client/index.html` e `client/src/styles.css`: composição,
  botão e feedback de suporte;
- testes `*.test.js`: contratos de sessão, controles, carga e regressão;
- `README.md` e documentação técnica: execução e limitações.

## Implementação

O `XRSessionManager` consulta
`navigator.xr.isSessionSupported('immersive-vr')` antes de oferecer a entrada.
Quando autorizada, a sessão é associada ao `WebGLRenderer`; o mesmo
`setAnimationLoop` passa a receber frames do headset.

O `XRSlingshotController` observa dois `XRTargetRaySpace`. O gatilho direito
inicia uma carga manual. A cada frame, o sistema mede a distância entre os
controles e a normaliza entre 0,12 m e 0,72 m. Ao soltar, entrega origem,
direção e tensão ao `GameSession`.

O `SlingshotSystem` continua usando carga por tempo e pose da câmera no desktop.
No modo manual, aceita a tensão rastreada e uma pose externa validada. Depois
desse ponto, os dois modos percorrem exatamente o mesmo fluxo de projétil,
gravidade, colisão, itens, inimigos e pontuação.

## Como executar

```bash
npm install
npm run dev
```

O modo convencional funciona em `http://127.0.0.1:5173`. Para um headset em
outro dispositivo, sirva a aplicação por HTTPS em uma URL acessível na mesma
rede ou publique-a em uma origem segura.

## Como testar manualmente

### Fallback convencional

1. Abra a aplicação em um navegador sem `immersive-vr`.
2. Inicie a partida.
3. Confirme **VR indisponível** e o motivo apresentado ao lado do botão.
4. Ative a mira e confirme que mirar, carregar e disparar com o mouse continuam
   funcionando.

### Headset compatível

1. Abra a URL HTTPS no navegador do headset e inicie a partida.
2. Aguarde **WebXR disponível** e pressione **Entrar em VR**.
3. Autorize a sessão e conecte os dois controles.
4. Mantenha o controle esquerdo à frente do corpo.
5. Pressione o gatilho direito e afaste a mão direita para trás.
6. Confirme a munição e os elásticos entre as mãos e varie a distância.
7. Solte o gatilho; confirme que a bola parte do estilingue na direção oposta
   ao movimento de puxada.
8. Acerte um inimigo e um item; confirme colisão, dano e efeito normais.
9. Encerre a sessão XR e confirme que a mesma partida retorna ao mouse.
10. Conclua ou perca a partida e confirme o resultado e o ranking no monitor.

### Verificação automatizada

```bash
npm run check
```

## Problemas possíveis

- WebXR exige contexto seguro; uma URL HTTP comum não libera `navigator.xr`;
- o navegador pode informar suporte e ainda negar a sessão por permissão;
- somente um controle não arma o disparo de duas mãos;
- o HUD atual é HTML e não é projetado dentro do headset;
- escala, conforto e ergonomia precisam de validação física no Meta Quest 3.

## Próximo passo

Fase 23: executar a matriz de testes no Meta Quest 3, medir desempenho e ajustar
escala, conforto, direção do disparo e alcance com base no uso real.
