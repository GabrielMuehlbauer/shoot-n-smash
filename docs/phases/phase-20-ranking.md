# Fase 20 — Ranking global

## Objetivo da etapa

Integrar o jogo convencional aos contratos de partidas e ranking concluídos nas
Fases 18 e 19. Toda vitória ou derrota válida deve ser registrada e os melhores
resultados do cenário de neve devem aparecer no menu.

## Resultado esperado

- uma identidade UUID v4 é criada no início de cada partida;
- nome, pontuação, cenário, resultado e duração são congelados no encerramento;
- `POST /api/partidas` ocorre automaticamente uma vez por estado terminal;
- falhas exibem feedback e permitem retry com o mesmo UUID;
- respostas repetidas não duplicam a partida;
- o menu carrega `GET /api/ranking?cenario=neve&limite=10`;
- o ranking apresenta posição, nome, pontos, cenário e data;
- um envio concluído atualiza o ranking sem recarregar a página;
- replay e retorno ao menu continuam disponíveis enquanto o request acontece.

## Arquivos envolvidos

- `client/src/api/match-api.js`: contrato HTTP, UUID, snapshot e formatação;
- `client/src/main.js`: ciclo de envio, retry e projeção do ranking no DOM;
- `client/index.html`: tabela global e estado de persistência no resultado;
- `client/src/styles.css`: layout responsivo dos novos componentes;
- `server/src/app.js`: diagnóstico atualizado para a Fase 20;
- testes do cliente e servidor;
- README e documentação técnica.

## Implementação

`MatchApiClient` recebe uma implementação de `fetch`, o que mantém requests
testáveis sem servidor real. Respostas de ranking são validadas antes de chegar
ao DOM. Os nomes são inseridos somente por `textContent`.

Ao entrar na arena, o controlador guarda um UUID e o instante inicial. Na
transição para `VICTORY` ou `GAME_OVER`, cria um objeto imutável:

```json
{
  "submissionId": "58c88869-98e8-4d6f-b80d-190990739f79",
  "nome": "Jogador",
  "pontuacao": 5400,
  "cenario": "neve",
  "resultado": "victory",
  "duracaoMs": 120000
}
```

Esse objeto, e não o estado global mutável da interface, alimenta o request e
as novas tentativas. Um `Set` bloqueia dois envios simultâneos do mesmo UUID. A
idempotência definitiva continua no serviço e na chave única do banco.

O ranking usa controle de versão das consultas. Se duas atualizações se
sobrepuserem, somente a resposta mais recente pode alterar a tabela ou o status.

## Como executar

```bash
npm run dev
```

Acesse `http://127.0.0.1:5173`. Sem `DATABASE_URL`, a integração funciona com
memória temporária. Para persistência após reiniciar, configure o MySQL e rode:

```bash
npm run db:migrate
```

## Como testar manualmente

1. Inicie cliente e API com `npm run dev`.
2. Abra o menu e confirme o ranking vazio ou os resultados já persistidos.
3. Use **Atualizar ranking** e confirme o feedback de carregamento.
4. Informe um nome e inicie a partida.
5. Conclua com vitória ou derrota.
6. Confirme nome, resultado, pontuação, cenário e duração na tela final.
7. Aguarde **Partida registrada no ranking global**.
8. Volte ao menu e confirme o jogador na posição adequada.
9. Em DevTools, simule rede offline antes do encerramento e confirme a mensagem
   de erro e o botão **Tentar enviar novamente**.
10. Restaure a rede, use o botão e confirme o sucesso sem duplicação.
11. Clique rapidamente duas vezes durante uma tentativa e confirme um único
    request ativo para o UUID.
12. Inicie um replay antes de uma resposta lenta e confirme que a partida nova
    não recebe nome, pontos ou feedback da partida anterior.
13. Repita com dois resultados do mesmo nome e confirme somente o melhor no
    ranking.
14. Redimensione a janela para 320 px e confirme que a tabela rola na horizontal
    sem ampliar a página inteira.
15. Execute `npm run check` e confirme testes e build sem falhas.

## Problemas possíveis

- sem a API, o jogo continua jogável, mas o envio e a consulta falham;
- sem MySQL, o ranking em memória desaparece quando o servidor reinicia;
- a pontuação ainda é um resumo fornecido pelo cliente e validado por limites;
  validação autoritativa por log de eventos fica para uma etapa futura.

## Próximo passo

Fase 21: aprimorar o estilingue completo — representação visual, tensão, força e
trajetória — preservando o mesmo `SlingshotSystem` para desktop e o futuro XR.
