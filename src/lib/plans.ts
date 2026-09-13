export const PLANS = [
  {
    id: "basico",
    name: "Básico",
    price: "59,90",
    period: "por mês",
    blurb: "Para a academia organizar alunos, turmas e a cobrança no papel certo.",
    features: [
      "Cadastro de alunos e ficha completa",
      "Turmas, horários e frequência",
      "Mensalidades e contas a pagar",
      "Agenda e lembretes",
      "Uma academia, um dono",
    ],
    cta: "Começar no Básico",
    featured: false,
  },
  {
    id: "pro",
    name: "ProMaster",
    price: "99,90",
    period: "por mês",
    blurb: "Para quem quer a cobrança no WhatsApp e a operação inteira no mesmo lugar.",
    features: [
      "Tudo do Básico",
      "WhatsApp automático da mensalidade",
      "Loja e estoque da academia",
      "Campeonatos e medalhas",
      "Relatórios de receita",
    ],
    cta: "Assinar ProMaster",
    featured: true,
  },
] as const;
