# Banco de dados

## Estado atual

MySQL foi aprovado como banco do projeto. A conexão opcional e o diagnóstico
foram preparados na Fase 1; até a Fase 16 ainda não existe schema nem migration.
Isso evita antecipar tabelas antes do contrato definitivo da pontuação e das
ondas.

## Configuração local

O servidor lê `DATABASE_URL` do `.env`:

```dotenv
DATABASE_URL=mysql://usuario:senha@localhost:3306/shoot_n_smash
```

Quando a variável está vazia, a API continua executando e informa
`not-configured` no diagnóstico.

## Modelo planejado

```text
players
- id
- name
- normalized_name
- created_at

matches
- id
- submission_id
- player_id -> players.id
- scenario
- result
- score
- resumo de eliminações e ondas
- duration_ms
- input_mode
- config_version
- completed_at
```

Regras planejadas:

- chave estrangeira de `matches.player_id` para `players.id`;
- `submission_id` único para impedir duplicações de rede;
- valores não negativos e enums controlados por constraints;
- data da partida gerada no servidor em UTC;
- índices para cenário, pontuação, data e melhor resultado por jogador;
- ranking calculado por consulta, sem tabela própria;
- queries sempre parametrizadas.

## Limitação de segurança

O servidor recalculará a pontuação e verificará limites da configuração. Um
cliente modificado ainda pode inventar um resumo plausível; autenticação e
simulação autoritativa ficam fora do ranking casual do MVP.
