# Estratégia de testes

## Definição de pronto de um incremento

Cada fase deve entregar:

- comportamento executável;
- teste automatizado da lógica apropriada;
- procedimento manual reproduzível;
- build sem erro;
- console sem erros não tratados;
- documentação afetada atualizada.

## Fase 1

### Testes automatizados

```bash
npm test
```

Os testes atuais verificam:

- nome, cenário e quatro integrantes aprovados;
- imutabilidade da lista de integrantes;
- distinção entre API indisponível e somente MySQL indisponível;
- `GET /api/health` sem banco configurado;
- retorno `503` quando o MySQL configurado está indisponível;
- erro JSON `404` para uma rota desconhecida da API;
- respostas controladas para JSON malformado, payload maior que 16 KB e
  codificação não suportada;
- rejeição de portas inválidas na configuração.

### Build

```bash
npm run build
```

### Verificação completa

```bash
npm run check
```

### Teste manual

1. Execute `npm run dev`.
2. Abra `http://localhost:5173`.
3. Confirme título, cenário e os quatro integrantes.
4. Confirme que **Iniciar jogo** está desabilitado nesta etapa.
5. Pressione **Verificar API**.
6. Confirme a mensagem “API online”.
7. Acesse `http://127.0.0.1:3000/api/health`.
8. Sem `DATABASE_URL`, confirme `database.status = not-configured`.

## Estratégia futura

- testes unitários para vida, dano, estados, pontuação e ondas;
- testes de integração para colisões e partida completa;
- testes de API e migrations com um banco MySQL isolado;
- E2E convencional para menu, vitória, derrota, ranking e replay;
- mocks WebXR apenas para lógica de entrada;
- checklist manual obrigatório no Meta Quest 3;
- profiling e testes de reinício prolongados para detectar vazamentos.
