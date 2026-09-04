# API

URL local: `http://127.0.0.1:3000`

## Endpoint disponível

### GET `/api/health`

Verifica se a API está executando e informa o estado da configuração MySQL.

Parâmetros: nenhum.

Resposta sem banco configurado — `200 OK`:

```json
{
  "status": "ok",
  "service": "shoot-n-smash-api",
  "phase": 17,
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
  "phase": 17,
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
  "phase": 17,
  "database": {
    "status": "unavailable"
  }
}
```

O endpoint nunca retorna a URL, usuário ou senha do MySQL.

## Erros gerais atuais

- `400`: JSON inválido;
- `413`: payload JSON maior que 16 KB;
- `415`: codificação do payload não suportada;
- `404`: rota da API não encontrada;
- `500`: erro interno não tratado;
- `503`: MySQL configurado, porém indisponível.

## Endpoints planejados

O gameplay da Fase 17 continua inteiramente no cliente e não adiciona endpoints.
Ondas, tipos, resistência, vida, itens, munição, dano, pontuação e resultado são estados locais e
não são enviados à API nesta etapa. A tela final também não persiste o nome do
jogador.
Estes contratos de persistência ainda não existem:

- `POST /api/partidas`: registrar uma partida concluída de maneira idempotente;
- `GET /api/ranking?cenario=neve`: consultar o melhor resultado por jogador no
  cenário solicitado.

O contrato completo será documentado antes da integração do ranking.
