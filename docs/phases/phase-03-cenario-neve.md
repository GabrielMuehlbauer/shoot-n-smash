# Fase 3 — Protótipo do cenário de neve

## Objetivo da etapa

Transformar a cena técnica da Fase 2 em um primeiro ambiente reconhecível do
Shoot 'n' Smash, usando somente primitivas leves do Three.js e sem antecipar o
gameplay.

## O que foi entregue

Ao clicar em **Abrir cena 3D**, a aplicação apresenta:

- ilha circular de gelo coberta por neve;
- três placas de gelo azuladas;
- seis pedras low-poly fora da área inicial do jogador;
- oito montanhas provisórias com topo nevado;
- névoa linear para integrar o horizonte;
- 360 pontos de neve distribuídos de forma determinística;
- farol de gelo girando com velocidade baseada no delta do game loop;
- cenário limitado a 30 meshes e sem sombras ou pós-processamento.

As geometrias e materiais dos objetos repetidos são compartilhados. O descarte
continua centralizado no `RenderContext`, que usa conjuntos para liberar cada
recurso apenas uma vez.

## O que ainda não faz parte desta fase

- rotação da câmera ou pointer lock;
- estilingue, projéteis, inimigos, colisões ou ondas;
- texturas, modelos 3D, áudio ou arte final;
- sombras, pós-processamento ou física externa;
- WebXR e controles do Meta Quest 3.

## Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `client/src/config/snow-arena-config.js` | Posições, cores, névoa e limites do cenário |
| `client/src/world/SnowArena.js` | Compor e animar os elementos visuais da arena |
| `client/src/world/SnowArena.test.js` | Validar composição, área livre e neve determinística |
| `client/src/core/RenderContext.js` | Integrar cenário, névoa, renderer e descarte |
| `client/src/core/RenderContext.test.js` | Preservar lifecycle e encaminhamento do delta |
| `client/index.html` | Identificar a Fase 3 e orientar o teste visual |
| `docs/testing.md` | Manter o histórico de validação das fases |

## Como executar

Todos os comandos devem ser executados na raiz do projeto.

### Primeira execução neste computador

```powershell
Set-Location 'C:\caminho\para\shoot-n-smash'
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Não preencha `DATABASE_URL` agora, salvo se já existir um MySQL de
desenvolvimento. O banco não é necessário para abrir o cenário.

### Execuções seguintes

```powershell
Set-Location 'C:\caminho\para\shoot-n-smash'
npm run dev
```

Aguarde estas confirmações:

```text
Shoot 'n' Smash API disponível em http://127.0.0.1:3000
Local: http://localhost:5173/
```

Abra `http://127.0.0.1:5173/` no navegador. Para encerrar, volte ao terminal e
pressione `Ctrl+C`.

## Como testar

### Teste automático

Com outra execução do projeto parada, ou em um segundo terminal:

```powershell
npm run check
```

O comando deve concluir todos os testes e o build com código de saída zero.

### Teste visual passo a passo

1. Execute `npm run dev`.
2. Abra `http://127.0.0.1:5173/`.
3. Confirme o selo **Fase 3 concluída** e a versão `v0.3.0`.
4. Pressione **Abrir cena 3D**.
5. Confirme que a ilha clara ocupa o primeiro plano.
6. Localize gelo azulado, pedras escuras e a silhueta de montanhas nevadas.
7. Confirme a névoa no horizonte e os pontos brancos de neve.
8. Confirme que a grade da Fase 2 não aparece mais.
9. Confirme que a região imediatamente ao redor da câmera está livre.
10. Observe por alguns segundos e confirme rotação suave do farol de gelo.
11. Redimensione a janela para um formato estreito e depois maximize-a.
12. Confirme que os objetos não ficam esticados ou achatados.
13. Pressione `Esc` e confirme o retorno ao menu.
14. Entre e saia da cena três vezes.
15. Confirme que a animação não acelera e não existe mais de um canvas.
16. Pressione **Verificar API** e confirme **API online**.
17. Abra o Console do navegador e confirme que não existem erros.

Opcionalmente, confirme o canvas único no Console:

```javascript
document.querySelectorAll('canvas[data-game-canvas]').length
```

O resultado esperado dentro da cena é `1`; no menu, `0`.

## Critérios de aceite

- neve, gelo, pedras, montanhas e atmosfera fria são visualmente distinguíveis;
- nenhuma decoração invade o raio livre de quatro unidades do jogador;
- a composição usa no máximo 30 meshes e não depende de assets de rede;
- partículas são reproduzíveis entre execuções;
- o único loop continua sendo `renderer.setAnimationLoop()`;
- resize, pausa em aba oculta e limite de delta continuam funcionando;
- três ciclos de entrada e saída não duplicam canvas, listeners ou velocidade;
- geometrias e materiais compartilhados são descartados uma única vez;
- menu, equipe e diagnóstico da API permanecem funcionais;
- `npm run check` termina com sucesso e o Console permanece limpo.

## Problemas possíveis

### A cena mostra somente a cor de fundo

Confirme que WebGL e a aceleração de hardware estão habilitados. Recarregue com
`Ctrl+F5` e verifique o Console antes de alterar o código.

### A API aparece indisponível

Confirme que o projeto foi iniciado com `npm run dev`, não somente com
`npm run dev:client`. O MySQL `not-configured` é esperado nesta fase.

### Porta 5173 ou 3000 ocupada

Encerre a execução anterior com `Ctrl+C` e execute `npm run dev` novamente.

### Alterações antigas continuam aparecendo

Pare o projeto, execute `npm run dev` novamente e atualize a página com
`Ctrl+F5`.

## Próximo passo

Fase 4 — adicionar observação em 360° com mouse e pointer lock. O jogador
continuará parado no centro; estilingue e disparos ficam para incrementos
posteriores.
