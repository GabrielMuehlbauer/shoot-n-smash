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
