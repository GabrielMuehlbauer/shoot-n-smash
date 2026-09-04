# Fase 19 — Banco de dados

## Objetivo da etapa

Persistir jogadores e partidas no MySQL sem alterar os contratos HTTP da fase
18 e sem impedir a execução local quando o banco não estiver configurado.

## Resultado esperado

- migrations criam `players` e `matches` com integridade referencial;
- `submission_id` impede partidas duplicadas;
- nomes normalizados reutilizam o mesmo jogador;
- escritas usam transação e queries parametrizadas;
- ranking sobrevive ao reinício quando o MySQL está ativo;
- execução sem `DATABASE_URL` continua usando memória;
- o diagnóstico informa `mysql` ou `memory` sem revelar credenciais.

## Arquivos envolvidos

- `server/src/database/migrations/*.sql`: schema versionado;
- `server/src/database/migration-runner.js`: trava, checksum e aplicação;
- `server/src/database/migrate.js`: comando executável;
- `server/src/database/pool.js`: pool em UTC e com limite de conexões;
- `server/src/matches/MysqlMatchRepository.js`: persistência parametrizada;
- `server/src/matches/createMatchRepository.js`: seleção do adaptador;
- `server/src/server.js` e `scripts/dev.js`: composição das dependências;
- `server/test/`: testes do schema, migrations e repositório.

## Implementação

O banco mantém duas entidades de domínio. `players.normalized_name` é único e
`matches.player_id` referencia o jogador. Cada partida guarda UUID de submissão,
pontuação, cenário, resultado, duração opcional, versão de configuração e data.

O repositório abre uma transação, cria ou localiza o jogador e insere a partida.
Se duas requisições tentarem o mesmo UUID simultaneamente, a restrição única
resolve a corrida e o registro existente é devolvido ao serviço.

As migrations são explicitamente aplicadas. Uma trava `GET_LOCK` impede dois
processos de alterar o schema juntos, e um checksum SHA-256 detecta qualquer
edição em arquivos já executados.

## Como configurar

Requer MySQL 8 ou superior. Primeiro crie o banco:

```sql
CREATE DATABASE IF NOT EXISTS shoot_n_smash
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Copie `.env.example` para `.env` e preencha:

```dotenv
DATABASE_URL=mysql://usuario:senha@localhost:3306/shoot_n_smash
```

Use uma conta com permissão para criar e alterar tabelas durante a migration.
Depois execute:

```bash
npm run db:migrate
npm run dev
```

## Como testar manualmente

1. Consulte `GET /api/health` e confirme `database.status: connected` e
   `storage.matches: mysql`.
2. Envie uma partida válida a `POST /api/partidas`.
3. Consulte `GET /api/ranking?cenario=neve` e confirme o registro.
4. Encerre e reinicie o servidor.
5. Consulte novamente e confirme que a partida permanece.
6. Repita `npm run db:migrate` e confirme que nenhuma migration é reaplicada.
7. Consulte no MySQL:

```sql
SELECT version, applied_at FROM schema_migrations ORDER BY version;
SELECT id, name, normalized_name FROM players;
SELECT id, submission_id, player_id, score, scenario, result
FROM matches
ORDER BY id;
```

8. Remova temporariamente `DATABASE_URL`, reinicie e confirme
   `storage.matches: memory`.

Validação automatizada:

```bash
npm run check
```

## Problemas possíveis

- `Unknown database`: crie `shoot_n_smash` antes da migration;
- `Access denied`: revise usuário, senha e permissões;
- `ECONNREFUSED`: confirme host, porta e serviço MySQL;
- checksum divergente: restaure a migration aplicada e crie um novo arquivo;
- banco configurado sem migrations: execute `npm run db:migrate`.

## Próximo passo

Fase 20: medir a partida no cliente, enviar o resultado uma única vez e criar a
interface do ranking global.
