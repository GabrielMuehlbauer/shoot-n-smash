# Fase 6 — Alvo, colisão e dano

## Objetivo

Validar o primeiro ciclo completo de acerto do Shoot 'n' Smash: mirar em um alvo
estático, detectar o caminho varrido pelo projétil, consumir a bola de neve e
reduzir a vida do alvo até o estado destruído.

## Escopo entregue

- um alvo low-poly estático em `(4, 2,15, -11)`;
- collider esférico de raio `1,25`;
- 100 pontos de vida e 25 de dano por impacto;
- colisão contínua segmento–esfera usando as posições anterior e atual;
- soma do raio do alvo com o raio `0,18` do projétil;
- consumo imediato do projétil no primeiro contato;
- estado destruído terminal após quatro impactos;
- HUD acessível com vida, estado e mensagem do último acerto;
- descarte idempotente do alvo e dos recursos Three.js;
- versão `0.6.0` no cliente, servidor e diagnóstico da API.

## Fora do escopo

A Fase 6 não implementa movimento do alvo, inimigo hostil, dano ao jogador,
respawn, ondas, pontuação, itens, resultados, persistência MySQL, ranking ou
WebXR.

## Parâmetros canônicos

| Regra | Valor |
|---|---:|
| Vida máxima | 100 PV |
| Dano por impacto | 25 PV |
| Acertos para destruir | 4 |
| Raio do alvo | 1,25 |
| Raio do projétil | 0,18 |
| Posição do alvo | x 4 · y 2,15 · z -11 |

Os parâmetros ficam em `client/src/config/gameplay-config.js`. O alvo foi
deslocado para a lateral e para o fundo da arena para não se sobrepor ao beacon
decorativo existente.

## Fluxo técnico

```text
SlingshotSystem
      ↓
ProjectileSystem integra a trajetória
      ↓
segmento previousPosition → posição atual
      ↓
CollisionSystem expande o raio alvo + projétil
      ↓
TargetSystem.applyDamage(25)
      ↓
projétil consumido + HUD 100 → 75 → 50 → 25 → 0
```

O teste analítico retorna o primeiro `t` no intervalo `[0, 1]`. Isso evita
`tunneling`: um projétil rápido ainda acerta mesmo quando começa de um lado do
alvo e termina do outro durante um único frame.

## Como executar

Na raiz do projeto:

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. O MySQL não precisa estar configurado; nesse caso
`GET /api/health` deve informar `database.status = not-configured`.

## Como testar

1. Confirme o selo **Fase 6 concluída** na página inicial.
2. Pressione **Verificar API** e confirme que a API está online na Fase 6.
3. Pressione **Abrir cena 3D**.
4. Localize o alvo azul à direita do beacon central.
5. Pressione **Ativar mira**.
6. Aponte o retículo para o alvo, carregue e solte o botão esquerdo.
7. Confirme a sequência de vida `100 → 75 → 50 → 25 → 0` no HUD.
8. Observe a mudança visual do alvo após o primeiro acerto e ao ser destruído.
9. Dispare fora do alvo e confirme que a vida não muda.
10. Dispare novamente após a destruição e confirme que não existe dano adicional.
11. Pressione `Esc` para liberar o cursor e novamente para voltar ao menu.
12. Entre e saia três vezes; cada nova sessão deve começar com 100 PV, um único
    canvas e um único alvo.
13. Abra as ferramentas do navegador e confirme que o Console não possui erros
    não tratados.

## Testes automatizados

Execute a verificação completa:

```powershell
npm run check
```

A cobertura acrescentada inclui:

- acerto frontal, tangência, início dentro do collider e erro lateral;
- segmento degenerado e validação de vetores/raios;
- tunneling entre dois frames;
- consumo do projétil antes do descarte por chão, alcance ou tempo;
- vida limitada entre 0 e 100;
- quatro eventos de dano e uma única destruição;
- tentativa de dano ignorada após o estado terminal;
- reset, construção parcial e descarte idempotente.

## Critérios de aceite

- [ ] O alvo aparece separado do beacon decorativo.
- [ ] Um tiro fora do volume não altera a vida.
- [ ] Um impacto válido remove apenas o projétil que acertou.
- [ ] Cada impacto causa exatamente 25 de dano.
- [ ] O quarto impacto deixa o alvo com 0 PV e visual destruído.
- [ ] Impactos posteriores não emitem novos eventos de dano ou destruição.
- [ ] O HUD visual e os atributos ARIA refletem o mesmo valor de vida.
- [ ] Três ciclos de entrada e saída não duplicam alvo, canvas ou listeners.
- [ ] `npm run check` termina sem falhas.

## Solução de problemas

- Se **Ativar mira** estiver desabilitado, use um navegador desktop com suporte
  a Pointer Lock e confirme que a página está em foco.
- Se o disparo não alcançar o alvo, use carga máxima e mire levemente acima do
  centro para compensar a gravidade.
- Se a API mostrar MySQL `not-configured`, isso é esperado nesta fase.
- Se uma porta estiver ocupada, encerre a instância anterior de `npm run dev`
  antes de iniciar outra.

## Próximo incremento

A Fase 7 evoluirá o mesmo alvo para uma patrulha horizontal e acrescentará
feedback visual no ponto de impacto. Ondas, pontuação e WebXR continuarão fora
desse recorte.
