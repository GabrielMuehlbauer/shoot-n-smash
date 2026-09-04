# Fase 17 — Interface

## Objetivo da etapa

Finalizar o HUD convencional para manter vida, pontuação, onda, inimigo, itens e
tensão legíveis durante toda a partida, inclusive em telas pequenas.

## Resultado esperado

- os painéis superiores não disputam a mesma posição;
- vida, pontuação, munição especial, onda e resistência permanecem visíveis;
- a progressão apresenta cinco etapas: quatro ondas e o chefão;
- intervalos, retorno do chefão e conclusão recebem rótulos próprios;
- mensagens dinâmicas continuam disponíveis sem criar anúncios duplicados;
- margens respeitam as áreas seguras do dispositivo;
- o resultado e o gameplay das fases anteriores permanecem inalterados.

## Arquivos envolvidos

- `client/index.html`: composição semântica e medidor de etapa;
- `client/src/styles.css`: grade do HUD, estados e responsividade;
- `client/src/main.js`: ligação dos snapshots de onda com o DOM;
- `client/src/wave-hud.js`: descrição testável dos estados de onda;
- `client/src/wave-hud.test.js`: contratos do novo indicador;
- `client/src/phase-ui.test.js`: contratos estáticos, acessibilidade e layout;
- metadados, README e documentos técnicos.

## Implementação

`status-hud` agrupa os painéis de jogador e inimigo em uma única grade. No
desktop eles ocupam as extremidades da tela. Até 760 px, continuam lado a lado em
duas colunas compactas; os textos longos ficam limitados a duas linhas e a
legenda apenas explicativa é ocultada.

O `wave-hud` possui rótulo, detalhe e um elemento `progress` nativo. O módulo
`describeWaveState` transforma o snapshot do `WaveManager` em texto, valor,
limite, estado visual e nome acessível. As quatro ondas ocupam as etapas 1 a 4;
o confronto com o chefão ocupa a etapa 5.

O HUD não passa a controlar o jogo. Ele apenas representa snapshots publicados
pelos sistemas já existentes, preservando a separação entre gameplay e DOM.

## Como executar

Na raiz do projeto:

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`.

## Como testar manualmente

1. Confirme **Fase 17 concluída** na tela inicial.
2. Inicie a partida e confirme pontuação 0, vida 100 / 100, onda 1 de 4,
   inimigo 1 de 3 e tensão 0%.
3. Redimensione a janela para 760 px e depois 320 px; confirme dois painéis
   superiores sem sobreposição com a legenda ou o estilingue.
4. Elimine um inimigo e observe a atualização do detalhe e do medidor da onda.
5. Complete uma onda e confirme o texto de preparação da próxima.
6. Receba dano e confira redução imediata da barra de vida e feedback vermelho.
7. Colete os dois itens e confira cura, estado do item e cargas especiais.
8. Alcance o chefão e confirme a etapa 5, o rótulo **Chefão final** e a indicação
   de dez acertos necessários.
9. Permita um contato não letal do chefão e confirme **Preparando retorno**.
10. Termine em vitória e em derrota; confira as telas finais e o replay.
11. Navegue pelos botões com `Tab` e confirme foco visível.
12. Verifique o Console sem erros não tratados.

Validação automatizada completa:

```bash
npm run check
```

## Problemas possíveis

- Pointer Lock depende de uma ação explícita e pode ser bloqueado em iframes;
- zoom muito elevado ou telas excepcionalmente baixas reduzem o espaço útil da
  arena, embora instruções secundárias sejam ocultadas nessa condição;
- o HUD desta fase é convencional; uma versão imersiva será criada na etapa XR.

## Próximo passo

Fase 18: criar os endpoints iniciais da API e validar no servidor os dados que
serão usados pela persistência de partidas.
