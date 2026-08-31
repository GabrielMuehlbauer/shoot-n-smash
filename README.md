# Shoot 'n' Smash

Shoot 'n' Smash é um jogo 3D de tiro ao alvo e sobrevivência em ondas. O jogador
fica no centro de uma ilha infestada, observa a arena em 360° e usa um estilingue
para enfrentar monstros temáticos. O primeiro cenário é a região de neve.

> Status atual: **Fase 7 — alvo móvel e feedback de impacto**. O alvo patrulha
> horizontalmente, a colisão considera o movimento dos dois volumes e cada
> acerto cria um burst 3D curto no centro do projétil no primeiro contato.

## Equipe

- DIANGELO BETT VIEIRA
- GABRIEL FELIPE MUEHLBAUER
- GUSTAVO JUNIO TARIFA DE MORAES
- WAGNER LUZ BARBOSA JUNIOR

## Tecnologias

- HTML5, CSS3 e JavaScript com módulos ES;
- Vite e Three.js no cliente;
- Node.js e Express na API;
- MySQL com o driver `mysql2`;
- WebXR nas fases de realidade virtual;
- Node Test Runner para os testes iniciais.

## Requisitos

- Node.js 22.12 ou superior;
- npm 10 ou superior;
- MySQL será necessário a partir da fase de persistência. Na fase atual ele é
  opcional.

## Instalação

Na raiz do projeto:

```bash
npm install
```

Crie a configuração local a partir do exemplo, sem sobrescrever um arquivo que
já exista:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Não é necessário preencher `DATABASE_URL` para executar a Fase 7.

## Execução em desenvolvimento

Inicie cliente e API juntos:

```bash
npm run dev
```

URLs locais:

- jogo: [http://127.0.0.1:5173](http://127.0.0.1:5173);
- API: [http://127.0.0.1:3000](http://127.0.0.1:3000);
- diagnóstico: [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health).

Na tela inicial, use **Verificar API** para validar a comunicação entre o cliente
e o servidor. Para testar o recorte jogável:

1. pressione **Abrir cena 3D**;
2. pressione **Ativar mira** e mova o mouse para apontar;
3. mantenha o botão esquerdo pressionado para acumular tensão;
4. acompanhe o alvo azul em movimento e solte o botão esquerdo para disparar;
5. confirme o burst branco no impacto e a vida `100 → 75 → 50 → 25 → 0`.

O HUD mostra a tensão de 0% a 100%. A carga máxima é atingida em 1,2 segundo;
segurar por mais tempo não ultrapassa esse limite. O primeiro `Esc` libera o
cursor e cancela uma carga em andamento. Um novo `Esc`, com o cursor livre,
retorna ao menu. O botão **Voltar ao menu** continua disponível.

Para instruções detalhadas e o resultado esperado, consulte o
[guia da Fase 7](docs/phases/phase-07-alvo-movel-impacto.md).

## Build e execução de produção

Gere o cliente estático e inicie o Express:

```bash
npm run build
npm start
```

Depois do build, o Express serve o jogo e a API na mesma origem:
[http://127.0.0.1:3000](http://127.0.0.1:3000).

## Testes

Execute todos os testes e gere o build:

```bash
npm run check
```

Também é possível executar somente os testes:

```bash
npm test
```

O procedimento visual completo está no
[guia de teste da Fase 7](docs/phases/phase-07-alvo-movel-impacto.md#como-testar).

## Scripts

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia cliente Vite e API Express |
| `npm run dev:client` | Inicia somente o cliente |
| `npm run dev:server` | Inicia somente a API com reload |
| `npm run build` | Gera o build do cliente |
| `npm start` | Inicia o servidor de produção |
| `npm test` | Executa testes do cliente e servidor |
| `npm run check` | Executa testes e build |

## Configuração do MySQL

Quando a persistência for implementada, configure a URL no `.env`:

```dotenv
DATABASE_URL=mysql://usuario:senha@localhost:3306/shoot_n_smash
```

O `.env` não deve ser versionado. A aplicação não imprime senha ou URL do banco
nos diagnósticos públicos.

## Controles atuais da demonstração

- **Abrir cena 3D**: inicia a cena e o game loop;
- **Ativar mira**: captura o ponteiro após uma ação explícita;
- **Mover o mouse**: gira a câmera; o jogador não se desloca;
- **Segurar o botão esquerdo**: acumula tensão por até 1,2 segundo;
- **Soltar o botão esquerdo**: cria um projétil na direção da mira, com
  velocidade proporcional à tensão;
- primeiro `Esc`: cancela a carga, libera o ponteiro e mantém a cena;
- segundo `Esc`, com o ponteiro livre, ou **Voltar ao menu**: encerra o loop,
  libera listeners e recursos e retorna à tela inicial.

Os projéteis caem pela gravidade e são removidos ao atingir o alvo, tocar o chão,
completar 5 segundos, sair do raio útil da arena ou exceder o limite de segurança.
O teste de volumes móveis usa as posições anterior e atual do projétil e do alvo.
O movimento relativo impede tunneling mesmo quando ambos se cruzam entre frames.

## Gameplay planejado

- primeiro inimigo hostil e aproximação ao jogador;
- vida e dano do jogador;
- ondas, chefão, itens e pontuação;
- resultados, persistência MySQL e ranking.

Nenhum desses sistemas faz parte da Fase 7.

### Realidade virtual

- mão não dominante: segurar o estilingue;
- mão dominante: puxar e soltar o projétil.

Observação, mira, tensão e disparo estão ativos somente no modo convencional.
Controles XR e HUD imersivo ainda não fazem parte da Fase 7.

## Modo VR

WebXR será integrado depois que o núcleo convencional estiver estável. O modo
convencional permanecerá disponível quando `immersive-vr` não for suportado.
Testes no Meta Quest 3 exigirão uma URL HTTPS acessível pelo headset.

## Estrutura atual

```text
shoot-n-smash/
├── client/
│   └── src/
│       ├── config/  # valores do renderer, arena e gameplay
│       ├── core/    # GameApp, GameSession e RenderContext
│       ├── gameplay/ # estilingue, projéteis, alvo móvel, colisão e impacto
│       ├── input/   # adaptadores desktop de mira e disparo
│       ├── utils/   # resize e cálculos testáveis
│       └── world/   # composição visual do cenário de neve
├── server/       # API Express e futura integração MySQL
├── docs/         # arquitetura, fases e instruções técnicas
├── .env.example
└── package.json  # scripts e workspaces
```

A estrutura crescerá somente quando cada sistema for implementado.

## URLs públicas

- jogo publicado: pendente;
- API publicada: pendente.

## Limitações conhecidas

- o cenário utiliza somente primitivas low-poly e ainda não possui assets finais;
- mira e disparo são exclusivos do navegador desktop e requerem Pointer Lock e mouse;
- dispositivos sem mouse recebem um fallback, mas ainda não possuem controle de câmera;
- existe somente um alvo móvel; ainda não há inimigos, ondas ou pontuação;
- o alvo não ataca, não reaparece e não concede pontos;
- MySQL ainda não possui migration ou tabelas;
- ranking e WebXR ainda não estão implementados;
- a interface atual representa o primeiro recorte de gameplay convencional.

## Próxima etapa

Fase 8: definir o primeiro inimigo hostil sobre os sistemas já validados,
priorizando aproximação e contato com o jogador antes de introduzir ondas,
pontuação, ranking ou WebXR.

Consulte também:

- [Arquitetura](docs/architecture.md)
- [Decisões técnicas](docs/decisions.md)
- [API](docs/api.md)
- [Banco de dados](docs/database.md)
- [Estratégia de testes](docs/testing.md)
- [Guia da Fase 2](docs/phases/phase-02-cena-threejs.md)
- [Guia da Fase 3](docs/phases/phase-03-cenario-neve.md)
- [Guia da Fase 4](docs/phases/phase-04-observacao-360.md)
- [Guia da Fase 5](docs/phases/phase-05-disparo-convencional.md)
- [Guia da Fase 6](docs/phases/phase-06-alvo-colisao-dano.md)
- [Guia da Fase 7](docs/phases/phase-07-alvo-movel-impacto.md)
