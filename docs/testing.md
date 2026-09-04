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

## Fase 8

### Cobertura automatizada adicionada

- parâmetros canônicos do inimigo e rejeição de configurações inválidas;
- spawn determinístico nos limites do anel de raio 17 a 20 e em diferentes
  quadrantes, por meio de um gerador aleatório injetável;
- criação de uma única entidade low-poly com collider e resistência explícitos;
- aproximação radial a 1,25 unidade por segundo, independente da subdivisão dos
  frames;
- preservação dos centros anterior e atual, parada no raio `1,5` e cálculo da
  fração normalizada do contato;
- resistência genérica, força inteira de acerto e limite da resistência em zero;
- publicação e remoção únicas nos desfechos `eliminated` e `player-contact`;
- colisão contínua entre projétil e inimigo em movimento;
- consumo do projétil e criação do burst somente após impacto válido;
- desempate entre impacto e contato pelo menor `t`, com precedência do impacto
  em caso de igualdade;
- disparo que erra sem alterar resistência, consumir o projétil ou criar burst;
- consistência do estado quando um callback observador falha;
- apresentação acessível do HUD para aproximação, dano, eliminação e contato;
- reset, rollback de construção parcial e descarte idempotente dos recursos;
- integração e ordem de atualização coordenadas por `GameSession`;
- metadados e diagnóstico da API atualizados para a Fase 8.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 8 concluída**, use **Verificar API** e confira `phase: 8`.
3. Abra a cena e observe em 360° até encontrar um único monstro de gelo.
4. Confirme que ele nasceu longe do centro e se aproxima diretamente do jogador.
5. Ative a mira e acerte o inimigo; confirme um burst, o consumo da bola de neve
   e a eliminação em um único impacto.
6. Abra outra sessão, não dispare e aguarde cerca de 12,4 a 14,8 segundos.
7. Confirme que o contato remove o inimigo e informa o desfecho, sem reduzir a
   vida do jogador.
8. Teste um disparo pouco antes do contato e confirme somente um desfecho, de
   acordo com o primeiro evento.
9. Erre um disparo e confirme que o inimigo continua se aproximando.
10. Repita novas sessões para observar direções de spawn variadas e faça três
    ciclos de entrada e saída, sem canvas, inimigos, efeitos ou listeners
    residuais.
11. Confirme que não há respawn, segunda entidade, onda ou pontuação e verifique
    o Console sem erros não tratados.

O roteiro completo e a checklist ainda pendente de validação manual estão em
[Fase 8 — Primeiro inimigo hostil](phases/phase-08-inimigo-hostil.md).

## Fase 9

### Cobertura automatizada adicionada

- catálogo imutável com IDs, rótulos, cores e resistências canônicas dos três
  tipos normais;
- seleção uniforme de `weak`, `medium` e `resistant`, incluindo as fronteiras
  dos três intervalos;
- rejeição de catálogos vazios, descritores inválidos, IDs duplicados, cores
  fora do intervalo e valores aleatórios fora de `[0, 1)`;
- snapshot imutável do tipo, independente do catálogo usado na seleção;
- gerador do tipo separado das duas amostras que definem ângulo e raio do spawn;
- escolha do tipo uma única vez por sessão e preservação durante `reset()`;
- resistências `1`, `2` e `3` consumidas pela mesma força de impacto `1`;
- identidade do tipo preservada nos estados ativos, danificados e terminais;
- snapshots congelados para impedir que observadores corrompam transições;
- múltiplos impactos no mesmo frame ordenados por `impactRatio` global;
- empate não letal reduzindo resistência antes da resolução do contato;
- HUD acessível com rótulo, resistência e mensagens específicas do tipo;
- eventos do inimigo visíveis sem duplicar o anúncio no live region de disparo;
- integração dos três tipos com `EnemySystem` e `GameSession`, sem alterar
  movimento, colisão, contato ou desempate temporal;
- metadados e diagnóstico da API atualizados para a Fase 9.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 9 concluída**, use **Verificar API** e confira `phase: 9`.
3. Abra a cena e confira no HUD o tipo sorteado: Fraco, Médio ou Resistente.
4. Localize o único monstro e confirme que sua cor corresponde ao tipo exibido.
5. Acerte o inimigo e confirme que cada impacto reduz exatamente um ponto de
   resistência, elimina em `1`, `2` ou `3` acertos e atualiza HUD e mensagem.
6. Repita sessões até observar os três tipos, sempre com somente uma entidade e
   com novas posições de spawn independentes do tipo.
7. Em uma nova sessão, não dispare e confirme que o contato ainda remove o
   inimigo sem reduzir vida do jogador.
8. Repita o caso de disputa entre impacto e contato e confirme somente um
   desfecho, preservando o critério do menor `t` e a precedência do impacto na
   igualdade.
9. Entre e saia da cena três vezes e confirme ausência de canvas, inimigos,
   efeitos ou listeners residuais.
10. Confirme que não há respawn, ondas, pontuação ou erros não tratados no
    Console.

O roteiro completo está em
[Fase 9 — Tipos normais de inimigo](phases/phase-09-tipos-inimigo.md).

## Fase 10

### Cobertura automatizada adicionada

- vida inicial e máxima 100 centralizadas em configuração imutável;
- snapshots congelados com vida, máximo, proporção e estado esgotado;
- dano inteiro positivo, limite mínimo zero e perda efetiva publicada;
- rejeição de configurações e danos inválidos;
- estado preservado quando o observador da vida falha;
- reset e descarte idempotentes do `PlayerHealthSystem`;
- dano canônico 1, 2 e 3 nos tipos Fraco, Médio e Resistente;
- identidade e dano preservados nos snapshots do inimigo;
- contatos dos três tipos resultando em 99, 98 e 97 pontos de vida;
- contato terminal aplicando dano somente uma vez;
- impacto letal anterior ou empatado preservando 100 pontos;
- impacto não letal empatado seguido por um único dano de contato;
- observadores de vida ou contato falhando sem corromper os estados terminais;
- descrição do HUD para vida completa, danificada e esgotada;
- progressbar estático com rótulos, valores e associações ARIA;
- regressão de movimento, colisão, resistência e desempate das fases anteriores;
- metadados e diagnóstico da API atualizados para a Fase 10.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 10 concluída**, use **Verificar API** e confira `phase: 10`.
3. Abra a cena e confirme a barra de vida cheia em 100 / 100.
4. Elimine um inimigo antes do contato e confirme que a vida permanece 100.
5. Abra outra sessão, não dispare e aguarde o contato.
6. Confirme feedback vermelho e vida 99, 98 ou 97 para Fraco, Médio ou
   Resistente.
7. Aguarde e confirme que o dano não se repete após a remoção do inimigo.
8. Saia e entre novamente; confirme a restauração para 100 / 100.
9. Repita três ciclos completos e confirme ausência de recursos residuais.
10. Confirme que não há respawn, ondas, pontuação, derrota ou erros não tratados.

O roteiro completo está em
[Fase 10 — Vida do jogador e dano de contato](phases/phase-10-vida-dano.md).

## Fase 11

### Cobertura automatizada adicionada

- total de encontros e intervalo de respawn centralizados e validados;
- snapshots imutáveis com estados `active`, `waiting` e `complete`;
- nenhum respawn antes de 1,25 segundo e nenhum quarto inimigo;
- novo sorteio independente de tipo e posição em cada respawn;
- reutilização da entidade, das geometrias e dos materiais;
- vida preservada entre eliminação, contato e próximo encontro;
- pausa do cronômetro quando o encontro está inativo;
- progresso “Encontro N de 3” conectado ao HUD;
- metadados e diagnóstico da API atualizados para a Fase 11.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 11 concluída**, use **Verificar API** e confira `phase: 11`.
3. Abra a cena e confirme “Encontro 1 de 3” no HUD.
4. Elimine o primeiro inimigo ou permita o contato.
5. Confirme a remoção imediata e o novo spawn após cerca de 1,25 segundo.
6. Confirme “Encontro 2 de 3”, novo tipo/posição e a vida anterior preservada.
7. Repita até o terceiro desfecho e confirme a mensagem de ciclo concluído.
8. Aguarde e confirme que não surge um quarto inimigo.
9. Repita três entradas e saídas da cena e confirme ausência de recursos residuais.
10. Confirme que ondas completas, pontuação, derrota e WebXR ainda não aparecem.

O roteiro completo está em
[Fase 11 — Respawn controlado](phases/phase-11-respawn-controlado.md).

## Fase 12

### Cobertura automatizada adicionada

- exatamente quatro definições de onda, imutáveis e validadas;
- quantidades 3, 4, 5 e 6, totalizando 18 inimigos;
- liberação progressiva de Fraco, Médio e Resistente;
- velocidades crescentes e intervalos decrescentes por onda;
- distinção entre intervalo de inimigos e pausa entre ondas;
- estados `active`, `between-enemies`, `between-waves` e `complete`;
- uso somente do excesso do delta após um intervalo;
- novo tipo, velocidade e spawn aplicados à entidade reutilizada;
- vida preservada entre todas as ondas;
- ausência de quinto spawn após a conclusão da quarta onda;
- HUD com onda e inimigo atuais;
- regressão do desempate temporal, dano, colisões e lifecycle;
- metadados e diagnóstico da API atualizados para a Fase 12.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 12 concluída**, use **Verificar API** e confira `phase: 12`.
3. Abra a cena e confirme “Onda 1 de 4 · Inimigo 1 de 3”.
4. Confirme que a onda 1 apresenta apenas monstros Fracos.
5. Após três desfechos, confirme a pausa e o início da onda 2 com quatro inimigos.
6. Confirme que a onda 2 pode apresentar Fracos e Médios.
7. Nas ondas 3 e 4, confirme a presença possível dos três tipos e maior velocidade.
8. Verifique que a vida não é restaurada entre inimigos ou ondas.
9. Após o sexto inimigo da onda 4, confirme a conclusão sem novo spawn.
10. Confirme que chefão, pontuação, derrota e WebXR ainda não aparecem.

O roteiro completo está em [Fase 12 — Ondas](phases/phase-12-ondas.md).

## Fase 13

### Cobertura automatizada adicionada

- perfil imutável do chefão com resistência 10, dano 10 e escala gigante;
- validação de velocidade, collider, escala, altura e descritor antes da cena;
- estados `boss-pending`, `boss` e `complete` após a quarta onda;
- espera configurável e criação única do chefão;
- reutilização da entidade, geometrias e materiais;
- exigência de exatamente 10 impactos válidos para eliminação;
- contato aplicando exatamente 10 de dano uma única vez;
- HUD e mensagens específicos para o chefão;
- regressão das quatro ondas, vida, colisões e lifecycle;
- metadados e diagnóstico da API atualizados para a Fase 13.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 13 concluída**, use **Verificar API** e confira `phase: 13`.
3. Complete os 18 encontros das quatro ondas.
4. Confirme a mensagem de aproximação e aguarde cerca de 3 segundos.
5. Verifique o chefão gigante, o HUD **Chefão final · 10 acertos** e a barra 10 / 10.
6. Acerte nove projéteis e confirme que ele permanece ativo com resistência 1.
7. No décimo impacto, confirme sua remoção e o encerramento do confronto.
8. Em outra sessão, permita o contato e confirme a perda única de 10 pontos de vida.
9. Confirme que não surge novo inimigo depois do desfecho do chefão.
10. Confirme que pontuação, telas finais e WebXR ainda não aparecem.

O roteiro completo está em [Fase 13 — Chefão de gelo](phases/phase-13-chefao.md).

## Fase 14

### Cobertura automatizada adicionada

- valores configuráveis para cada tipo, onda, chefão e fase;
- snapshots imutáveis com total, quantidade e último evento;
- prevenção de pontuação duplicada por ID de evento;
- preservação do total quando um observador falha;
- integração de eliminações e bônus com as quatro ondas;
- nenhum ponto de eliminação por contato;
- chefão eliminado concedendo 2.000 + 1.000 pontos;
- contato do chefão sem bônus de chefão ou fase;
- placar inicial, formatação e mensagens do HUD;
- metadados e diagnóstico da API atualizados para a Fase 14.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 14 concluída**, use **Verificar API** e confira `phase: 14`.
3. Abra a cena e confirme o placar inicial em zero.
4. Elimine tipos Fraco, Médio e Resistente e confira +100, +250 e +500.
5. Ao concluir cada onda, confirme o bônus adicional de 500.
6. Permita um contato e confirme que não há pontos de eliminação.
7. Elimine o chefão e confirme +2.000 e depois +1.000 pela fase.
8. Em outra sessão, permita o contato do chefão e confirme que esses bônus não entram.
9. Saia e entre novamente; confirme que a nova sessão começa em zero.
10. Confirme que ainda não existem telas de vitória ou derrota.

O roteiro completo está em [Fase 14 — Pontuação](phases/phase-14-pontuacao.md).

## Fase 15

### Cobertura automatizada adicionada

- estados globais imutáveis `PLAYING`, `VICTORY` e `GAME_OVER`;
- permanência em `PLAYING` para encontros e contatos não terminais;
- vitória exclusiva após a eliminação do chefão;
- derrota exclusiva quando a vida chega a zero, com precedência terminal;
- transição única mesmo diante de sincronizações ou callbacks repetidos;
- preservação do estado terminal quando um observador falha;
- contato não letal do chefão retornando a `boss-pending`;
- novo spawn do chefão com resistência completa e nenhum bônus indevido;
- pontuação final consolidada antes da publicação da vitória;
- bloqueio de atualizações, cargas e disparos depois do resultado;
- normalização, fallback e limite do nome do jogador;
- descrição acessível de vitória e derrota com pontuação e cenário;
- replay reconstruindo vida, ondas, placar, controles e estado global;
- metadados e diagnóstico da API atualizados para a Fase 15.

### Verificação manual resumida

1. Execute `npm run dev` e abra `http://127.0.0.1:5173/`.
2. Confirme **Fase 15 concluída**, use **Verificar API** e confira `phase: 15`.
3. Informe um nome, complete as quatro ondas e elimine o chefão.
4. Confirme a tela Vitória com nome, resultado, pontuação final e cenário Neve.
5. Pressione **Jogar novamente** e confirme vida 100, placar zero e onda 1.
6. Em outra partida, permita um contato não letal do chefão e confirme que ele
   retorna após a espera com 10 de resistência, sem pontos extras.
7. Repita contatos até zerar a vida e confirme a tela Derrota com o placar
   preservado.
8. Confirme que nenhum disparo ou encontro avança sob uma tela final.
9. Repita três replays e verifique que canvas, listeners e controles não se
   duplicam.
10. Confirme o Console sem erros não tratados.

O roteiro completo está em
[Fase 15 — Vitória e derrota](phases/phase-15-vitoria-derrota.md).

## Estratégia futura

- testes de integração para múltiplos contatos e partida completa;
- testes de API e migrations com um banco MySQL isolado;
- E2E convencional em navegador para menu, partida completa, ranking e replay;
- mocks WebXR apenas para lógica de entrada;
- checklist manual obrigatório no Meta Quest 3;
- profiling e testes de reinício prolongados para detectar vazamentos.
