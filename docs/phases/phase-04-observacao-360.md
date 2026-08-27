# Fase 4 — Observação em 360°

## Objetivo da etapa

Permitir que o jogador observe toda a arena de neve no navegador usando mouse
e Pointer Lock, sem alterar sua posição e sem antecipar estilingue, projéteis ou
outros sistemas do vertical slice.

## Resultado visível

Ao abrir a cena, a aplicação mostra um botão **Ativar visão 360°**. Depois de
ativá-lo:

- o navegador captura o ponteiro somente após a ação explícita do usuário;
- mover o mouse gira a câmera horizontal e verticalmente;
- a rotação horizontal é contínua e permite observar a arena completa;
- a rotação vertical para em ±85° para evitar inversão da câmera;
- o retículo aparece apenas enquanto a visão está ativa;
- a posição da câmera continua em `(0, 1.65, 0)`;
- o primeiro `Esc` libera o cursor e preserva a cena;
- outro `Esc`, com o cursor livre, retorna ao menu.

## Decisões preservadas

- um único `renderer.setAnimationLoop()` continua atendendo a cena;
- `SnowArena` não foi alterada e mantém os limites visuais da Fase 3;
- o controle usa o addon oficial `PointerLockControls` do Three.js;
- o adaptador não expõe `moveForward()` nem `moveRight()`;
- não existem listeners de WASD, tensão, clique de disparo ou movimento;
- Pointer Lock é liberado ao ocultar a aba, sair da cena ou descartar a aplicação;
- WebXR continua fora do escopo até o núcleo convencional ficar estável.

## O que não faz parte desta fase

- estilingue, tensão, projéteis, inimigos, colisões ou dano;
- movimento do jogador ou navegação por teclado;
- controle por toque ou orientação do dispositivo;
- WebXR, controles do Meta Quest 3 ou HUD imersivo;
- alterações no banco, ranking ou endpoints de partida;
- novos assets, texturas, áudio, sombras ou pós-processamento.

## Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `client/src/config/desktop-look-config.js` | Sensibilidade, pitch e opção de movimento bruto |
| `client/src/input/DesktopLookController.js` | Adaptar Pointer Lock sem expor translação |
| `client/src/input/DesktopLookController.test.js` | Validar rotação, limites, fallback e lifecycle |
| `client/src/core/GameApp.js` | Conectar, liberar e descartar o controle junto ao loop |
| `client/src/main.js` | Compor câmera, controle, mensagens e semântica do `Esc` |
| `client/index.html` | Expor ativação acessível e instruções de uso |
| `client/src/styles.css` | Estados visuais do prompt, status e retículo |

## Como executar

Todos os comandos devem ser executados na raiz do projeto.

### Primeira execução neste computador

```powershell
Set-Location 'C:\caminho\para\shoot-n-smash'
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

O MySQL não é necessário nesta etapa. Sem `DATABASE_URL`, o diagnóstico deve
continuar informando `database.status = not-configured`.

### Execuções seguintes

```powershell
Set-Location 'C:\caminho\para\shoot-n-smash'
npm run dev
```

Aguarde as URLs do cliente e da API e abra
`http://127.0.0.1:5173/` em um navegador desktop.

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
3. Confirme o selo **Fase 4 concluída** e a versão `v0.4.0`.
4. Pressione **Abrir cena 3D**.
5. Confirme que o foco chega ao botão **Ativar visão 360°**.
6. Ative o botão com clique e repita usando teclado em outra entrada.
7. Confirme que o cursor desaparece e o status anuncia a visão ativa.
8. Mova o mouse horizontalmente até completar uma volta na arena.
9. Olhe para cima e para baixo e confirme que a câmera não inverte.
10. Confirme que a base da câmera não muda de lugar e o centro permanece livre.
11. Pressione teclas WASD e clique; confirme que não há movimento ou disparo.
12. Pressione `Esc` uma vez e confirme cursor livre, prompt visível e cena ativa.
13. Pressione `Esc` novamente e confirme o retorno ao menu.
14. Entre e saia da cena três vezes e repita o mesmo movimento de mouse.
15. Confirme que a sensibilidade não aumenta e existe somente um canvas.
16. Redimensione a janela e confirme que a imagem não fica deformada.
17. Confirme neve, gelo, pedras, montanhas, névoa e partículas da Fase 3.
18. Use **Verificar API** e confirme que a API continua online.
19. Abra o Console e confirme que não existem erros não tratados.

Opcionalmente, dentro da cena confirme o canvas único:

```javascript
document.querySelectorAll('canvas[data-game-canvas]').length
```

O resultado esperado é `1`; no menu, `0`.

## Critérios de aceite

- Pointer Lock depende de ação explícita e nunca inicia automaticamente;
- movimento do mouse é ignorado enquanto o cursor está livre;
- yaw permite observação horizontal completa e pitch fica limitado a ±85°;
- a posição da câmera permanece inalterada durante qualquer rotação;
- nenhum movimento, projétil ou disparo é criado;
- o primeiro `Esc` libera o cursor e o segundo retorna ao menu;
- ocultar a aba libera Pointer Lock;
- três ciclos de entrada e saída não duplicam listeners, canvas ou sensibilidade;
- navegadores sem Pointer Lock recebem mensagem clara e mantêm saída acessível;
- resize, pausa da aba, delta limitado e descarte da Fase 3 continuam funcionando;
- menu, equipe, cenário e diagnóstico da API não sofrem regressão;
- `npm run check` termina com sucesso e o Console permanece limpo.

## Problemas possíveis

### O navegador não captura o ponteiro

Pointer Lock exige uma ação direta do usuário. Volte ao prompt e ative o botão
novamente. Confirme também que a página está em foco e que o navegador permite
essa API. A cena e o botão **Voltar ao menu** continuam utilizáveis no fallback.

### O cursor ficou preso na cena

Pressione `Esc` uma vez. O status deve mudar para cursor livre e o botão de
ativação deve reaparecer. Um novo `Esc` retorna ao menu.

### A rotação parece acelerada depois de reentrar

Saia da cena, confirme que não existe canvas e recarregue a página. Depois
verifique o Console e execute `npm run check`; listeners duplicados constituem
falha nos critérios de aceite.

### A API aparece indisponível

Inicie com `npm run dev`, não somente `npm run dev:client`. MySQL
`not-configured` continua sendo o resultado esperado nesta fase.

## Limitações atuais

- a observação por mouse não atende dispositivos somente por toque;
- a cena continua usando primitivas low-poly e não possui arte final;
- o retículo ainda é apenas uma referência visual, sem sistema de mira;
- não há pausa de gameplay porque ainda não existe uma sessão jogável;
- WebXR, banco e ranking continuam planejados para fases posteriores.

## Próximo passo

Fase 5 — iniciar o próximo incremento do vertical slice convencional. O escopo
será detalhado antes da implementação para não antecipar sistemas nem quebrar a
câmera estacionária concluída nesta fase.
