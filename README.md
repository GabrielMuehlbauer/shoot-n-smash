# Shoot 'n' Smash

Shoot 'n' Smash é um jogo 3D de tiro ao alvo e sobrevivência em ondas. O jogador
fica no centro de uma ilha infestada, observa a arena em 360° e usa um estilingue
para enfrentar monstros temáticos. O primeiro cenário é a região de neve.

> Status atual: **Fase 4 — observação em 360°**. O jogador permanece no centro
> da arena de neve e pode olhar em qualquer direção com mouse e Pointer Lock,
> com limite vertical seguro e lifecycle testado.

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

Não é necessário preencher `DATABASE_URL` para executar a Fase 4.

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
e o servidor. Use **Abrir cena 3D** e depois **Ativar visão 360°**. Mova o
mouse para observar a arena; o primeiro `Esc` libera o cursor e um novo `Esc`,
já desbloqueado, retorna ao menu. O botão **Voltar ao menu** continua disponível.

Para instruções detalhadas e o resultado esperado, consulte o
[guia da Fase 4](docs/phases/phase-04-observacao-360.md).

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
[guia de teste da Fase 4](docs/phases/phase-04-observacao-360.md#como-testar).

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
- **Ativar visão 360°**: captura o ponteiro após uma ação explícita;
- **Mover o mouse**: gira somente a câmera; o jogador não se desloca;
- primeiro `Esc`: libera o ponteiro e mantém a cena;
- segundo `Esc`, com o ponteiro livre, ou **Voltar ao menu**: encerra o loop,
  libera listeners e recursos e retorna à tela inicial.

## Controles de gameplay planejados

### Navegador

- segurar botão esquerdo: acumular tensão;
- soltar botão esquerdo: disparar;
- `Esc`: pausar/liberar o ponteiro durante o gameplay.

### Realidade virtual

- mão não dominante: segurar o estilingue;
- mão dominante: puxar e soltar o projétil.

Observação e mira já estão ativas. Tensão, disparo e controles XR ainda não
fazem parte da Fase 4.

## Modo VR

WebXR será integrado depois que o núcleo convencional estiver estável. O modo
convencional permanecerá disponível quando `immersive-vr` não for suportado.
Testes no Meta Quest 3 exigirão uma URL HTTPS acessível pelo headset.

## Estrutura atual

```text
shoot-n-smash/
├── client/
│   └── src/
│       ├── config/  # valores do renderer, câmera e arena
│       ├── core/    # GameApp e RenderContext
│       ├── input/   # adaptador desktop de Pointer Lock
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
- a visão 360° desta fase é exclusiva do navegador desktop e requer Pointer Lock;
- dispositivos sem mouse recebem um fallback, mas ainda não possuem controle de câmera;
- não existem inimigos, projéteis ou ondas nesta fase;
- MySQL ainda não possui migration ou tabelas;
- ranking e WebXR ainda não estão implementados;
- a interface atual representa apenas a fundação do produto.

## Próxima etapa

Fase 5: iniciar o próximo incremento do vertical slice convencional sem
antecipar ondas, ranking ou WebXR. O escopo exato será detalhado antes da
implementação, preservando a câmera e o jogador estacionário desta fase.

Consulte também:

- [Arquitetura](docs/architecture.md)
- [Decisões técnicas](docs/decisions.md)
- [API](docs/api.md)
- [Banco de dados](docs/database.md)
- [Estratégia de testes](docs/testing.md)
- [Guia da Fase 2](docs/phases/phase-02-cena-threejs.md)
- [Guia da Fase 3](docs/phases/phase-03-cenario-neve.md)
- [Guia da Fase 4](docs/phases/phase-04-observacao-360.md)
