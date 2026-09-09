# Shoot 'n' Smash

Shoot 'n' Smash é um jogo 3D de tiro ao alvo e sobrevivência em ondas. O jogador
fica no centro de uma ilha infestada, observa a arena em 360° e usa um estilingue
para enfrentar monstros temáticos. O primeiro cenário é a região de neve.

> Status atual: **Fase 25 — testes e otimização em validação**. As Fases 23 e 24
> foram aprovadas no Meta Quest 3. A versão estável `0.24.0` deu origem à
> candidata `0.25.0-beta.1`. O cenário agora usa instâncias, o motor 3D é carregado sob demanda e
> o diagnóstico XR também acompanha geometrias e texturas na memória da GPU.

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
- MySQL 8 ou superior para persistência; sem ele, a API usa memória temporária.

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

Sem `DATABASE_URL`, o jogo e a API continuam executando com armazenamento
temporário. Para validar a persistência do ranking, configure o MySQL e aplique
as migrations conforme a seção abaixo.

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

1. informe o nome do jogador e pressione **Iniciar partida**;
2. confirme a barra horizontal em **100 / 100**, observe no outro HUD qual tipo
   foi sorteado e localize o único monstro de gelo;
3. pressione **Ativar mira** e mova o mouse para apontar;
4. mantenha o botão esquerdo pressionado: confirme o projétil sendo puxado nos
   elásticos, a força aumentando de 10 a 24 u/s e a trajetória pontilhada; solte
   para disparar pela origem do modelo;
5. confirme que cada impacto válido cria um burst branco, consome o projétil e
   reduz a resistência em um acerto; o tipo Fraco exige 1, o Médio 2 e o
   Resistente 3 impactos;
6. procure itens brilhantes durante as ondas e acerte-os: o verde recupera até
   20 de vida, sem superar 100, e o dourado concede 3 disparos de dano 2;
7. acompanhe no HUD quantos disparos especiais restam; cada tiro dourado consome
   uma carga, mesmo que erre;
8. complete as quatro ondas e confirme que, após 3 segundos, surge um chefão
   gigante identificado no HUD; ele exige 10 impactos e causa 10 de dano ao
   tocar o jogador. Se o contato não zerar a vida, ele retorna após a espera com
   resistência completa e sem conceder pontos;
9. acompanhe no HUD os pontos por eliminação e os bônus de 500 por onda; ao
   eliminar o chefão, confirme mais 2.000 pontos e 1.000 pela fase concluída;
10. confirme a tela de vitória com nome, resultado, pontuação, cenário, duração e
    o estado **Partida registrada no ranking global**;
11. volte ao menu e confirme o resultado no ranking. Use **Jogar novamente** para
    iniciar uma sessão limpa. Para validar a derrota, permita contatos até a vida
    chegar a zero; derrotas válidas também são registradas.

Os HUDs identificam pontuação, vida, item disponível, munição especial, etapa da
partida, inimigo atual, resistência e tensão de 0% a 100%. Em telas estreitas,
os painéis superiores formam duas colunas compactas e a legenda decorativa é
ocultada para preservar a arena. A carga máxima é atingida em 1,2 segundo; segurar por mais tempo não
ultrapassa esse limite. O primeiro `Esc` libera o cursor e cancela uma carga em
andamento. Um novo `Esc`, com o cursor livre, retorna ao menu. O botão **Voltar
ao menu** continua disponível.

Para instruções detalhadas e o resultado esperado, consulte o
[guia da Fase 25](docs/phases/phase-25-testes-otimizacao.md).

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

O procedimento completo está no
[guia de teste da Fase 25](docs/phases/phase-25-testes-otimizacao.md#matriz-de-validação-manual).

## Scripts

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia cliente Vite e API Express |
| `npm run dev:client` | Inicia somente o cliente |
| `npm run dev:server` | Inicia somente a API com reload |
| `npm run db:migrate` | Aplica migrations pendentes no MySQL configurado |
| `npm run build` | Gera o build do cliente |
| `npm run check:bundle` | Verifica os orçamentos do build já gerado |
| `npm start` | Inicia o servidor de produção |
| `npm test` | Executa testes do cliente e servidor |
| `npm run check` | Executa testes, build e orçamentos do pacote |

## Configuração do MySQL

Crie o banco vazio no MySQL:

```sql
CREATE DATABASE IF NOT EXISTS shoot_n_smash
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Configure a URL no `.env`:

```dotenv
DATABASE_URL=mysql://usuario:senha@localhost:3306/shoot_n_smash
```

Depois aplique o schema versionado:

```bash
npm run db:migrate
```

O comando pode ser repetido com segurança. Ele aplica somente arquivos novos e
interrompe se detectar que uma migration já aplicada foi modificada.

O `.env` não deve ser versionado. A aplicação não imprime senha ou URL do banco
nos diagnósticos públicos.

## Controles atuais da demonstração

- **Iniciar partida**: registra o nome local e inicia a cena e o game loop;
- **Ativar mira**: captura o ponteiro após uma ação explícita;
- **Mover o mouse**: gira a câmera; o jogador não se desloca;
- **Segurar o botão esquerdo**: acumula tensão por até 1,2 segundo;
- **Soltar o botão esquerdo**: cria um projétil na direção da mira, com
  velocidade proporcional à tensão;
- **Entrar em VR**: aparece habilitado somente quando o navegador confirma
  suporte a `immersive-vr`;
- **Controle esquerdo em VR**: sustenta a origem do estilingue;
- **Gatilho do controle direito em VR**: segure, afaste a mão para aumentar a
  tensão e solte; a direção vai da mão direita em direção ao estilingue;
- durante a carga, o estilingue 3D puxa bolsa, projétil e elásticos, enquanto o
  HUD mostra a força e pontos na arena antecipam a parábola do disparo;
- **Acertar um item**: coleta vida ou munição especial; não é necessário um
  comando separado;
- **Jogar novamente**: após vitória ou derrota, descarta a partida encerrada e
  inicia uma nova sessão;
- primeiro `Esc`: cancela a carga, libera o ponteiro e mantém a cena;
- segundo `Esc`, com o ponteiro livre, ou **Voltar ao menu**: encerra o loop,
  libera listeners e recursos e retorna à tela inicial.

Os projéteis caem pela gravidade e são removidos ao atingir o inimigo, tocar o
chão, completar 5 segundos, sair do raio útil da arena ou exceder o limite de
segurança. O teste de volumes móveis usa as posições anterior e atual do projétil
e do inimigo. O movimento relativo impede tunneling mesmo quando ambos se cruzam
entre frames.

## Gameplay planejado

- poderes temporários adicionais;
- controle de volume e preferência de áudio;
- opção de inverter as mãos do estilingue.

### Realidade virtual

- mão esquerda: segurar o estilingue;
- mão direita: puxar e soltar o projétil;
- distância entre as mãos: controla força, velocidade e alcance;
- separação de 12 cm corresponde à tensão mínima e 72 cm à tensão máxima.

Observação, mira, tensão e disparo usam o rastreamento do headset e dos dois
controles durante a sessão. Ao sair do VR, mouse, Pointer Lock e o estilingue em
primeira pessoa voltam a ser ativados sem reiniciar a partida.

## Modo VR

O botão **Entrar em VR** somente é liberado após
`navigator.xr.isSessionSupported('immersive-vr')` retornar suporte. Falhas de
detecção, permissão ou início da sessão não bloqueiam o modo convencional.

Em desenvolvimento, WebXR funciona em contexto seguro. `localhost` é aceito no
computador; para abrir no Meta Quest 3, use uma URL HTTPS acessível pelo headset.
A validação física de conforto, escala e ergonomia no Quest 3 pertence à Fase 23.

## Estrutura atual

```text
shoot-n-smash/
├── client/
│   └── src/
│       ├── api/     # cliente HTTP, snapshot de partida e ranking
│       ├── assets/  # manifesto e carregamento das texturas finais
│       ├── audio/   # efeitos procedurais com Web Audio
│       ├── config/  # valores do renderer, arena e gameplay
│       ├── core/    # GameApp, GameSession e RenderContext
│       ├── gameplay/ # partida, ondas, estado, combate e pontuação
│       ├── input/   # adaptadores desktop de mira e disparo
│       ├── xr/      # sessão immersive-vr e estilingue com dois controles
│       ├── utils/   # resize e cálculos testáveis
│       └── world/   # composição visual do cenário de neve
├── server/       # API Express, migrations e repositórios de partidas
├── docs/         # arquitetura, fases e instruções técnicas
├── .env.example
└── package.json  # scripts e workspaces
```

A estrutura crescerá somente quando cada sistema for implementado.

## URLs públicas

- jogo publicado: pendente;
- API publicada: pendente.

## Limitações conhecidas

- os modelos finais são low-poly e nativos do Three.js; não há modelos GLTF;
- o modo convencional requer Pointer Lock e mouse para mira e disparo;
- dispositivos sem mouse recebem um fallback, mas ainda não possuem controle de câmera;
- existe somente um inimigo hostil ativo por vez; depois das quatro ondas, a
  mesma entidade é reutilizada em cada tentativa contra o chefão;
- existe no máximo um item ativo; ele expira após 12 segundos e novos itens não
  são sorteados durante o chefão;
- sem `DATABASE_URL`, partidas ficam em memória e somem ao reiniciar;
- a API valida limites e contratos, mas ainda não reconstrói a pontuação a partir
  de um log autoritativo de eventos;
- a previsão balística indica gravidade e alcance, mas não antecipa colisões com
  monstros, itens ou elementos decorativos;
- o HUD 3D e o fluxo XR foram aprovados no Quest 3, mas as otimizações da Fase 25
  ainda precisam de um teste curto de regressão no dispositivo;
- a interface atual representa o primeiro recorte de gameplay convencional.

## Próxima etapa

Executar a matriz da Fase 25 em desktop e um teste curto de regressão no Quest 3,
registrando os novos picos de memória GPU, draw calls, triângulos e FPS.

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
- [Guia da Fase 11](docs/phases/phase-11-respawn-controlado.md)
- [Guia da Fase 12](docs/phases/phase-12-ondas.md)
- [Guia da Fase 13](docs/phases/phase-13-chefao.md)
- [Guia da Fase 14](docs/phases/phase-14-pontuacao.md)
- [Guia da Fase 15](docs/phases/phase-15-vitoria-derrota.md)
- [Guia da Fase 16](docs/phases/phase-16-itens.md)
- [Guia da Fase 17](docs/phases/phase-17-interface.md)
- [Guia da Fase 18](docs/phases/phase-18-api.md)
- [Guia da Fase 19](docs/phases/phase-19-banco-dados.md)
- [Guia da Fase 20](docs/phases/phase-20-ranking.md)
- [Guia da Fase 21](docs/phases/phase-21-estilingue-completo.md)
- [Guia da Fase 22](docs/phases/phase-22-webxr.md)
- [Guia da Fase 23](docs/phases/phase-23-meta-quest-3.md)
- [Guia da Fase 24](docs/phases/phase-24-assets-finais.md)
- [Guia da Fase 25](docs/phases/phase-25-testes-otimizacao.md)
