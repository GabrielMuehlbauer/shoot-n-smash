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
