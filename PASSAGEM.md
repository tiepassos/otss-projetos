# Passagem: página Projetos OTSS (para continuar em outra conta)

Cole este arquivo (ou o link dele no GitHub) na primeira mensagem da nova conversa.

## Contexto em uma frase
Redesign da página **Projetos** do site do OTSS (www.otss.org.br, Wix Studio). Ela é feita como **Web Component** (`<otss-projetos>`), hospedada no GitHub Pages e lida do **CMS do Wix**, no mesmo modelo da nova Biblioteca (`<otss-biblioteca>`). O componente está pronto. Falta **colocar no Wix, ligar ao menu e publicar**.

## Onde está tudo
- **Código:** `F:\code\otss-projetos` → github.com/tiepassos/otss-projetos (branch `main`, último commit `7c73697`)
  - `src/projetos.js`: componente inteiro (JS puro, Shadow DOM, sem build)
  - `index.html`: prévia (`src/projetos.js?v=2026-11-03-4`; aumentar o `?v=` a cada publicação para evitar cache de 10 min do Pages)
  - `README.md`: campos do CMS e instalação
- **No ar (prévia):** https://tiepassos.github.io/otss-projetos/
- **Script para o Wix:** `https://tiepassos.github.io/otss-projetos/src/projetos.js`, tag `otss-projetos`
- **Prévia local:** `.claude/launch.json` em `F:\code` → config `otss-projetos` (porta 5203)
- **Biblioteca (irmã):** `F:\code\otss-biblioteca` → tiepassos/otss-biblioteca, tag `otss-biblioteca`

## Wix
- Site: **OTSS 2025**, site id `eef6fc1a-2e9b-47d7-b175-68ea9b7828ab`, Wix Studio, Velo ativo.
- Coleção usada: **`ProjetosPagina`** ("Projetos · Página nova"). A coleção original `PROJETOS` **não pode ser alterada**.
- `temas` é multi-referência para `BibliotecaTemas`. `nomeCurto` liga o projeto aos itens da Biblioteca (campo `projetos`).
- Leitura anônima via OAuth headless (client id já no código). **Nunca** guardar nem usar client secret.
- Página atual de Projetos: **PROJETOS** → `/projetos-otss` (a `/projetos` é uma lista automática).

## O que o componente já faz
- Hero com vídeo, título Museo 900 (atributo `fonte-titulo` para o webfont licenciado; não subir a fonte em repositório público), subtítulo Museo 500 (fonte do site).
- Mosaico de logos, botânicos em parallax (nunca de cabeça para baixo).
- Barra fixa com índice, filtros (tema e município) e dois modos: Narrativa e Mosaico.
- Nos capítulos, as fotos laterais trocam a cada 2,5 s quando o projeto tem mais de uma.
- Página do projeto em overlay (`#projeto=slug`).
- EITS fica oculto até ter texto. Saúde Mental não tem galeria.

### Integração com o menu do Wix (feito em 03/11)
- O menu do site **continua no Wix**. O usuário quer assim.
- **`sticky-offset` automático (padrão):** o componente mede a parte visível do cabeçalho fixo do Wix (`#SITE_HEADER` ou `header`; svg/img/nav/button/input visíveis) e gruda a barra logo abaixo, a ~105 px no desktop.
  - Acompanha quadro a quadro quando o menu "Desaparecer" esconde ao rolar: a barra sobe para 0 e desce quando o menu volta.
  - No celular o cabeçalho tem altura 0 (o menu é um botão flutuante), então o valor é 0.
  - Um número em `sticky-offset` fixa o valor.
- O cabeçalho do Wix vem com `z-index:auto`. O componente aplica `z-index:60` nele para o conteúdo não passar por cima. Os overlays (1000+) continuam acima.
- Com a barra grudada (`data-stuck`), um `::before` com `var(--paper)` preenche a faixa atrás do menu. A aba azul assenta sobre uma faixa creme.
- Tudo isso fica em `stickyTracker()` / `headerParts()` no topo de `src/projetos.js`, com o mesmo código em `biblioteca.js`.
- Testado injetando o script na página real com rolagem do mouse; funcionou.

## Descoberta importante
O cabeçalho **não é igual em todas as páginas**:
- PLATAFORMA (`/biblioteca`): seção cabeçalho `section101`, altura 127 px, "Efeito de rolagem: Desaparecer". É o que queremos.
- PROJETOS (`/projetos-otss`): outro cabeçalho (`comp-mchnf7ve`), `position: relative`, rola com a página.

Por isso a página nova de Projetos deve **nascer de uma cópia da página PLATAFORMA**, que já tem o cabeçalho certo.

## Estado no editor do Wix (nada publicado ainda)
- Já existe a página **"PLATAFORMA nova"** (cópia da PLATAFORMA) com:
  - cabeçalho;
  - uma seção nova em branco, em largura total, com um **Elemento personalizado `#customElement1`** ainda sem fonte;
  - a seção "Mapas / Plataforma de dados" (`section94`);
  - os rodapés `section2` e `section121`.
- Essa página é da **Biblioteca**. Falta informar: URL do servidor `https://tiepassos.github.io/otss-biblioteca/src/biblioteca.js`, tag `otss-biblioteca`.
- **Bloqueio:** controlando o Chrome pela extensão, a barra flutuante do elemento ("Escolher fonte" / "Configurações") não aparece. **A pessoa precisa clicar nesse botão** e preencher URL e tag. O resto dá para fazer pela automação.

## Próximos passos (Projetos)
1. No Wix Studio → Páginas → PLATAFORMA → ⋯ → **Duplicar** → nomear "PROJETOS nova".
2. Na cópia, apagar as seções de conteúdo. Manter o cabeçalho (`section101`, efeito "Desaparecer"), a seção de mapas se fizer sentido e os rodapés.
3. Pelo "+ Seções" abaixo do cabeçalho, criar uma seção, desligar "Aplicar largura máxima" e adicionar Elementos → Incorporar e redes sociais → **Elemento personalizado**.
4. **Ação manual:** Escolher fonte → URL do servidor `https://tiepassos.github.io/otss-projetos/src/projetos.js`, tag `otss-projetos`.
5. Elemento em largura total (margens 0, largura 100%), altura automática/conteúdo. Seção sem altura fixa.
6. Pré-visualizar: barra sob a aba azul, menu escondendo e reaparecendo, overlay do projeto acima do menu, celular.
7. Trocar os endereços sem apagar nada:
   - PROJETOS antiga → slug `projetos-otss-antiga`, oculta do menu e com noindex;
   - PROJETOS nova → slug `projetos-otss`.
   - Fazer o mesmo para PLATAFORMA (`biblioteca-antiga` / `biblioteca`).
8. Menu do site (no Wix): "PROJETOS" e o submenu apontando para a página nova; "PLATAFORMA" para a Biblioteca nova.
9. **Publicar** (a pessoa autorizou publicar) e testar www.otss.org.br/projetos-otss no desktop (1440) e no celular (375).

## Pendências antigas
- Webfont Museo 900 licenciado: subir no Wix e passar a URL em `fonte-titulo`.
- Texto do EITS no CMS.
- Biblioteca: `gh auth refresh -h github.com -s workflow` para enviar a Action de indexação diária (`.github/workflows/indexar.yml`).

## Preferências da pessoa
- Responder em português.
- Design primoroso, motion, parallax e animações de scroll.
- Seguir o design do site: Museo 900 nos títulos, Museo 500 nos subtítulos.
- Não mexer nas coleções originais do CMS.
