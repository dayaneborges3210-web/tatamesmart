function dash() {
  return "————————————————";
}

export function receiptMensalidade(opts: {
  school: string;
  aluno: string;
  month: string;
  amount: string;
  due: string;
  paidAt: string;
}) {
  return [
    opts.school.toUpperCase(),
    "TatameSmart",
    dash(),
    "Recibo de mensalidade",
    dash(),
    `Aluno: ${opts.aluno}`,
    `Competência: ${opts.month}`,
    `Vencimento: ${opts.due}`,
    `Valor: ${opts.amount}`,
    `Pago em: ${opts.paidAt}`,
    dash(),
    "Pagamento recebido.",
    "Obrigado. Oss.",
  ];
}

export function receiptVenda(opts: {
  school: string;
  item: string;
  qty: number;
  total: string;
  pay: string;
  aluno: string;
  soldOn: string;
}) {
  return [
    opts.school.toUpperCase(),
    "TatameSmart",
    dash(),
    "Recibo de venda",
    dash(),
    `Item: ${opts.item}`,
    `Qtd: ${opts.qty}`,
    `Aluno: ${opts.aluno}`,
    `Pagamento: ${opts.pay}`,
    `Total: ${opts.total}`,
    `Data: ${opts.soldOn}`,
    dash(),
    "Obrigado. Oss.",
  ];
}

export function printA4(lines: string[]) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!win) throw new Error("O navegador bloqueou a janela de impressão. Permita pop-ups neste site.");
  const doc = win.document;
  doc.title = "Imprimir A4";
  const style = doc.createElement("style");
  style.textContent = [
    "@page { size: A4; margin: 18mm; }",
    "body { margin: 0; color: #111; background: #fff; font: 16px/1.5 'IBM Plex Sans', 'Segoe UI', sans-serif; }",
    "main { max-width: 180mm; margin: 0 auto; padding: 8mm 0; }",
    "h1 { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; margin: 0 0 16px; color: #555; }",
    "p { margin: 0 0 6px; white-space: pre-wrap; }",
    "p.lead { font-size: 22px; font-weight: 600; }",
  ].join("\n");
  doc.head.appendChild(style);
  const main = doc.createElement("main");
  const h = doc.createElement("h1");
  h.textContent = "Folha A4";
  main.appendChild(h);
  lines.forEach((line, i) => {
    const p = doc.createElement("p");
    if (i === 0) p.className = "lead";
    p.textContent = line;
    main.appendChild(p);
  });
  doc.body.appendChild(main);
  win.focus();
  win.print();
}

