# Decisões técnicas

As decisões abaixo foram aprovadas em 26 de agosto de 2026.

## ADR-001 — Monorepo JavaScript modular

**Status:** aceita.

Cliente Vite/Three.js e servidor Express ficam no mesmo repositório, organizados
como workspaces npm. Isso simplifica instalação, scripts e implantação sem unir
as regras do jogo à API.

## ADR-002 — MySQL como banco relacional

**Status:** aceita.

MySQL substitui a proposta inicial de PostgreSQL. Será utilizado por meio de
`mysql2`, SQL parametrizado, constraints, índices e migrations SQL. Não será
adotado ORM no MVP.

## ADR-003 — Controle convencional

**Status:** aceita.

O navegador utilizará pointer lock para mirar. Manter o botão esquerdo pressionado
acumula tensão e soltá-lo dispara. Essa escolha evita conflito entre mouse-look e
arrastar o mesmo mouse para tensionar.

## ADR-004 — Ranking do MVP

**Status:** aceita.

O ranking será casual, sem login, e armazenará todas as partidas válidas. A visão
principal mostrará o melhor resultado de cada jogador por cenário. Derrotas podem
participar, empates compartilham posição e o modo de entrada será armazenado.

O servidor recalculará o placar a partir do resumo da partida e rejeitará valores
impossíveis. Isso não equivale a um sistema antifraude competitivo.

## ADR-005 — Pontuação do chefão

**Status:** aceita.

Somente as ondas 1–4 concedem 500 pontos por conclusão. O chefão concede 2.000
pontos e sua derrota conclui a fase, concedendo mais 1.000 pontos.

## ADR-006 — Interface específica para XR

**Status:** aceita como parte da arquitetura.

HTML/CSS será usado no navegador. Informações necessárias durante uma sessão
imersiva serão representadas em world-space dentro da cena, sem depender de
overlay HTML.

## ADR-007 — Observação desktop e semântica do Escape

**Status:** aceita em 27 de agosto de 2026.

A observação desktop usa o `PointerLockControls` oficial do Three.js com a
sensibilidade padrão de 0,002 radiano por unidade de movimento, multiplicador
1 e pitch limitado a ±85°. O yaw permanece livre para permitir giros de 360°.
Nenhuma função de translação do addon é exposta pelo adaptador do jogo.

Pointer Lock nunca é solicitado automaticamente: o usuário ativa a visão por
um botão focável. O primeiro `Esc` libera o cursor e preserva a cena; outro
`Esc`, já desbloqueado, retorna ao menu. Ao ocultar a aba, sair da cena ou
descartar a aplicação, o ponteiro é liberado e os listeners são removidos.

## ADR-008 — Fase 5 como menor vertical slice de disparo

**Status:** aceita em 27 de agosto de 2026.

A conversa de continuidade aprovou reordenar o roadmap original: antes de
inimigos, dano e ondas, a Fase 5 valida isoladamente o caminho completo entre
entrada convencional, carga, feedback no HUD, criação, trajetória e descarte de
um projétil. Essa sequência reduz o número de sistemas novos que precisam ser
diagnosticados ao mesmo tempo e mantém o incremento executável.

O botão esquerdo acumula uma carga normalizada de 0 a 1 em até 1,2 segundo. Ao
soltar, a carga define uma velocidade linear entre 10 e 24 unidades por segundo.
Os projéteis recebem gravidade de -9,8 e são descartados ao tocar o chão, após
5 segundos, fora do raio horizontal 40 ou pelo limite de 24 objetos ativos.

O recorte não antecipa inimigos, detecção de acerto em alvos, dano, ondas,
pontuação, ranking ou WebXR. Esses itens continuam no produto planejado; apenas
a ordem de implementação foi alterada para que cada risco seja validado em um
incremento menor.

## ADR-009 — Colisão contínua analítica antes de uma engine física

**Status:** aceita em 31 de agosto de 2026.

`ProjectileSystem` fornece a posição anterior e atual de cada bola de neve.
`GameSession` usa `CollisionSystem` para testar o segmento contra uma esfera com
o raio combinado do projétil e do alvo, aplica o dano pelo `TargetSystem` e
consome o projétil no primeiro impacto.

A posição final isolada permitiria que projéteis rápidos atravessassem um alvo
entre frames. A solução analítica é determinística, pequena e testável, sem
adicionar engine física, ECS ou `Raycaster` acoplado à aparência do objeto.

## ADR-010 — Patrulha senoidal e colisão por movimento relativo

**Status:** aceita em 31 de agosto de 2026.

O alvo de treinamento da Fase 7 calcula a patrulha horizontal a partir do tempo
total da sessão. A senoide mantém a trajetória entre `x = -4,5` e `x = 4,5`,
inverte a direção sem quina e produz o mesmo estado para diferentes subdivisões
do mesmo intervalo de tempo.

Para detectar o contato entre dois volumes móveis, o deslocamento do alvo é
subtraído do deslocamento do projétil e o teste segmento–esfera existente é
aplicado ao movimento relativo. O parâmetro `t` resultante interpola ambos os
centros no mesmo instante e congela o alvo nesse ponto quando o dano é fatal.

O feedback de acerto permanece um sistema separado: bursts 3D brancos duram
0,32 segundo, compartilham geometria e descartam seus materiais ao expirar. O
limite FIFO de 12 efeitos mantém o custo previsível sem acoplar apresentação à
matemática da colisão.

## ADR-011 — Encontro hostil mínimo e desempate temporal

**Status:** aceita em 1º de setembro de 2026.

A Fase 8 substitui o alvo de treinamento por exatamente um inimigo hostil. Ele
surge em um ângulo aleatório de 360°, dentro do anel de raio 17 a 20, e avança
radialmente a 1,25 unidade por segundo em direção ao centro lógico fixo do
jogador, `(0, 1,05, 0)`. O contato ocorre no raio horizontal `1,5`.

A durabilidade passa a ser expressa como resistência em quantidade de acertos,
sem reutilizar a escala de 100 pontos do alvo. O contrato permanece genérico,
mas a configuração deste recorte usa resistência `1` e força de projétil `1`,
portanto um impacto válido elimina o inimigo.

O contato com o jogador fica pendente até a avaliação dos projéteis do mesmo
frame. `GameSession` compara a fração `t` do primeiro impacto, obtida por colisão
contínua entre esferas móveis, com a fração `t` do contato. Prevalece o menor
valor; na igualdade, o impacto vence. Assim, somente um desfecho terminal —
`eliminated` ou `player-contact` — é publicado e a entidade é removida uma vez.

Esse incremento valida spawn, aproximação, colisão e ordem causal sem antecipar
sistemas dependentes. O contato ainda não reduz vida, e não há respawn, segunda
entidade, ondas ou pontuação na Fase 8.

## ADR-012 — Tipos normais como descritores selecionados por sessão

**Status:** aceita em 1º de setembro de 2026.

A Fase 9 representa os três tipos normais por descritores de configuração
imutáveis. `weak`, `medium` e `resistant` correspondem aos rótulos Fraco, Médio e
Resistente, às resistências `1`, `2` e `3` e a cores base distintas. Collider,
velocidade, spawn, contato e força do projétil continuam compartilhados.

Uma sessão seleciona uniformemente exatamente um descritor antes de criar o
inimigo. O gerador aleatório usado nessa escolha é injetável e independente do
gerador de spawn, evitando que a quantidade ou a ordem de amostras de uma regra
altere a outra. Estado, callbacks e HUD transportam o descritor escolhido, e um
`reset()` da mesma entidade preserva o tipo original.

Essa modelagem introduz diferenciação sem criar subclasses, uma fábrica de
entidades ou um sistema de ondas antes de haver necessidade. A sessão continua
com um único inimigo, e os desfechos e o desempate temporal da Fase 8 permanecem
inalterados. Vida do jogador e dano de contato por tipo ficam explicitamente para
a Fase 10; respawn, ondas, pontuação, chefão, persistência e XR seguem fora deste
incremento.

## ADR-013 — Vida isolada do DOM e dano aplicado pela sessão

**Status:** aceita em 2 de setembro de 2026.

A Fase 10 introduz `PlayerHealthSystem` com vida inicial e máxima 100. O sistema
aceita somente dano inteiro positivo, limita a vida a zero e publica snapshots
imutáveis. A barra HTML observa esses snapshots, mas não contém regra de dano;
assim, um futuro HUD XR poderá apresentar o mesmo estado sem duplicar gameplay.

Os descritores `weak`, `medium` e `resistant` passam a carregar dano 1, 2 e 3.
Quando `EnemySystem` confirma o desfecho terminal `player-contact`, o callback
interno de `GameSession` aplica esse valor antes de notificar o observador externo.
O estado terminal do inimigo e a perda de vida permanecem válidos mesmo quando
um callback de interface lança erro.

O desempate contínuo da Fase 8 permanece a autoridade causal: impacto letal
anterior ou empatado impede o contato e, portanto, não causa dano. O recorte
continua com um inimigo por sessão e não antecipa respawn, ondas, derrota,
pontuação, chefão ou WebXR.
