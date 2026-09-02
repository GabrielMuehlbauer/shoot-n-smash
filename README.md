# Shoot 'n' Smash

Shoot 'n' Smash é um jogo 3D de tiro ao alvo e sobrevivência em ondas. O jogador
fica no centro de uma ilha infestada, observa a arena em 360° e usa um estilingue
para enfrentar monstros temáticos. O primeiro cenário é a região de neve.

> Status atual: **Fase 10 — vida e dano de contato**. O jogador começa cada
> sessão com 100 pontos de vida; um inimigo Fraco, Médio ou Resistente causa
> respectivamente 1, 2 ou 3 pontos ao alcançar o centro.

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

Não é necessário preencher `DATABASE_URL` para executar a Fase 10.

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
2. confirme a barra horizontal em **100 / 100**, observe no outro HUD qual tipo
   foi sorteado e localize o único monstro de gelo;
3. pressione **Ativar mira** e mova o mouse para apontar;
4. mantenha o botão esquerdo pressionado para acumular tensão e solte para
   disparar;
5. confirme que cada impacto válido cria um burst branco, consome o projétil e
   reduz a resistência em um acerto; o tipo Fraco exige 1, o Médio 2 e o
   Resistente 3 impactos;
6. em uma nova sessão, não dispare e confirme o contato após cerca de 12,4 a
   14,8 segundos. O inimigo é removido, a barra reage visualmente e a vida cai
   para 99, 98 ou 97 conforme o tipo Fraco, Médio ou Resistente.

Os HUDs identificam vida, tipo sorteado, resistência atual e tensão de 0% a
100%. A carga máxima é atingida em 1,2 segundo; segurar por mais tempo não
ultrapassa esse limite. O primeiro `Esc` libera o cursor e cancela uma carga em
andamento. Um novo `Esc`, com o cursor livre, retorna ao menu. O botão **Voltar
ao menu** continua disponível.

Para instruções detalhadas e o resultado esperado, consulte o
[guia da Fase 10](docs/phases/phase-10-vida-dano.md).

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
[guia de teste da Fase 10](docs/phases/phase-10-vida-dano.md#como-testar-manualmente).

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

Os projéteis caem pela gravidade e são removidos ao atingir o inimigo, tocar o
chão, completar 5 segundos, sair do raio útil da arena ou exceder o limite de
segurança. O teste de volumes móveis usa as posições anterior e atual do projétil
e do inimigo. O movimento relativo impede tunneling mesmo quando ambos se cruzam
entre frames.

## Gameplay planejado

- ondas, chefão, itens e pontuação;
- resultados, persistência MySQL e ranking.

Nenhum desses sistemas adicionais faz parte da Fase 10. O contato atual aplica
o dano uma única vez e encerra o encontro, mas ainda não inicia outro inimigo,
uma onda ou uma condição de derrota.

### Realidade virtual

- mão não dominante: segurar o estilingue;
- mão dominante: puxar e soltar o projétil.

Observação, mira, tensão e disparo estão ativos somente no modo convencional.
Controles XR e HUD imersivo ainda não fazem parte da Fase 10.

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
│       ├── gameplay/ # estilingue, projéteis, inimigo, colisão e impacto
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
- existe somente um inimigo hostil sorteado por sessão, sem respawn, ondas ou
  pontuação;
- cada sessão permite somente um contato, portanto a vida ainda não chega a zero
  pelo fluxo normal e não existe tela de derrota;
- MySQL ainda não possui migration ou tabelas;
- ranking e WebXR ainda não estão implementados;
- a interface atual representa o primeiro recorte de gameplay convencional.

## Próxima etapa

Fase 11: criar o primeiro ciclo de respawn controlado e a base configurável das
ondas, reutilizando o mesmo estado de vida entre encontros. Pontuação, chefão,
persistência, ranking e WebXR continuam em incrementos posteriores.

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
- [Guia da Fase 8](docs/phases/phase-08-inimigo-hostil.md)
- [Guia da Fase 9](docs/phases/phase-09-tipos-inimigo.md)
- [Guia da Fase 10](docs/phases/phase-10-vida-dano.md)
