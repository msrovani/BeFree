# MEGA PROMPT — "Design BeFree UI v2: A Experiência da Liberdade Digital"

> Objetivo: elevar o design visual da interface do app **BeFree**, transformando-a em uma experiência visual e emocional capaz de angariar novos usuários e fidelizar os existentes, com estética moderna, fluidez e presença de IA empática.

## Contexto do Projeto

O BeFree é uma rede social P2P com IA pessoal integrada (JARBAS), movida pelo token BFR e pela reputação dos usuários. Cada interação é autêntica, ética e livre — validada criptograficamente e animada por uma IA que atua como companheira de criação. O público-alvo são usuários jovens, criativos, tecnófilos e conscientes, que buscam liberdade, privacidade e autenticidade.

## Diretrizes Visuais

1. **Estilo e atmosfera**
   - Tema Dark Elegante e Neo-Orgânico com gradientes sutis, brilhos suaves e transparências.
   - Inspiração: Midjourney, Ghost in the Shell e Apple Vision Pro.
   - Sensação: liberdade, mistério e pertencimento.
2. **Cores**
   - Fundo: `#09090b → #111827 → #000` com gradiente espacial.
   - Cor principal: azul-ciano holográfico `#38bdf8`.
   - Acentos: violeta etéreo `#8b5cf6`, verde "vida digital" `#22c55e`, dourado `#fbbf24`.
   - Cores adaptativas conforme reputação (positiva = brilho, negativa = opacidade).
3. **Tipografia**
   - Fonte primária: Inter / Satoshi / Manrope (geométrica e moderna).
   - Fonte IA/system: JetBrains Mono Light Italic para falas da JARBAS.
4. **Microanimações**
   - Posts com respiração suave e brilho conforme reputação.
   - IA com aura viva (partículas orbitando o avatar quando ativa).
   - Botões com hover de brilho translúcido e transições fluidas.
5. **Som e feedback sensorial**
   - Paisagem sonora ambiental com tons harmônicos curtos.
   - Publicar → acorde ascendente; recompensa → sininho digital; burn → dissipação suave.

## UX – Jornada do Usuário

1. **Primeira impressão**
   - Landing animada com nebulosa flutuante e frase dinâmica da JARBAS: "A liberdade começa quando você fala — e é ouvido."
2. **Navegação fluida**
   - Feed radial 3D com posts orbitando o usuário.
   - Barra inferior minimalista estilo vidro líquido com ícones: Feed, Círculos, Publicar, JARBAS, Perfil.
3. **Identidade emocional**
   - Perfil com aura reputacional animada.
   - Avatar da IA muda conforme humor/energia.
   - Selos holográficos indicam origem do conteúdo (IA, Captura, Remix).

## Stack Recomendado

- Next.js 15, Framer Motion, Three.js e TailwindCSS.
- Zustand/Jotai para estado leve.
- Radix UI e shadcn/ui para componentes acessíveis.
- Tone.js para sons interativos, React Voice Input + Whisper API para voz.
- Deploy em Vercel + Fleek com PWA offline.

## Estrutura Visual Desejada

```
🕊️ BeFree — Liberdade Digital

╭──────────────────────────────────────────────╮
│ 👤  Perfil | 💬 Círculos | 🧠 JARBAS | 🪙 BFR │
╰──────────────────────────────────────────────╯

🔮 Feed Radial Animado
    • Post 1 (respiração verde)
    • Post 2 (aura violeta IA)
    • Post 3 (pulse dourado de reputação)

🎙️ Barra inferior → “Fale com JARBAS...”
```

## Tarefas Esperadas do Agente Visual

1. Criar layout responsivo completo (desktop + mobile).
2. Implementar feed radial com IA viva.
3. Criar avatar animado para a JARBAS.
4. Aplicar glassmorphism e neon-luminescência.
5. Adicionar trilha sonora leve e microsons contextuais.
6. Manter compatibilidade PWA offline.

## Resultado Esperado

Um app que envolve visualmente, é fluido, humano e místico, transformando cada interação em experiência emocional.
