# Estilingue final

Asset original gerado com Blender Python, sem texturas externas. Madeira em Y
contínua, junção orgânica, facetas intencionais, empunhadura de couro enrolada,
amarrações nas pontas, elásticos com volume e bolso curvado com costuras.
O gelo fica restrito à ponta esquerda.

## Arquivos e regeneração

- `generate_slingshot.py`: gerador determinístico (Blender 4.5+/5.x; executado em 5.2.2).
- `slingshot_final.blend`: cena editável contendo somente o asset.
- `slingshot_final.glb`: exportação glTF 2.0 binária.
- `client/public/models/slingshot_final.glb`: cópia idêntica servida pelo jogo.
- `slingshot_final_preview.jpg`: renderização em três quartos.
- `slingshot_first_person_preview.jpg`: renderização frontal para inspeção.
- `slingshot_game_preview.jpg`: captura real da arena no Edge headless.
- `slingshot_final_report.json`: métricas e verificações do gerador.

Na raiz do projeto:

```sh
blender --background --python generate_slingshot.py
npm run check
```

O gerador sobrescreve apenas seus arquivos de saída. As câmeras e luzes de
apresentação são criadas **depois** de salvar o `.blend` e exportar o GLB.

## Métricas

| Propriedade | Valor |
| --- | ---: |
| Objetos | 7 (1 pai + 6 malhas) |
| Vértices editáveis no Blender | 1.878 |
| Faces no Blender | 2.244 |
| Triângulos exportados | 3.608 |
| Vértices no GLB, incluindo divisões de normais e cores | 8.096 |
| Materiais | 4 |
| GLB | 316.236 bytes (308,8 KiB) |
| Altura do asset | 0,719 m |
| Texturas / animações / armatures | 0 |
| Primitivas renderizáveis do asset | 6 |

Materiais: `Wood_Main` (roughness 0,78), `Leather` (0,73), `Rubber` (0,5)
e `Ice_Detail` (0,26). Todos têm metallic zero. A variação de cor é exportada
em `COLOR_0`, sem exigir suporte a shaders procedurais do Blender no navegador.

## Organização e orientação

```text
Slingshot_Root
├── Wood_Frame
├── Grip_Wrap
├── Band_L
├── Band_R
├── Leather_Pouch
└── Ice_Details
```

Pivô em `(0, 0, 0)`, dentro da empunhadura; centralização lateral com pequena
assimetria natural. Escalas aplicadas, em metros. No Blender: X lateral,
Y frente/trás, Z vertical. O exportador converte para glTF Y-up, frente -Z.
Elásticos e bolso permanecem malhas independentes. O bolso tem origem própria
para deslocamento, sem deslocar a madeira.

Não usar `extras.pivot` para texto: a versão do GLTFLoader deste projeto trata
esse nome como um vetor numérico. A descrição usa `pivot_description`.

## Uso no jogo

`SlingshotVisualSystem` carrega o modelo automaticamente no modo de primeira
pessoa. `SlingshotAsset.js` adapta a posição à câmera, acompanha a tensão
existente e deforma os elásticos mantendo as pontas fixas. Munição, colisões,
trajetória e pontuação continuam sob os sistemas originais. Nenhum clipe de
animação foi gravado no GLB.

O visual anterior fica disponível apenas durante o download ou se ocorrer
falha, sem impedir o início da partida. O carregamento é descartado com
segurança se o jogador sair antes de terminar. O visual específico dos
controles VR não foi substituído; o GLB permanece reutilizável nessa etapa.

Uso independente, sem o adaptador do jogo:

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('/models/slingshot_final.glb', ({ scene: slingshot }) => {
  scene.add(slingshot);
});
```

`SlingshotAsset.test.js` importa o arquivo real e verifica estrutura, eixos,
transformações finitas, escala, orçamento, materiais, cópia pública, tensão,
retorno, descarte e falhas de carregamento.

Verificação opcional em navegador Chromium/Edge instalado, com o frontend
em execução (`npm run dev:client`):

```sh
node scripts/verify-slingshot-browser.mjs
```

Use `BROWSER_EXECUTABLE` para outro caminho do executável e `GAME_URL` para
outra URL local. O teste usa um perfil temporário separado e uma janela
headless; não acessa abas nem sessões pessoais.

Validação realizada: 300 testes aprovados, build e orçamento de bundle
aprovados; arena e novo estilingue retornaram HTTP 200, partida em `PLAYING`
e nenhuma mensagem de falha da arena. Foi observado um erro independente
no ranking (`MatchApiClient.getRanking`: `fetch` com `Illegal invocation`),
não modificado nesta entrega.
