# API

URL local: `http://127.0.0.1:3000`

## Endpoints disponíveis

### GET `/api/health`

Verifica se a API está executando e informa o estado da configuração MySQL.

Parâmetros: nenhum.

Resposta sem banco configurado — `200 OK`:

```json
{
  "status": "ok",
  "service": "shoot-n-smash-api",
  "phase": 18,
  "database": {
    "status": "not-configured"
  }
}
```

Resposta com banco conectado — `200 OK`:

```json
{
  "status": "ok",
  "service": "shoot-n-smash-api",
  "phase": 18,
  "database": {
    "status": "connected"
  }
}
```

Resposta quando existe configuração, mas o banco está indisponível —
`503 Service Unavailable`:

```json
{
  "status": "degraded",
  "service": "shoot-n-smash-api",
  "phase": 18,
  "database": {
    "status": "unavailable"
  }
}
```

O endpoint nunca retorna a URL, usuário ou senha do MySQL.

### POST `/api/partidas`

Registra uma partida concluída. Nesta fase o armazenamento é temporário em
memória e será substituído pelo MySQL na fase 19.

Parâmetros de URL: nenhum.

Body obrigatório:

```json
{
  "submissionId": "58c88869-98e8-4d6f-b80d-190990739f79",
  "nome": "Jogador",
  "pontuacao": 6800,
  "cenario": "neve",
  "resultado": "victory",
  "duracaoMs": 120000
}
```

Regras:

- `submissionId`: UUID obrigatório usado para idempotência;
- `nome`: de 1 a 24 caracteres após normalização dos espaços;
- `pontuacao`: inteiro entre 0 e 14.000;
- `cenario`: somente `neve` nesta fase;
- `resultado`: `victory` ou `defeat`;
- `duracaoMs`: opcional; inteiro entre 1 e 86.400.000.

Resposta para um novo registro — `201 Created`:

```json
{
  "duplicada": false,
  "partida": {
    "id": 1,
    "submissionId": "58c88869-98e8-4d6f-b80d-190990739f79",
    "jogador": {
      "id": 1,
      "nome": "Jogador"
    },
    "pontuacao": 6800,
    "cenario": "neve",
    "resultado": "victory",
    "duracaoMs": 120000,
    "data": "2026-09-04T12:00:00.000Z"
  }
}
```

Repetir o mesmo body com o mesmo `submissionId` retorna `200 OK`,
`"duplicada": true` e a partida original. Reutilizar esse ID com dados
diferentes retorna `409 Conflict` com código `SUBMISSION_CONFLICT`.

Possíveis erros: `400`, `409`, `413`, `415` e `500`.

### GET `/api/ranking`

Retorna o melhor resultado de cada jogador, ordenado da maior para a menor
pontuação. Empates compartilham a mesma posição.

Parâmetros opcionais:

- `cenario=neve`: filtra o cenário;
- `fase=neve`: alias compatível com a especificação inicial;
- `limite=10`: quantidade entre 1 e 100; o padrão é 10.

Exemplo: `GET /api/ranking?cenario=neve&limite=10`.

Resposta — `200 OK`:

```json
{
  "ranking": [
    {
      "posicao": 1,
      "nome": "Jogador",
      "pontuacao": 6800,
      "cenario": "neve",
      "data": "2026-09-04T12:00:00.000Z"
    }
  ],
  "total": 1,
  "filtros": {
    "cenario": "neve",
    "limite": 10
  }
}
```

Sem registros, `ranking` é uma lista vazia e `total` é zero. Filtros inválidos
retornam `400` com código `INVALID_RANKING_FILTER`.

Possíveis erros: `400` e `500`.

## Erros gerais atuais

- `400`: JSON inválido;
- `409`: `submissionId` reutilizado com dados diferentes;
- `413`: payload JSON maior que 16 KB;
- `415`: codificação do payload não suportada;
- `404`: rota da API não encontrada;
- `500`: erro interno não tratado;
- `503`: MySQL configurado, porém indisponível.

Erros de validação incluem `code` e uma lista `details` com campo e mensagem. O
servidor nunca inclui stack trace, segredo ou entrada bruta na resposta.

## Limitação da fase 18

Os contratos HTTP estão prontos, mas os registros ainda não sobrevivem ao
reinício do servidor e o jogo não os envia automaticamente. Persistência entra
na fase 19; integração do resultado e tela de ranking entram na fase 20.
