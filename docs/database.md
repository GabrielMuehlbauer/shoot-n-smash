# Banco de dados

## Estado atual

MySQL 8 foi adotado para a persistência do MVP. A Fase 19 cria schema versionado,
executor de migrations e `MysqlMatchRepository`. Quando `DATABASE_URL` não está
configurada, o servidor preserva o `InMemoryMatchRepository` para permitir o
desenvolvimento do jogo sem bloquear pela ausência do banco.

## Configuração local

O servidor lê `DATABASE_URL` do `.env`:

```dotenv
DATABASE_URL=mysql://usuario:senha@localhost:3306/shoot_n_smash
```

Quando a variável está vazia, a API continua executando e informa
`not-configured` e `storage.matches: memory` no diagnóstico.

Crie o banco antes de usar a URL:

```sql
CREATE DATABASE IF NOT EXISTS shoot_n_smash
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Depois execute:

```bash
npm run db:migrate
```

O executor cria `schema_migrations`, adquire uma trava nomeada no MySQL, aplica
arquivos pendentes na ordem e registra um checksum SHA-256. Alterar uma migration
já aplicada interrompe a execução. Criar uma nova mudança exige um novo arquivo
numerado; arquivos aplicados nunca devem ser editados.

## Modelo implementado

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
- score
- scenario
- result
- duration_ms
- config_version
- completed_at
```

Regras implementadas:

- chave estrangeira de `matches.player_id` para `players.id`;
- `submission_id` único para impedir duplicações de rede;
- score entre 0 e 14.000 e valores controlados por `CHECK`;
- data da partida gerada no servidor em UTC;
- índices para cenário, pontuação, data e melhor resultado por jogador;
- ranking calculado por consulta, sem tabela própria;
- queries sempre parametrizadas;
- transação para localizar/criar jogador e inserir a partida;
- `utf8mb4` para nomes com acentos e outros caracteres Unicode.

## Seleção do repositório

```text
DATABASE_URL vazia       -> InMemoryMatchRepository
DATABASE_URL preenchida  -> MysqlMatchRepository
```

O servidor não executa migrations automaticamente. Depois de configurar uma
instância nova, rode `npm run db:migrate` antes de iniciar a API. O endpoint
`/api/health` permite confirmar conexão e repositório ativo sem expor segredos.

## Limitação de segurança

O servidor verifica os limites da pontuação, mas ainda não recebe um resumo que
permita recalcular cada evento. Um cliente modificado pode inventar um resultado
plausível; autenticação e simulação autoritativa ficam fora do ranking casual do
MVP. Usuário e senha do banco permanecem somente em `DATABASE_URL`, fora do Git.
