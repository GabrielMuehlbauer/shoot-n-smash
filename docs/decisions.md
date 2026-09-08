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

## ADR-014 — Ciclo curto antes das quatro ondas

**Status:** aceita em 3 de setembro de 2026.

A Fase 11 introduz três encontros sequenciais com intervalo configurável de
1,25 segundo. Continua existindo no máximo um inimigo ativo. A mesma entidade
3D é reiniciada após cada desfecho, mas seu tipo e spawn são sorteados novamente;
isso evita alocações repetidas de geometrias e materiais sem transformar um
`reset()` comum em sorteio implícito.

`GameSession` publica snapshots imutáveis com encontro atual, total e estado
`active`, `waiting` ou `complete`. A vida pertence à sessão e não é restaurada
nos respawns. Esse recorte valida a progressão e a persistência de estado antes
da Fase 12, sem antecipar a composição e o balanceamento das quatro ondas.

## ADR-015 — Progressão de ondas como estado puro

**Status:** aceita em 3 de setembro de 2026.

A Fase 12 cria `WaveManager` sem dependências de Three.js ou DOM. O sistema
controla quatro definições, o inimigo atual, intervalos e os estados `active`,
`between-enemies`, `between-waves` e `complete`. `GameSession` continua sendo a
fachada que converte pedidos de spawn em resets da entidade 3D.

As ondas possuem respectivamente 3, 4, 5 e 6 inimigos. Tipos são liberados de
Fraco para Fraco/Médio e depois para os três tipos normais; velocidades crescem
de 1,15 para 1,60, e intervalos caem de 1,25 para 0,80 segundo. Há uma pausa de
2,50 segundos entre ondas. Esses valores são parâmetros iniciais de balanceamento,
centralizados e não tratados como definitivos.

Permanece no máximo um inimigo ativo para reutilizar a entidade e manter pequeno
o custo do protótipo. Spawns simultâneos só deverão ser considerados após testes
de gameplay e desempenho. Chefão, pontuação e estados de vitória/derrota seguem
fora deste incremento.

## ADR-016 — Chefão como perfil da entidade reutilizada

**Status:** aceita em 3 de setembro de 2026.

A Fase 13 estende a máquina de ondas com `boss-pending` e `boss`. Depois dos 18
inimigos normais, há uma espera configurável de 3 segundos e um único pedido de
spawn do chefão. Seu desfecho leva o fluxo a `complete`, sem criar ainda estados
semânticos de vitória ou derrota.

O chefão é um descritor validado separado dos tipos normais: resistência 10,
dano 10, velocidade 0,85, escala visual 2,35, raio de colisão 2,20 e altura de
spawn 2,20. `EnemySystem.reset()` aceita esse perfil explícito e reutiliza a
entidade, as geometrias e os materiais existentes. Isso preserva a regra de uma
única entidade ativa e evita uma hierarquia de classes antes de haver padrões de
comportamento distintos que a justifiquem.

O HUD recebe a mesma forma de snapshot, mas usa o ID `boss` para apresentar o
nome e o estilo do confronto final. Pontuação, bônus, vitória, derrota e tela de
resultados permanecem fora deste incremento.

## ADR-017 — Pontuação por eventos idempotentes

**Status:** aceita em 3 de setembro de 2026.

A Fase 14 concretiza os valores definidos no ADR-005 em `GAMEPLAY_CONFIG.score`:
100, 250 e 500 pelas três classes normais, 500 por onda, 2.000 pelo chefão e
1.000 pela conclusão da fase. `ScoreManager` é independente de Three.js, DOM,
vida e progressão de ondas.

Cada concessão exige um ID semântico único. O gerenciador mantém os IDs já
processados e ignora repetições sem alterar o total nem notificar o HUD. A
pontuação é aplicada antes dos callbacks externos e permanece válida mesmo se
um observador falhar.

Contato não vale eliminação. Concluir o último encontro normal concede o bônus
da onda independentemente do desfecho; eliminar o chefão concede tanto seus
pontos quanto o bônus de fase. O contato do chefão não concede nenhum dos dois.
A interpretação visual desses desfechos como vitória ou derrota fica para a
Fase 15.

## ADR-018 — Estado global terminal separado da progressão das ondas

**Status:** aceita em 3 de setembro de 2026.

A Fase 15 introduz `GameStateManager` com uma transição global unidirecional:
`PLAYING → VICTORY | GAME_OVER`. Os estados `active`, `between-enemies`,
`between-waves`, `boss-pending`, `boss` e `complete` continuam pertencendo ao
`WaveManager`. Essa separação impede que uma pausa de spawn ou o fim de um
encontro seja interpretado como resultado da partida.

`VICTORY` ocorre somente quando o chefão é eliminado depois das quatro ondas.
`GAME_OVER` ocorre somente quando a vida chega a zero. Se o chefão alcançar o
jogador sem esgotar sua vida, ele causa 10 de dano, não concede pontos e retorna
a `boss-pending`; após a espera configurada, a entidade é reutilizada com a
resistência completa. Assim, um contato não letal não cria um terceiro desfecho
nem viola a condição de derrota definida para o MVP.

A transição terminal é idempotente e ocorre depois do processamento da
pontuação, garantindo que a vitória apresente também os bônus do chefão e da
fase. A partir dela, `GameSession` não aceita novos disparos nem atualiza o
gameplay. A interface mostra nome normalizado do jogador, resultado, pontuação e
cenário. O replay descarta a aplicação atual e constrói uma nova sessão; não
ressuscita nem reinicializa parcialmente o estado encerrado. Persistência,
ranking e duração da partida continuam fora deste incremento.

## ADR-019 — Um coletável ativo e força armazenada no projétil

**Status:** aceita em 4 de setembro de 2026.

A Fase 16 cria um `ItemSystem` responsável por sorteio, posição, visual,
expiração e desfecho do coletável. Existe no máximo um item ativo. Cada encontro
normal tenta um spawn usando as chances configuradas de 12%, 20%, 30% e 40% nas
quatro ondas. O item expira em 12 segundos e é removido antes do chefão. Isso
mantém o primeiro recorte legível e evita uma coleção de entidades sem necessidade.

Os dois efeitos do MVP são cura de 20, limitada à vida máxima, e três disparos
especiais de força 2, acumuláveis até seis. A carga especial é consumida quando o
projétil é lançado, inclusive em um erro. A força e o tipo de munição pertencem a
cada projétil, impedindo que um tiro normal já em voo seja promovido por uma
coleta posterior.

`GameSession` compara o tempo normalizado das colisões com item e inimigo e
resolve somente a primeira para cada projétil. Assim, uma bola de neve não coleta
um item e atinge o monstro no mesmo frame. Não foi adicionada biblioteca de
física, pontuação por item, poder temporário nem spawn de item no chefão.

## ADR-020 — HUD como projeção responsiva dos sistemas

**Status:** aceita em 4 de setembro de 2026.

A Fase 17 agrupa os painéis superiores em uma grade `status-hud`, mantendo
jogador e partida em regiões estáveis em vez de posicionar cada bloco de forma
independente. Em telas de até 760 px, duas colunas compactas preservam a leitura
simultânea de vida e onda; textos longos ficam limitados e conteúdo apenas
explicativo é ocultado.

O progresso usa cinco etapas explícitas: quatro ondas e chefão. A função pura
`describeWaveState` converte snapshots do `WaveManager` em rótulo, detalhe,
valor, máximo e descrição acessível para um `progress` nativo. A interface não
ganha autoridade sobre o gameplay e não adiciona novos booleanos de controle.

As mensagens já anunciadas por `shot-status` e `item-status` foram preservadas.
O estado do inimigo não se tornou outra live region, evitando anúncios
concorrentes a cada impacto. HUD imersivo, personalização visual e telemetria
continuam fora desta decisão.

## ADR-021 — Contrato idempotente antes da persistência

**Status:** aceita em 4 de setembro de 2026.

A Fase 18 introduz `POST /api/partidas` e `GET /api/ranking` sobre um repositório
em memória. Essa implementação é temporária, mas respeita a mesma fronteira que
o repositório MySQL usará: localizar submissão, criar partida e listar partidas.
Assim, a API pode ser testada antes de existir schema sem misturar armazenamento
às rotas.

Cada envio exige um UUID `submissionId`. Repetir os mesmos dados devolve a
partida original; reutilizar o UUID com dados diferentes retorna `409`. A data é
produzida pelo servidor. Nome, pontuação, cenário, resultado e duração são
validados antes de qualquer escrita.

O ranking apresenta o melhor resultado por identidade normalizada de jogador,
em ordem decrescente, com posições compartilhadas nos empates. O teto de 14.000
é derivado do balanceamento atual e serve apenas como validação de sanidade. O
jogo não envia resultados nesta fase; essa integração continua reservada para a
fase 20, depois da persistência.

## ADR-022 — Repositório MySQL selecionado na composição

**Status:** aceita em 4 de setembro de 2026.

A Fase 19 preserva o contrato de repositório da Fase 18. Quando
`DATABASE_URL` existe, a composição do servidor injeta `MysqlMatchRepository`;
sem a variável, injeta o adaptador em memória. Rotas e serviço não conhecem essa
escolha. Isso permite desenvolvimento sem banco e persistência real sem dois
fluxos de negócio.

O schema possui somente `players`, `matches` e a tabela técnica
`schema_migrations`. A criação de jogador e partida é transacional, IDs de
submissão e nomes normalizados são únicos, e todas as queries usam placeholders.
Datas são geradas no MySQL em UTC.

Migrations são explícitas por `npm run db:migrate`, não automáticas no boot. O
executor usa trava nomeada e checksum para impedir concorrência e alteração do
histórico. O banco precisa existir antes do comando; criar banco ou usuário
automaticamente exigiria privilégios excessivos da conta da aplicação.

## ADR-023 — Snapshot terminal e retry idempotente no cliente

**Status:** aceita em 4 de setembro de 2026.

A Fase 20 cria o UUID e registra o instante inicial junto com cada nova sessão.
Quando `GameStateManager` publica vitória ou derrota, o cliente consolida nome,
pontuação, cenário, resultado e duração em um objeto imutável antes de iniciar o
request. Replays não podem, portanto, alterar uma submissão ainda em trânsito.

Uma falha mantém o resultado na tela e libera nova tentativa com o mesmo UUID.
O cliente evita requests simultâneos do mesmo ID; a API e o índice único do
banco garantem idempotência mesmo após perda de resposta ou repetição manual.
O ranking permanece derivado de `matches`, sem cache ou nova tabela nesta fase.

## ADR-024 — WebXR como adaptador da mesma sessão de jogo

**Status:** aceita em 8 de setembro de 2026.

A Fase 22 não cria uma variante XR do gameplay. `XRSessionManager` controla
somente suporte, permissão e ciclo de `immersive-vr`; `XRSlingshotController`
traduz os dois controles em tensão, origem e direção. O resultado entra na mesma
`GameSession` e no mesmo `ProjectileSystem` do modo convencional.

A carga por tempo continua sendo o padrão desktop. A carga manual XR normaliza
a distância entre 0,12 m e 0,72 m, e a direção aponta da mão que puxou para a
mão que sustenta o estilingue. Essas medidas ficam centralizadas na configuração
e deverão ser revistas durante o teste físico da Fase 23.

O espaço `local-floor` é obrigatório para manter a escala em metros e a altura
do jogador. `bounded-floor` é apenas opcional, pois o jogador permanece no
centro e o jogo não depende de uma área física delimitada. Nenhuma biblioteca de
física ou pacote de modelos de controle foi adicionado; os indicadores visuais
usam primitivas Three.js locais.

O modo desktop permanece disponível quando WebXR não existe, é negado ou termina.
HUD 3D, configuração para canhotos e ajustes específicos do Meta Quest 3 não são
assumidos sem validação no dispositivo.

## ADR-025 — Telemetria local antes de otimizar para o Quest 3

**Status:** aceita em 8 de setembro de 2026.

A Fase 23 adiciona `XRPerformanceMonitor` antes de alterar qualidade visual ou
balanceamento. O monitor observa o intervalo bruto entre frames e os contadores
já mantidos pelo renderer. O gameplay continua usando delta limitado; misturar
os dois valores faria uma queda longa parecer artificialmente curta no relatório.

São mantidos apenas agregados: FPS médio e mínimo por janela, pior frame,
percentual acima de 20 ms, picos de draw calls e triângulos, duração e descrição
dos controles. Não há histórico por frame, persistência, fingerprint remoto ou
novo endpoint. Isso limita memória e evita transformar diagnóstico local em
coleta de dados do jogador.

A instrumentação não autoriza promover a Fase 23. Conforto, escala, mira e
legibilidade permanecem critérios físicos obrigatórios no Meta Quest 3.

## ADR-026 — HUD e mira devem existir dentro da cena XR

**Status:** aceita em 8 de setembro de 2026 após o primeiro ensaio no Quest 3.

Elementos HTML sobre o canvas não são uma interface válida dentro de uma sessão
`immersive-vr`. Vida, resistência, onda e pontos passam a ser desenhados em uma
única textura de canvas sobre um plano 3D. A textura só é invalidada por mudanças
de estado, reduzindo custo de CPU e upload para a GPU.

A mira XR segue as mãos, não o centro da tela: um anel indica a direção entre a
munição e o garfo, enquanto a trajetória de carga reutiliza a função balística do
projétil. O estilingue também passa a ter garfo completo e origem no ponto médio
das pontas. Assim, visual, previsão e disparo compartilham a mesma pose física.
