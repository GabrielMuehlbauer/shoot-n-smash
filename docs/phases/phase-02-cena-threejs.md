# Fase 2 — Cena base Three.js

## Objetivo da etapa

Criar a fundação visual 3D do Shoot 'n' Smash: cena, câmera em perspectiva,
renderer, iluminação, chão, redimensionamento responsivo e game loop.

## Resultado esperado

Ao clicar em **Abrir cena 3D**, uma demonstração em tela cheia deve apresentar:

- chão plano e claro;
- grade que permite perceber distância e perspectiva;
- forma azul iluminada e girando;
- canvas ajustado automaticamente ao tamanho da janela;
- botão para voltar ao menu;
- encerramento e recriação seguros da cena.

A forma girando é um objeto de diagnóstico. Ela confirma visualmente que o game
loop está funcionando; não representa um inimigo ou asset final.

Esta fase ainda não inclui cenário detalhado de neve, câmera 360°, inimigos,
estilingue, projéteis ou WebXR.

## Arquivos envolvidos

| Arquivo | Responsabilidade |
|---|---|
| `client/src/config/render-config.js` | Centralizar câmera, renderer, chão e limites do loop |
| `client/src/core/RenderContext.js` | Criar cena, câmera, renderer, luzes, chão e resize |
| `client/src/core/GameApp.js` | Iniciar, parar e descartar o game loop |
| `client/src/utils/viewport.js` | Calcular viewport sem deformação ou valores inválidos |
| `client/src/main.js` | Conectar os botões da página à cena 3D |
| `client/index.html` | Disponibilizar a interface da demonstração |
| `client/src/styles.css` | Apresentar o canvas e o HUD estrutural |
| `client/src/**/*.test.js` | Testar lifecycle, delta e resize sem WebGL headless |
| `README.md` | Atualizar estado, execução e limitações |
| `docs/testing.md` | Registrar a validação permanente da fase |

## Como executar

Todos os comandos abaixo devem ser executados na raiz do projeto.

### 1. Abrir a pasta correta

```powershell
Set-Location 'C:\caminho\para\shoot-n-smash'
```

### 2. Preparar somente na primeira execução

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Não preencha `DATABASE_URL` agora, salvo se já houver um MySQL de desenvolvimento.
O banco não é necessário para visualizar a cena.

### 3. Iniciar diariamente

```powershell
npm run dev
```

Aguarde o terminal mostrar as duas URLs:

```text
Shoot 'n' Smash API disponível em http://127.0.0.1:3000
Local: http://localhost:5173/
```

Abra `http://127.0.0.1:5173/` no navegador.

### 4. Encerrar

Volte ao terminal em que o projeto está executando e pressione `Ctrl+C`.

## Como testar

### Teste automático

Com o servidor parado ou em outro terminal, execute:

```powershell
npm run check
```

Resultado esperado:

- todos os testes terminam com status aprovado;
- o build Vite termina sem erro;
- o comando retorna código de saída zero.

### Teste manual da cena

1. Execute `npm run dev`.
2. Abra `http://127.0.0.1:5173/`.
3. Confirme o selo **Fase 2 concluída**.
4. Pressione **Abrir cena 3D**.
5. Confirme que a cena ocupa toda a janela.
6. Confirme que o chão claro e a grade estão visíveis.
7. Confirme que a forma azul está iluminada e gira continuamente.
8. Redimensione a janela para um formato estreito e depois maximize-a.
9. Confirme que a forma não fica esticada ou achatada.
10. Pressione `Esc` e confirme o retorno à tela inicial.
11. Entre e saia da cena três vezes.
12. Confirme que a animação não acelera e não aparece mais de um canvas.
13. Pressione **Verificar API**.
14. Confirme a mensagem **API online**.
15. Pressione `F12`, abra **Console** e confirme que não existem erros.

Opcionalmente, com a cena aberta, confirme no Console que há um único canvas:

```javascript
document.querySelectorAll('canvas[data-game-canvas]').length
```

O resultado esperado é `1`.

## Critérios de aceite

- `Scene`, `PerspectiveCamera` e `WebGLRenderer` são criados sem erro;
- o loop utiliza somente `renderer.setAnimationLoop()`;
- o primeiro frame recebe delta zero;
- deltas longos são limitados para evitar saltos;
- a câmera mantém a proporção após resize;
- o pixel ratio não ultrapassa o limite configurado;
- sair da cena encerra o loop e libera canvas, geometrias e materiais;
- uma falha parcial de inicialização libera os recursos já criados;
- entrar novamente não duplica canvas ou velocidade;
- a página e o diagnóstico da API da Fase 1 continuam funcionando;
- `npm run check` termina com sucesso.

## Problemas possíveis

### Porta 5173 ou 3000 ocupada

Outra execução do projeto provavelmente continua ativa. Localize o terminal
anterior, pressione `Ctrl+C` e execute `npm run dev` novamente.

### Cena preta ou mensagem sobre WebGL

Confirme que a aceleração de hardware e o WebGL estão habilitados no navegador.
Atualize o driver de vídeo somente se outros sites WebGL também falharem.

### Cena deformada após redimensionar

Recarregue a página com `Ctrl+F5`. Se o problema persistir, registre o tamanho da
janela, navegador utilizado e uma captura da cena.

### Alterações não aparecem

Pare o servidor com `Ctrl+C`, execute `npm run dev` novamente e faça uma
atualização forçada com `Ctrl+F5`.

### MySQL aparece como `not-configured`

Esse resultado é esperado. O banco só será obrigatório durante a fase de
persistência e não bloqueia a cena 3D.

## Próximo passo

Fase 3 — transformar esta base em um protótipo leve do cenário de neve usando
formas simples: terreno claro, gelo, pedras, montanhas provisórias e atmosfera
fria. Inimigos e gameplay continuarão fora dessa fase.
