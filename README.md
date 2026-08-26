# Shoot 'n' Smash

Shoot 'n' Smash é um jogo 3D de tiro ao alvo e sobrevivência em ondas. O jogador
fica no centro de uma ilha infestada, observa a arena em 360° e usa um estilingue
para enfrentar monstros temáticos. O primeiro cenário é a região de neve.

> Status atual: **Fase 1 — estrutura inicial**. A fundação web e a API estão
> executáveis; a cena Three.js começa na Fase 2.

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
- MySQL será necessário a partir da fase de persistência. Na Fase 1 ele é
  opcional.

## Instalação

Na raiz do projeto:

```bash
npm install
```

Crie a configuração local a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Não é necessário preencher `DATABASE_URL` para executar a Fase 1.

## Execução em desenvolvimento

Inicie cliente e API juntos:

```bash
npm run dev
```

URLs locais:

- jogo: [http://localhost:5173](http://localhost:5173);
- API: [http://127.0.0.1:3000](http://127.0.0.1:3000);
- diagnóstico: [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health).

Na tela inicial, use **Verificar API** para validar a comunicação entre o cliente
e o servidor.

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

## Controles planejados

### Navegador

- mouse com pointer lock: observar e mirar em 360°;
- segurar botão esquerdo: acumular tensão;
- soltar botão esquerdo: disparar;
- `Esc`: pausar/liberar o ponteiro.

### Realidade virtual

- mão não dominante: segurar o estilingue;
- mão dominante: puxar e soltar o projétil.

Os controles ainda não estão ativos na Fase 1.

## Modo VR

WebXR será integrado depois que o núcleo convencional estiver estável. O modo
convencional permanecerá disponível quando `immersive-vr` não for suportado.
Testes no Meta Quest 3 exigirão uma URL HTTPS acessível pelo headset.

## Estrutura atual

```text
shoot-n-smash/
├── client/       # interface web e futuro jogo Three.js
├── server/       # API Express e futura integração MySQL
├── docs/         # arquitetura, decisões e instruções técnicas
├── .env.example
└── package.json  # scripts e workspaces
```

A estrutura crescerá somente quando cada sistema for implementado.

## URLs públicas

- jogo publicado: pendente;
- API publicada: pendente.

## Limitações conhecidas

- a cena 3D ainda não foi implementada;
- o botão **Iniciar jogo** está desabilitado;
- não existem inimigos, projéteis ou ondas nesta fase;
- MySQL ainda não possui migration ou tabelas;
- ranking e WebXR ainda não estão implementados;
- a interface atual representa apenas a fundação do produto.

## Próxima etapa

Fase 2: criar `Scene`, `PerspectiveCamera`, `WebGLRenderer`, iluminação, chão,
resize e game loop usando formas simples.

Consulte também:

- [Arquitetura](docs/architecture.md)
- [Decisões técnicas](docs/decisions.md)
- [API](docs/api.md)
- [Banco de dados](docs/database.md)
- [Estratégia de testes](docs/testing.md)
