# Fase 25 — Testes e otimização

## Status

**Em validação.** As Fases 23 e 24 foram aprovadas no Meta Quest 3 em 8 de
setembro de 2026. A versão estável `0.24.0` deu origem à candidata
`0.25.0-beta.1`, que precisa de uma última regressão manual depois das
otimizações abaixo.

## Mudanças implementadas

### Bugs e lifecycle

- o carregamento do motor 3D possui identidade própria e pode ser cancelado se
  o usuário voltar ao menu antes de ele terminar;
- falhas de importação liberam nova tentativa, sem manter uma Promise rejeitada
  no cache;
- quarenta ciclos automatizados de criação, carga, atualização e descarte de
  partida não deixam objetos na cena ou na câmera.

### Memória

O diagnóstico XR agora registra os picos de geometrias e texturas informados por
`renderer.info.memory`. Os dados aparecem no espelho desktop junto com FPS, pior
frame, draw calls e triângulos. Eles continuam locais e são zerados em cada nova
sessão imersiva.

### Performance e FPS

Placas de gelo, rochas e montanhas passaram a usar `InstancedMesh`. Os 25 meshes
repetidos foram reduzidos a quatro lotes — placa, rocha, corpo da montanha e neve
da montanha — economizando até 21 draw calls no cenário estático sem alterar
posições, escala, textura ou colisões.

Three.js, renderer, gameplay e WebXR agora são carregados somente ao iniciar uma
partida. No build verificado nesta fase:

| Orçamento | Medido | Limite |
|---|---:|---:|
| JavaScript inicial | 41.277 bytes | 102.400 bytes |
| JavaScript inicial gzip | 13.801 bytes | 35.840 bytes |
| JavaScript total | 696.006 bytes | 870.400 bytes |
| JavaScript total gzip | 181.631 bytes | 256.000 bytes |
| Texturas | 130.113 bytes | 184.320 bytes |

`npm run check:bundle` transforma esses limites em um gate do build. A divisão
também eliminou o aviso anterior de chunk JavaScript acima de 500 kB.

### Colisões e balanceamento

Além dos casos de tunneling, tangência, empate temporal e alvos móveis já
cobertos, 400 cenários determinísticos verificam que transladar toda a cena não
altera o resultado nem o instante da colisão. Vida, dano, resistência, ondas,
velocidades, pontuação e probabilidades não foram modificados nesta fase.

### Responsividade e compatibilidade

Os testes existentes continuam cobrindo HUD compacto, navegação por teclado,
fallback sem Pointer Lock, fallback sem WebXR, falhas de áudio e falhas de
textura. O carregamento sob demanda utiliza módulos ES, já exigidos pelo cliente
Vite e pelos navegadores compatíveis com WebXR.

## Matriz de validação manual

1. Abra a página com cache desativado e confirme que menu, nome e ranking
   aparecem antes do download do motor 3D.
2. Inicie e saia imediatamente da partida durante o carregamento; confirme que a
   arena não reaparece sozinha.
3. Entre e saia de cinco partidas, observando se canvas, áudio ou listeners são
   duplicados.
4. Complete uma partida no desktop em larguras de 320 px, 768 px e desktop.
5. Confirme tipos, colisões, itens, pontuação, vitória, derrota e ranking.
6. No Quest 3, jogue ao menos uma onda e o chefão, verificando HUD, mira,
   estilingue, texturas, áudio e partículas.
7. Registre FPS médio/mínimo, pior frame, frames lentos, draw calls, triângulos,
   geometrias e texturas antes de sair da sessão.
8. Execute `npm run check` e confirme testes, build e orçamentos aprovados.

## Critério de conclusão

A Fase 25 pode ser concluída quando a matriz manual passar em desktop e no Quest
3 sem regressão e `npm run check` permanecer verde. Como esta é a última fase do
roadmap incremental original, o passo seguinte será preparar publicação e
monitoramento da versão candidata.
