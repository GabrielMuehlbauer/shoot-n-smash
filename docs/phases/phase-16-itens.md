# Fase 16 — Itens

## Objetivo da etapa

Adicionar itens de vida e munição especial que surgem durante as ondas e são
coletados com o próprio estilingue, mantendo configuração, colisão e efeitos
separados da interface.

## Resultado esperado

- encontros normais podem sortear um item em uma posição válida ao redor do jogador;
- as chances aumentam de forma configurável entre as ondas 1 e 4;
- existe no máximo um item ativo e ele expira depois de 12 segundos;
- acertar o item de vida recupera até 20 pontos, sem ultrapassar 100;
- acertar a munição especial concede 3 disparos de dano 2, acumuláveis até 6;
- cada disparo especial consome uma carga mesmo quando erra;
- um projétil resolve somente seu primeiro contato entre item e inimigo;
- itens ativos desaparecem antes do chefão;
- HUD e feedback visual informam spawn, coleta, expiração e munição restante.

## Arquivos envolvidos

- `client/src/config/gameplay-config.js` — chances, dimensões, duração e efeitos;
- `client/src/gameplay/ItemSystem.js` — spawn, visual, animação e ciclo de vida;
- `client/src/gameplay/PlayerHealthSystem.js` — cura limitada à vida máxima;
- `client/src/gameplay/ProjectileSystem.js` — força e tipo por projétil;
- `client/src/gameplay/SlingshotSystem.js` — criação do tiro normal ou especial;
- `client/src/core/GameSession.js` — colisões, efeitos e consumo da munição;
- `client/index.html`, `client/src/main.js` e `client/src/styles.css` — HUD e mensagens;
- testes unitários e de integração da Fase 16;
- README, arquitetura, decisões, API, banco e estratégia de testes.

## Implementação

### Spawn configurável

O `ItemSystem` faz uma tentativa no começo de cada encontro normal. Os valores
iniciais são deliberadamente fáceis de balancear:

| Onda | Chance por encontro |
|---:|---:|
| 1 | 12% |
| 2 | 20% |
| 3 | 30% |
| 4 | 40% |

O item nasce em um anel de raio 6 a 10, a 1,35 unidade de altura. Ângulo, raio e
tipo usam um gerador aleatório injetável, permitindo testes determinísticos. Se
já houver um coletável ativo, a tentativa não cria outro.

### Tipos e efeitos

O item verde aplica cura de 20 pelo `PlayerHealthSystem`. A cura publicada é
somente o ganho real: um jogador com 90 chega a 100, e não a 110. Coletar com a
vida cheia consome o item, mas informa ganho zero.

O item dourado adiciona três cargas especiais, até o limite de seis. Cada carga
cria uma bola dourada com força 2. O consumo ocorre no lançamento, portanto um
erro também gasta a munição. Quando as cargas terminam, o disparo volta
automaticamente à força normal 1.

### Colisão única

`GameSession` testa o segmento percorrido pelo projétil contra o item e contra o
inimigo. Somente a colisão com menor tempo normalizado é guardada. Em empate, o
inimigo mantém a precedência já existente. Isso impede dois efeitos para uma
única bola de neve.

A força é armazenada no projétil no momento do disparo. Assim, coletar munição
especial não modifica projéteis normais que já estão no ar.

### Ciclo de vida

O item pode terminar como:

- `collected`: foi atingido e teve seu efeito aplicado;
- `expired`: permaneceu 12 segundos sem ser atingido;
- `cleared`: foi removido antes do chefão.

Geometrias e materiais são compartilhados, e todos os recursos são descartados
com a sessão. Itens não concedem pontos nesta fase.

## O que não faz parte desta fase

- escudo, redução de velocidade, multiplicador ou outro poder temporário;
- múltiplos itens simultâneos;
- itens durante o chefão;
- pontuação por coleta;
- áudio ou assets finais;
- persistência, ranking e WebXR.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL continua opcional.

## Como testar manualmente

### Item de vida

1. Confirme **Fase 16 concluída** e `phase: 16` em **Verificar API**.
2. Inicie a partida e permita que um monstro cause dano.
3. Continue os encontros até surgir um item verde.
4. Acerte o item com o estilingue.
5. Confirme o burst, a remoção do item e a cura imediata no HUD.
6. Repita perto de 100 e confirme que a vida nunca ultrapassa o máximo.

### Munição especial

1. Continue até surgir um item dourado e acerte-o.
2. Confirme **3 especiais** no HUD.
3. Dispare e confirme projétil dourado, mensagem de dano 2 e **2 especiais**.
4. Acerte um monstro Médio com um tiro especial e confirme eliminação imediata.
5. Erre um tiro especial e confirme que uma carga também foi consumida.
6. Use as cargas restantes e confirme retorno automático à munição normal.

### Spawn e ciclo de vida

1. Observe itens aparecendo em diferentes direções e nunca dentro do jogador.
2. Deixe um item sem coletar e confirme o desaparecimento após cerca de 12 segundos.
3. Confirme que nunca existem dois itens ao mesmo tempo.
4. Ao terminar a onda 4, confirme que o item ativo desaparece antes do chefão.
5. Termine ou reinicie três partidas e verifique ausência de objetos e listeners residuais.

## Testes automatizados esperados

```powershell
npm run check
```

Os testes cobrem configuração, sorteio, posição, expiração, descarte, colisão
contínua, cura limitada, munição por projétil, consumo por disparo, prioridade do
primeiro impacto, HUD, metadados, API e regressões anteriores.

## Critérios de aceite

- [x] Probabilidades por onda estão centralizadas e validadas.
- [x] Existe no máximo um item ativo em posição válida.
- [x] O item expira e libera seus recursos corretamente.
- [x] A coleta exige um impacto do estilingue.
- [x] A cura é imediata e nunca ultrapassa 100.
- [x] A munição especial causa dano 2 e possui cargas limitadas.
- [x] Um projétil não coleta e causa dano ao mesmo tempo.
- [x] Itens não geram pontos nem aparecem durante o chefão.
- [x] HUD e feedback diferenciam vida e munição especial.
- [x] Replay e descarte não deixam estado residual.
- [x] `npm run check` termina sem falhas.

## Próximo passo

A Fase 17 fará a revisão final do HUD convencional, consolidando hierarquia,
responsividade e mensagens antes do back-end de partidas.
