# Fase 24 — Assets finais

## Status

Implementação pronta para validação visual e sonora em desktop e no Meta Quest 3.
A versão permanece `0.22.0`: o reteste físico das correções da Fase 23 ainda é
um requisito para promover as fases como concluídas.

## Escopo entregue

- três texturas autorais para neve, gelo e rocha;
- modelos low-poly finais com silhuetas distintas para inimigos fraco, médio,
  resistente e chefão;
- oito efeitos sonoros procedurais para as ações principais;
- animação de caminhada já existente refinada com reação elástica ao impacto;
- partículas de gelo/neve para impactos, com geometria compartilhada;
- carregamento assíncrono com fallback para as cores anteriores quando uma
  textura não puder ser lida;
- descarte explícito de texturas, áudio e partículas ao sair da partida.

## Texturas

Os arquivos finais ficam em `client/public/assets/textures/`:

| Arquivo | Uso | Tamanho | Repetição |
|---|---|---:|---:|
| `snow-ground.jpg` | ilha e neve das montanhas | 512 × 512 | 10 |
| `glacier-ice.jpg` | plataforma e placas de gelo | 512 × 512 | 5 |
| `arctic-rock.jpg` | rochas e montanhas | 512 × 512 | 4 |

As imagens foram geradas especificamente para o projeto, sem texto, marca ou
asset de terceiros. Os prompts solicitaram mapas quadrados repetíveis, com
leitura estilizada low-poly, contraste moderado e pouco ruído para não competir
com inimigos, mira e HUD em VR. Os originais foram convertidos para JPEG 512 px
e o conjunto final ocupa aproximadamente 130 KB.

`loadFinalTextureSet` limita a anisotropia em 4, usa repetição espelhada e aplica
o espaço de cor sRGB. Se qualquer item falhar, os carregamentos parciais são
liberados e a arena continua com os materiais de fallback.

## Modelos e animações

Os modelos finais permanecem nativos do Three.js para manter o orçamento do
Quest previsível, evitar download de GLTF e reutilizar cinco geometrias e três
materiais por inimigo. A identidade visual muda sem afetar collider, resistência
ou balanceamento:

- fraco: corpo de gelo limpo e leve;
- médio: cristais nos ombros;
- resistente: ombreiras e placa peitoral;
- chefão: coroa de três pontas, além da escala gigante existente.

O balanço vertical e o movimento alternado dos braços continuam independentes
da taxa de quadros. Acertos não letais agora acionam um pulso de escala de 180 ms;
eliminação preserva a leitura visual e dispara as partículas no ponto de contato.

## Áudio

`GameAudioSystem` usa Web Audio e cria tons curtos para carga, disparo, impacto,
eliminação, dano no jogador, coleta, vitória e derrota. Não há arquivos de áudio
para baixar ou decodificar. O contexto só é desbloqueado após o clique que inicia
a partida, conforme a política de autoplay dos navegadores, e a ausência de Web
Audio mantém o jogo funcional e silencioso.

## Partículas

Cada impacto usa um único objeto `Points` com 12 fragmentos distribuídos de
forma determinística. A geometria é compartilhada entre até 12 efeitos ativos;
apenas o material transitório é individual para permitir expansão e fade. Isso
mantém o feedback visível sem multiplicar dezenas de meshes por impacto.

## Matriz de validação manual

1. Inicie uma partida no desktop e confirme que neve, gelo e rochas recebem as
   novas texturas sem superfícies pretas ou piscando.
2. Localize inimigos médio e resistente e confirme que cristais e armadura
   distinguem as classes mesmo sem ler o HUD.
3. Acerte um inimigo resistente e confirme o pulso do modelo e a nuvem de 12
   partículas exatamente no impacto.
4. Confirme um som curto em carga, tiro, acerto, eliminação, dano, coleta e tela
   final. Verifique também que iniciar outra partida não duplica os sons.
5. Desative ou bloqueie áudio no navegador e confirme que a partida continua.
6. No Quest 3, repita os itens 1 a 4 e confira as métricas da Fase 23. O HUD XR,
   a mira e o estilingue corrigido devem continuar legíveis e estáveis.
7. Saia e entre na cena três vezes; confirme que não há canvas, som, partículas
   ou texturas residuais.

## Critério de conclusão

A fase pode ser promovida depois de:

- aprovação visual e sonora no desktop;
- reteste no Quest 3 sem regressão de mira, HUD ou estilingue;
- registro das métricas físicas da Fase 23;
- execução de `npm run check` sem falhas.

Depois disso, a próxima etapa é a **Fase 25 — Testes e otimização**.
