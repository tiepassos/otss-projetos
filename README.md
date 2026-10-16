# Projetos OTSS

Nova página de **Projetos** do site [otss.org.br](https://www.otss.org.br), em construção antes de ir para o Wix. Tudo vem do **CMS do Wix** em tempo real: projeto novo ou texto editado no CMS aparece na página sem mexer no código.

- Componente: [`src/projetos.js`](src/projetos.js) (Web Component `<otss-projetos>`, JavaScript puro, sem build)
- Prévia: `index.html` (publicada no GitHub Pages)

## O que a página tem

- **Hero** com o vídeo do OTSS ao fundo (zoom e parallax ao rolar), título em Museo 900, subtítulo em Museo 500, mosaico com os logos e cores de cada projeto (entrada em sequência, leve movimento com o mouse) e botânicos das ilustrações do site em camadas de parallax.
- **Barra fixa** com o índice de projetos (acompanha a rolagem e assume a cor do projeto na tela), filtros por tema/eixo e por município, e dois modos de leitura:
  - **Narrativa**: um capítulo por projeto, com foto fixa em parallax tingida na cor do projeto, logo, chamada, números em contagem animada e botão para a página completa;
  - **Mosaico**: cards na cor do projeto, com a foto revelada ao passar o mouse.
- **Página do projeto** (abre com transição circular a partir do clique; link direto `#projeto=povos`): capa em parallax, Sobre, Em números, Objetivos, Território (municípios + mapa), Quem executa (parceiros em faixa contínua), Galeria (rolagem lateral + ampliação), Vídeo, **Produção do projeto na Biblioteca** e Próximo projeto.

## Coleção no CMS: **Projetos · Página nova** (`ProjetosPagina`)

A coleção original **PROJETOS** não foi alterada.

| Campo | Para que serve |
|---|---|
| Nome do projeto / Nome curto | O nome curto aparece no índice e **liga o projeto à Biblioteca** (deve ser igual ao campo *Projetos* dos itens da Biblioteca, ex.: `Povos`) |
| Chamada | Frase curta abaixo do título |
| Formato, Período, Status | Etiquetas (ex.: Projeto · 2019–2029 · Em andamento) |
| O que é, Onde atua, Quem executa | Textos (parágrafos separados por linha em branco) |
| Objetivos | Lista; um objetivo por item. Se começar com “Título: texto”, o título fica em destaque |
| Números em destaque | Um por item, no formato `valor | rótulo` (ex.: `7.546 | elementos cartográficos`) — animam ao aparecer |
| Municípios / estados | Viram etiquetas e o filtro “Onde atuam” |
| Parceiros | Faixa contínua de parceiros |
| Cor do projeto | Hex (ex.: `#C8A87B`). O texto fica claro ou escuro automaticamente para manter o contraste |
| Logo | De preferência a versão branca/vetor, que vai sobre a cor do projeto |
| Foto de capa, Galeria, Mapa, Vídeo | Mídias da página |
| Site / Documento | Botões “Mais informações” e “Baixar documento” |
| Temas / Áreas | Ligados aos 17 temas da Biblioteca (cores dos eixos) e ao filtro |
| Ordem, Destaque, Visível | Ordem na página; desmarcar *Visível* esconde sem apagar |

## Instalar no Wix Studio

Igual à Biblioteca: **Elemento personalizado** → URL do servidor `https://tiepassos.github.io/otss-projetos/src/projetos.js` → tag `otss-projetos`, largura total e altura automática.

Atributos opcionais: `sticky-offset` (altura do cabeçalho fixo do site), `video-hero`, `biblioteca-url`, `fonte-titulo` / `fonte-titulo-familia` (Museo 900), `fonte-subtitulo` (Museo 500).

### Fontes
Títulos em **Museo 900** e subtítulos em **Museo 500**. A Museo 500 já é uma fonte do site no Wix (usada automaticamente). A Museo 900 é comercial e não está no repositório: suba o arquivo (com licença de webfont) no Wix e informe a URL em `fonte-titulo`. Sem isso, aparece para quem a tem instalada; nos demais casos, a reserva (Bitter 900).
