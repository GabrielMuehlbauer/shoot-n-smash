# Shoot 'n' Smash

Shoot 'n' Smash é um jogo 3D de tiro ao alvo e sobrevivência em ondas. O jogador
fica no centro de uma ilha infestada, observa a arena em 360° e usa um estilingue
para enfrentar monstros temáticos. O primeiro cenário é a região de neve.

> Status atual: **Fase 20 — ranking global**. Partidas concluídas são enviadas
> automaticamente à API e o menu apresenta os melhores resultados persistidos.

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
4. mantenha o botão esquerdo pressionado para acumular tensão e solte para
   disparar;
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
[guia da Fase 20](docs/phases/phase-20-ranking.md).

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
[guia de teste da Fase 20](docs/phases/phase-20-ranking.md#como-testar-manualmente).

## Scripts

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia cliente Vite e API Express |
| `npm run dev:client` | Inicia somente o cliente |
| `npm run dev:server` | Inicia somente a API com reload |
| `npm run db:migrate` | Aplica migrations pendentes no MySQL configurado |
| `npm run build` | Gera o build do cliente |
| `npm start` | Inicia o servidor de produção |
| `npm test` | Executa testes do cliente e servidor |
| `npm run check` | Executa testes e build |

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
- estilingue com representação visual e trajetória aprimorada.

### Realidade virtual

- mão não dominante: segurar o estilingue;
- mão dominante: puxar e soltar o projétil.

Observação, mira, tensão e disparo estão ativos somente no modo convencional.
Controles XR e HUD imersivo ainda não fazem parte da Fase 20.

## Modo VR

WebXR será integrado depois que o núcleo convencional estiver estável. O modo
convencional permanecerá disponível quando `immersive-vr` não for suportado.
Testes no Meta Quest 3 exigirão uma URL HTTPS acessível pelo headset.

## Estrutura atual

```text
shoot-n-smash/
├── client/
│   └── src/
│       ├── api/     # cliente HTTP, snapshot de partida e ranking
│       ├── config/  # valores do renderer, arena e gameplay
│       ├── core/    # GameApp, GameSession e RenderContext
│       ├── gameplay/ # partida, ondas, estado, combate e pontuação
│       ├── input/   # adaptadores desktop de mira e disparo
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

- o cenário utiliza somente primitivas low-poly e ainda não possui assets finais;
- mira e disparo são exclusivos do navegador desktop e requerem Pointer Lock e mouse;
- dispositivos sem mouse recebem um fallback, mas ainda não possuem controle de câmera;
- existe somente um inimigo hostil ativo por vez; depois das quatro ondas, a
  mesma entidade é reutilizada em cada tentativa contra o chefão;
- existe no máximo um item ativo; ele expira após 12 segundos e novos itens não
  são sorteados durante o chefão;
- sem `DATABASE_URL`, partidas ficam em memória e somem ao reiniciar;
- a API valida limites e contratos, mas ainda não reconstrói a pontuação a partir
  de um log autoritativo de eventos;
- WebXR ainda não está implementado;
- a interface atual representa o primeiro recorte de gameplay convencional.

## Próxima etapa

Fase 21: aprimorar o estilingue, incluindo visual, tensão, força e trajetória.

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
