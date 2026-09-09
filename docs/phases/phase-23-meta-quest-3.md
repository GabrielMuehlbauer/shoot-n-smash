# Fase 23 — Validação no Meta Quest 3

## Estado da etapa

**Concluída em 8 de setembro de 2026.** O primeiro teste real revelou problemas
bloqueadores, as correções foram implementadas e o reteste no Meta Quest 3 foi
aprovado pela equipe.

A promoção foi consolidada na versão estável `0.24.0` junto com a Fase 24.

## Objetivo da etapa

Validar no dispositivo real escala, controles, conforto, mira, desempenho,
interface, chefão e tamanho dos objetos. Os resultados devem produzir evidência
repetível, não apenas uma impressão geral de que o jogo abriu.

## Instrumentação implementada

Cada sessão `immersive-vr` agora mede:

- dispositivo identificado pelo navegador;
- duração e quantidade de frames;
- FPS médio e menor janela de FPS;
- pior tempo de frame;
- percentual de frames acima de 20 ms;
- pico de draw calls;
- pico de triângulos;
- pico de geometrias e texturas na memória GPU a partir da Fase 25;
- controles detectados, lateralidade, perfil e tipo de raio.

O painel **Diagnóstico Quest 3** aparece no espelho do navegador durante a sessão
e preserva o resumo depois que o usuário sai do VR. As métricas são locais, não
são enviadas à API nem gravadas no banco.

## Primeiro ensaio físico e correções

O primeiro ensaio no Meta Quest identificou três problemas bloqueadores:

- o estilingue XR era representado apenas por uma haste vertical e não orientava
  o garfo pela linha formada entre as mãos;
- vida do jogador, resistência do inimigo e progresso da onda existiam apenas no
  HUD HTML do navegador, que não é renderizado em uma sessão imersiva;
- a retícula HTML e a previsão desktop também não estavam presentes no headset.

As correções implementadas para o reteste são:

- estilingue XR completo, com cabo, dois braços, elásticos independentes e origem
  do disparo no centro do garfo;
- orientação estável do garfo pela direção entre a munição e o controle do
  estilingue;
- marcador de mira visível quando os dois controles possuem uma pose válida;
- trajetória balística pontilhada durante a carga, incluindo munição especial;
- HUD 3D no campo de visão com vida, resistência, onda, inimigo e pontuação.

O HUD usa uma única textura de canvas e só é redesenhado quando o estado muda.
Isso evita criar texto ou geometria em cada frame no Quest 3.

## Arquivos envolvidos

- `client/src/xr/XRPerformanceMonitor.js`: coleta e consolida as métricas;
- `client/src/core/GameApp.js`: entrega o intervalo real depois de cada render;
- `client/src/xr/XRSessionManager.js`: expõe a sessão ativa ao monitor;
- `client/src/main.js`: inicia, encerra e apresenta o diagnóstico;
- `client/index.html` e `client/src/styles.css`: painel no espelho desktop;
- `client/src/xr/XRPerformanceMonitor.test.js`: testes determinísticos;
- `client/src/phase-23-ui.test.js`: contrato da interface de validação.

## Preparar acesso HTTPS

WebXR requer uma origem segura. O headset precisa abrir uma URL HTTPS que
alcance o cliente e a API. Não use o endereço HTTP da rede local esperando que o
botão VR seja liberado.

Antes do ensaio:

1. execute `npm run check`;
2. disponibilize a aplicação em uma origem HTTPS;
3. confirme `/api/health` nessa mesma origem;
4. abra a URL no navegador do Quest 3;
5. permita o rastreamento do headset e dos dois controles.

## Matriz de teste físico

### 1. Entrada e saída

1. Inicie uma partida e pressione **Entrar em VR**.
2. Confirme que a arena abre sem tela preta ou erro de permissão.
3. Retire e recoloque o headset; a partida não deve avançar de forma abrupta.
4. Saia do VR e confirme que a mesma partida volta ao modo desktop.

### 2. Escala e conforto

1. Confirme que o chão virtual coincide aproximadamente com o chão físico.
2. Verifique se monstros comuns parecem menores que o chefão.
3. Gire fisicamente 360° sem deslocamento artificial da câmera.
4. Jogue por pelo menos dez minutos e registre enjoo, fadiga ou desconforto.

### 3. Controles e mira

1. Confirme controle esquerdo como estilingue e direito como munição.
2. Faça cinco disparos curtos, cinco médios e cinco com tensão máxima.
3. Confirme aumento perceptível de velocidade e alcance.
4. Mire à frente, aos lados e atrás; o tiro deve seguir a linha entre as mãos.
5. Desligue um controle durante uma carga; nenhum disparo tardio deve ocorrer.

### 4. Gameplay completo

1. Elimine pelo menos um inimigo de cada tipo.
2. Colete vida e munição especial.
3. Complete as quatro ondas.
4. Acerte o chefão nove vezes e confirme que ele permanece ativo.
5. Acerte pela décima vez e confirme vitória, pontuação e registro no ranking.
6. Execute outra partida até a derrota e confirme o resultado.

### 5. Desempenho

1. Observe o painel **Diagnóstico Quest 3** no espelho do computador.
2. Jogue uma sequência completa, incluindo chefão e vários projéteis.
3. Saia do VR e registre FPS médio, FPS mínimo, pior frame, frames acima de
   20 ms, draw calls e triângulos.
4. Repita três vezes antes de concluir sobre desempenho.

## Registro do ensaio

Preencha uma linha para cada execução:

| Campo | Resultado |
|---|---|
| Data e versão do navegador | Reteste aprovado em 08/09/2026; versão não informada |
| Duração | Partida completa aprovada; valor não informado |
| Controles detectados | Aprovado |
| FPS médio / mínimo | Aprovado; valores numéricos não informados |
| Pior frame / frames acima de 20 ms | Aprovado; valores numéricos não informados |
| Draw calls / triângulos | Aprovado; valores numéricos não informados |
| Chão e escala corretos | Aprovado |
| Mira curta, média e máxima | Aprovado após correção |
| Conforto após 10 minutos | Aprovado |
| Ondas, itens e chefão | Aprovado após correção do HUD XR |
| Vitória, derrota e ranking | Aprovado |
| Problemas encontrados | Estilingue, HUD e mira XR corrigidos e retestados |

## Critério para concluir a fase

O ensaio completo foi confirmado sem bug bloqueador. Os valores numéricos não
foram inventados no documento quando a confirmação não os detalhou.

## Próximo passo

Fase concluída. Os assets da Fase 24 também foram aprovados; o trabalho segue na
Fase 25 com testes de estabilidade e otimização.
