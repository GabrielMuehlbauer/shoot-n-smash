# Fase 18 — API de partidas

## Objetivo da etapa

Criar contratos HTTP validados para registrar partidas concluídas e consultar o
ranking global, mantendo o banco e a integração automática do jogo para as fases
seguintes.

## Resultado esperado

- `POST /api/partidas` aceita somente partidas completas e válidas;
- repetição de rede não duplica um registro;
- `GET /api/ranking` ordena o melhor resultado de cada jogador;
- filtros inválidos produzem respostas controladas;
- a data é gerada pelo servidor;
- o armazenamento temporário pode ser substituído pelo MySQL sem mudar as rotas.

## Arquivos envolvidos

- `server/src/app.js`: composição da API e middleware de erros;
- `server/src/routes/matches.js`: rotas de partidas e ranking;
- `server/src/matches/match-validation.js`: validação dos contratos;
- `server/src/matches/MatchService.js`: idempotência e ranking;
- `server/src/matches/InMemoryMatchRepository.js`: repositório temporário;
- `server/src/matches/errors.js`: erros públicos controlados;
- `server/test/`: testes unitários e HTTP;
- `docs/api.md`: referência completa dos endpoints.

## Implementação

O cliente fornece um `submissionId` UUID. O serviço usa esse valor como chave de
idempotência: repetir exatamente a mesma submissão retorna o registro original;
usar o UUID com dados diferentes retorna conflito. O nome é normalizado e
jogadores com o mesmo nome, ignorando maiúsculas, compartilham a identidade
temporária.

O ranking mantém apenas a maior pontuação de cada jogador. A ordenação usa
pontuação decrescente, data crescente e nome como desempates determinísticos.
Pontuações iguais compartilham a posição.

O limite de 14.000 representa o máximo possível com os valores atuais do jogo.
Essa verificação é uma barreira de sanidade, não uma proteção completa contra
trapaça. A validação detalhada do resumo da partida será preparada antes da
integração pública.

## Como executar

Na raiz do projeto:

```bash
npm run dev
```

A API estará em `http://127.0.0.1:3000`.

## Como testar manualmente

No PowerShell, registre uma partida:

```powershell
$body = @{
  submissionId = [guid]::NewGuid().ToString()
  nome = 'Jogador de Teste'
  pontuacao = 6800
  cenario = 'neve'
  resultado = 'victory'
  duracaoMs = 120000
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/partidas `
  -ContentType 'application/json' `
  -Body $body
```

Depois consulte:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/ranking?cenario=neve
```

Confirme:

1. o primeiro POST retorna `201` e `duplicada: false`;
2. repetir o mesmo `$body` retorna `200` e `duplicada: true`;
3. mudar a pontuação sem mudar o UUID retorna `409`;
4. nome vazio ou pontuação negativa retorna `400` com detalhes;
5. o ranking mostra posição, nome, pontuação, cenário e data;
6. reiniciar o servidor esvazia os dados temporários.

Validação automatizada:

```bash
npm run check
```

## Problemas possíveis

- os registros desta fase existem somente em memória;
- múltiplas instâncias do servidor não compartilham o ranking;
- o jogo ainda não envia sua tela de resultado para a API;
- autenticação e ranking competitivo protegido não fazem parte do MVP casual.

## Próximo passo

Fase 19: criar migrations para jogadores e partidas no MySQL e implementar um
repositório persistente com queries parametrizadas.
