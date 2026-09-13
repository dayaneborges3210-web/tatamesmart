import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { DEFAULT_CHARGE_TEXTS, phaseLabel, type ChargePhase } from "@/lib/cobranca";
import { BRANDS } from "@/lib/brands";
import { cn } from "@/lib/cn";
import { useDojo } from "@/lib/dojo-store";
import { FONTS, SCALE_MAX, SCALE_MIN, SCALE_STEP, clampScale } from "@/lib/fonts";
import { pingPrinter, printRaw, printerAgentUrl, setPrinterAgentUrl } from "@/lib/thermal";
import { waQrClient, waTestClient } from "@/lib/wa-client";

export const Route = createFileRoute("/configuracoes")({ component: ConfigPage });

const PHASES: ChargePhase[] = ["inicio", "lembrete", "vencimento", "atraso"];

export function ConfigPage() {
  return (
    <Shell>
      <ConfigBody />
    </Shell>
  );
}

function ConfigBody() {
  const {
    school,
    theme,
    logo,
    font,
    typeScale,
    ownerPhone,
    chargeTexts,
    waReady,
    waPhoneId,
    waUrl,
    waOwner,
    saveSchool,
    testWhatsApp,
    waQr,
    waState,
    loading,
  } = useDojo();
  const [name, setName] = useState(school);
  const [mark, setMark] = useState(logo);
  const [phone, setPhone] = useState(ownerPhone);
  const [texts, setTexts] = useState(chargeTexts);
  const [brand, setBrand] = useState(theme);
  const [face, setFace] = useState(font);
  const [scale, setScale] = useState(typeScale);
  const [apiId, setApiId] = useState(waPhoneId);
  const [apiUrl, setApiUrl] = useState(waUrl);
  const [apiToken, setApiToken] = useState("");
  const [apiInfo, setApiInfo] = useState("");
  const [qr, setQr] = useState("");
  const [waLink, setWaLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [agent, setAgent] = useState(printerAgentUrl());
  const [printInfo, setPrintInfo] = useState("");
  const showApiForm = waOwner;

  useEffect(() => {
    setName(school);
    setMark(logo);
    setPhone(ownerPhone);
    setTexts(chargeTexts);
    setBrand(theme);
    setFace(font);
    setScale(typeScale);
    setApiId(waPhoneId);
    setApiUrl(waUrl);
  }, [school, logo, ownerPhone, chargeTexts, theme, font, typeScale, waPhoneId, waUrl]);

  useEffect(() => {
    if (!waReady || loading) return;
    let stop = false;
    setBusy(true);
    void waQr()
      .then((r) => {
        if (stop) return;
        setWaLink(r.state === "open" ? "open" : "connecting");
        setQr(r.qr);
        setApiInfo(r.state === "open" ? "WhatsApp conectado." : "");
      })
      .catch((err: unknown) => {
        if (!stop) setApiInfo(err instanceof Error ? err.message : "Não gerou o QR.");
      })
      .finally(() => {
        if (!stop) setBusy(false);
      });
    return () => {
      stop = true;
    };
  }, [waReady, loading]);

  useEffect(() => {
    if (!waReady || waLink === "open") return;
    const t = window.setInterval(() => {
      void waState()
        .then((s) => {
          setWaLink(s);
          if (s === "open") setApiInfo("WhatsApp conectado.");
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(t);
  }, [waReady, waLink]);

  function persist(next: {
    waUrl?: string;
    waPhoneId?: string;
    waToken?: string;
    waAuto?: boolean;
  } = {}) {
    void saveSchool({
      name,
      theme: brand,
      logo: mark,
      font: face,
      typeScale: scale,
      ownerPhone: phone,
      chargeTexts: texts,
      waUrl: next.waUrl,
      waPhoneId: next.waPhoneId,
      waToken: next.waToken,
      waAuto: next.waAuto,
    });
  }

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Escola</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Configurações</h1>

      <section className="mt-8 max-w-xl">
        <h2 className="text-sm font-medium">Identidade</h2>
        <div className="mt-4 grid gap-3">
          <Field label="Nome da academia">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="WhatsApp do dono">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="62 9xxxx-xxxx" />
          </Field>
          <p className="text-xs text-subtle">O alarme da agenda avisa no celular e abre uma mensagem neste número.</p>
          <Field label="Logomarca">
            <div className="flex items-center gap-3">
              {mark ? (
                <img src={mark} alt="" className="size-12 rounded-md object-cover" />
              ) : (
                <span className="grid size-12 place-items-center rounded-md bg-surface text-lg font-semibold">
                  {(name || "T").trim().slice(0, 1).toUpperCase()}
                </span>
              )}
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setMark(String(reader.result || ""));
                    reader.readAsDataURL(file);
                  }}
                />
                <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-surface px-3 text-sm">
                  Enviar imagem
                </span>
              </label>
            </div>
          </Field>
          <Button type="button" disabled={busy || loading} onClick={() => persist()}>
            Salvar identidade
          </Button>
        </div>
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="text-sm font-medium">Cor da marca</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {BRANDS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                brand === b.id ? "border-fg bg-surface" : "border-border text-muted",
              )}
              onClick={() => {
                setBrand(b.id);
                void saveSchool({
                  name,
                  theme: b.id,
                  logo: mark,
                  font: face,
                  typeScale: scale,
                  ownerPhone: phone,
                  chargeTexts: texts,
                });
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="text-sm font-medium">Letra</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                face === f.id ? "border-fg bg-surface" : "border-border text-muted",
              )}
              onClick={() => {
                setFace(f.id);
                void saveSchool({
                  name,
                  theme: brand,
                  logo: mark,
                  font: f.id,
                  typeScale: scale,
                  ownerPhone: phone,
                  chargeTexts: texts,
                });
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const next = clampScale(scale - SCALE_STEP);
              setScale(next);
              void saveSchool({
                name,
                theme: brand,
                logo: mark,
                font: face,
                typeScale: next,
                ownerPhone: phone,
                chargeTexts: texts,
              });
            }}
          >
            A−
          </Button>
          <span className="text-sm text-muted">{scale}%</span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const next = clampScale(scale + SCALE_STEP);
              setScale(next);
              void saveSchool({
                name,
                theme: brand,
                logo: mark,
                font: face,
                typeScale: next,
                ownerPhone: phone,
                chargeTexts: texts,
              });
            }}
          >
            A+
          </Button>
        </div>
      </section>

      <section id="whatsapp" className="mt-10 max-w-xl scroll-mt-8">
        <h2 className="text-sm font-medium">WhatsApp da academia</h2>
        <p className="mt-1 text-sm text-muted">
          Abra o WhatsApp no celular do dono → Aparelhos conectados → Ler QR. Pronto. As mensalidades saem deste
          número.
        </p>
        {showApiForm ? (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setApiInfo("");
              persist({ waUrl: apiUrl || "http://129.121.55.118", waPhoneId: apiId, waToken: apiToken, waAuto: true });
              setApiInfo("API salva. O QR das academias já pode ser lido.");
            }}
          >
            <Field label="URL da Evolution (só a empresa mãe)">
              <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="http://129.121.55.118" />
            </Field>
            <Field label="Token global (só a empresa mãe)">
              <PasswordInput
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={waReady ? "já gravado — cole outro para trocar" : "token da Evolution"}
                autoComplete="off"
              />
            </Field>
            <Button type="submit" disabled={busy || loading}>
              Salvar API
            </Button>
          </form>
        ) : null}
        {!waReady && !waOwner ? (
          <p className="mt-4 text-sm text-muted">O QR aparece assim que a TatameSmart ligar o serviço.</p>
        ) : null}
        {waReady ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-5">
            <p className="text-sm font-medium">
              {waLink === "open" ? "Conectado" : busy ? "Gerando QR…" : "Leia o QR com o celular da academia"}
            </p>
            {apiInfo ? (
              <p className={`mt-2 text-sm ${/conectado|salva|enviada|gerado/i.test(apiInfo) ? "text-success" : "text-danger"}`}>
                {apiInfo}
              </p>
            ) : null}
            {waLink !== "open" && qr ? (
              <img src={qr} alt="QR do WhatsApp" className="mx-auto mt-4 size-64 rounded-sm bg-white p-3" />
            ) : null}
            {waLink === "open" ? (
              <p className="mt-3 text-sm text-muted">Cobranças e alarmes saem deste WhatsApp.</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setApiInfo("");
                  setBusy(true);
                  const override = apiToken.trim()
                    ? { url: apiUrl || "http://129.121.55.118", instance: apiId || "tatamesmart", token: apiToken.trim() }
                    : undefined;
                  void waQrClient(override)
                    .then((r) => {
                      setWaLink(r.state === "open" ? "open" : "connecting");
                      setQr(r.qr);
                      setApiInfo(r.state === "open" ? "WhatsApp conectado." : "Leia o QR no celular.");
                    })
                    .catch((err: unknown) => setApiInfo(err instanceof Error ? err.message : "Não gerou o QR."))
                    .finally(() => setBusy(false));
                }}
              >
                {waLink === "open" ? "Gerar outro QR" : "Atualizar QR"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setApiInfo("");
                  setBusy(true);
                  void (apiToken.trim()
                    ? waTestClient({
                        url: apiUrl || "http://129.121.55.118",
                        instance: apiId || "tatamesmart",
                        token: apiToken.trim(),
                        to: phone,
                      })
                    : waTestClient())
                    .then(() => setApiInfo("Teste enviado. Olhe o WhatsApp do dono."))
                    .catch((err: unknown) => setApiInfo(err instanceof Error ? err.message : "Falha no teste."))
                    .finally(() => setBusy(false));
                }}
              >
                Enviar teste
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="text-sm font-medium">Impressora térmica (RAW)</h2>
        <p className="mt-1 text-sm text-muted">
          O navegador não fala com USB. Rode o agente neste PC e a impressora recebe o cupom em ESC/POS.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            Baixe{" "}
            <a className="text-fg underline" href="/print-agent/iniciar.bat" download>
              iniciar.bat
            </a>{" "}
            e{" "}
            <a className="text-fg underline" href="/print-agent/TatameSmart-Impressora.ps1" download>
              TatameSmart-Impressora.ps1
            </a>
            .
          </li>
          <li>
            Coloque os dois na mesma pasta. Se a impressora for de rede, edite{" "}
            <a className="text-fg underline" href="/print-agent/printer.json" download>
              printer.json
            </a>{" "}
            com o IP (porta 9100).
          </li>
          <li>Dê dois cliques em iniciar.bat e deixe a janela aberta.</li>
        </ol>
        <Field label="Endereço do agente">
          <Input
            value={agent}
            onChange={(e) => {
              setAgent(e.target.value);
              setPrinterAgentUrl(e.target.value);
            }}
          />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPrintInfo("");
              void pingPrinter()
                .then(() => setPrintInfo("Agente no ar."))
                .catch((err: unknown) => setPrintInfo(err instanceof Error ? err.message : "Agente off."));
            }}
          >
            Testar agente
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPrintInfo("");
              void printRaw([school, "TatameSmart", "Teste de impressao"])
                .then(() => setPrintInfo("Enviado para a impressora."))
                .catch((err: unknown) => setPrintInfo(err instanceof Error ? err.message : "Não imprimiu."));
            }}
          >
            Imprimir teste
          </Button>
        </div>
        {printInfo ? <p className="mt-2 text-sm text-muted">{printInfo}</p> : null}
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="text-sm font-medium">Frases da cobrança</h2>
        <p className="mt-1 text-sm text-muted">
          O dono edita o texto do WhatsApp. Use {"{aluno}"} {"{escola}"} {"{valor}"} {"{vencimento}"} {"{competencia}"}
        </p>
        <div className="mt-4 grid gap-4">
          {PHASES.map((phase) => (
            <Field key={phase} label={phaseLabel(phase)}>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={texts[phase] || DEFAULT_CHARGE_TEXTS[phase]}
                onChange={(e) => setTexts({ ...texts, [phase]: e.target.value })}
              />
            </Field>
          ))}
          <Button type="button" disabled={busy || loading} onClick={() => persist()}>
            Salvar frases
          </Button>
        </div>
      </section>
    </>
  );
}
