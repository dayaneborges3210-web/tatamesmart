import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Badge, Button, Field, Input, PasswordInput } from "@/components/ui";
import { DEFAULT_CHARGE_TEXTS, phaseLabel, type ChargePhase } from "@/lib/cobranca";
import { BRANDS } from "@/lib/brands";
import { cn } from "@/lib/cn";
import { useDojo } from "@/lib/dojo-store";
import { FONTS, SCALE_MAX, SCALE_MIN, SCALE_STEP, clampScale } from "@/lib/fonts";
import { printA4 } from "@/lib/thermal";
import { waQrClient, waTestClient, waStateClient } from "@/lib/wa-client";
import { changePasswordFn } from "@/lib/change-password";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { isMaeEmail } from "@/lib/site";
import { saasCheckoutFn, saasConfirmFn, saasDeskFn, type SaasDesk } from "@/lib/saas-billing";
import { formatDatePt } from "@/lib/money";

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
    loading,
    role,
    lockedBranchId,
    branchId,
    branches,
  } = useDojo();
  const user = useCurrentUser();
  const staff = role === "staff";
  const showPlan = !staff && !isMaeEmail(user?.primaryEmail);
  const [tab, setTab] = useState<"academia" | "plano" | "seguranca" | "filiais">("academia");
  useEffect(() => {
    const selectPlan = () => {
      if (showPlan && (window.location.hash === "#plano" || new URLSearchParams(window.location.search).has("pagamento"))) setTab("plano");
    };
    selectPlan();
    window.addEventListener("hashchange", selectPlan);
    return () => window.removeEventListener("hashchange", selectPlan);
  }, [showPlan]);
  const unitId = lockedBranchId || branchId;
  const unitName = branches.find((b) => b.id === unitId)?.name || "esta unidade";
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
    void waQrClient({ branchId: unitId })
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
  }, [waReady, loading, unitId]);

  useEffect(() => {
    if (!waReady || waLink === "open") return;
    const t = window.setInterval(() => {
      void waStateClient(unitId)
        .then((s) => {
          setWaLink(s);
          if (s === "open") setApiInfo("WhatsApp conectado.");
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(t);
  }, [waReady, waLink, unitId]);

  function persist(next: {
    waUrl?: string;
    waPhoneId?: string;
    waToken?: string;
    waAuto?: boolean;
  } = {}) {
    return saveSchool({
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
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "min-h-11 rounded-md border px-4 text-sm",
            tab === "academia" ? "border-fg bg-surface text-fg" : "border-border text-muted hover:text-fg",
          )}
          onClick={() => setTab("academia")}
        >
          Academia
        </button>
        {showPlan ? (
          <button
            type="button"
            className={cn(
              "min-h-11 rounded-md border px-4 text-sm",
              tab === "plano" ? "border-fg bg-surface text-fg" : "border-border text-muted hover:text-fg",
            )}
            onClick={() => setTab("plano")}
          >
            Plano TatameSmart
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            "min-h-11 rounded-md border px-4 text-sm",
            tab === "seguranca" ? "border-fg bg-surface text-fg" : "border-border text-muted hover:text-fg",
          )}
          onClick={() => setTab("seguranca")}
        >
          Segurança e login
        </button>
        {!staff ? (
        <button
          type="button"
          className={cn(
            "min-h-11 rounded-md border px-4 text-sm",
            tab === "filiais" ? "border-fg bg-surface text-fg" : "border-border text-muted hover:text-fg",
          )}
          onClick={() => setTab("filiais")}
        >
          Filiais
        </button>
        ) : null}
      </div>

      {tab === "plano" ? <PlanTab /> : null}

      {tab === "seguranca" ? (
        <SecurityTab email={user?.primaryEmail || ""} />
      ) : null}

      {tab === "filiais" ? <BranchesTab /> : null}

      {tab === "academia" ? (
        <>
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
        <h2 className="text-sm font-medium">WhatsApp de {unitName}</h2>
        <p className="mt-1 text-sm text-muted">
          Cada filial lê o próprio QR no celular do professor ou do dono daquela unidade. As mensalidades desta filial saem deste número.
        </p>
        {showApiForm ? (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setApiInfo("");
              setBusy(true);
              void persist({ waUrl: apiUrl || "https://whatsapp.metalcoreerp.com.br", waToken: apiToken, waAuto: true })
                .then(() => { setApiToken(""); setApiInfo("API salva. Atualize o QR para conectar."); })
                .catch((err: unknown) => setApiInfo(err instanceof Error ? err.message : "Não foi possível salvar a API."))
                .finally(() => setBusy(false));
            }}
          >
            <Field label="URL da Evolution (só a empresa mãe)">
              <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://whatsapp.metalcoreerp.com.br" />
            </Field>
            <Field label="Token global (só a empresa mãe)">
              <PasswordInput
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={waReady ? "já gravado — cole outro para trocar" : "token da Evolution"}
                autoComplete="off"
              />
            </Field>
            <p className="text-xs text-muted">
              Cole URL e token global. A instância de cada academia (e o QR) nasce sozinha — não use METALCORE.
            </p>
            <Button type="submit" disabled={busy || loading}>
              Salvar API
            </Button>
          </form>
        ) : null}
        {!waReady && !waOwner ? (
          <p className="mt-4 text-sm text-muted">O QR da sua academia aparece assim que a empresa mãe ligar a API.</p>
        ) : null}
        {waReady ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-5">
            <p className="text-sm font-medium">
              {waLink === "open" ? "Conectado" : busy ? "Gerando QR…" : `Leia o QR com o celular de ${unitName}`}
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
                    ? { url: apiUrl || "https://whatsapp.metalcoreerp.com.br", token: apiToken.trim() }
                    : undefined;
                  void waQrClient(override ? { ...override, branchId: unitId } : { branchId: unitId })
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
                        url: apiUrl || "https://whatsapp.metalcoreerp.com.br",
                        token: apiToken.trim(),
                        to: phone,
                        branchId: unitId,
                      })
                    : waTestClient({ branchId: unitId }))
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
        <h2 className="text-sm font-medium">Impressora A4</h2>
        <p className="mt-1 text-sm text-muted">
          Recibos de mensalidade e da loja saem na impressora A4 do computador, pelo diálogo normal do navegador.
        </p>
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPrintInfo("");
              try {
                printA4([school || "TatameSmart", "TatameSmart", "Teste de impressão A4"]);
                setPrintInfo("Abriu o diálogo de impressão A4.");
              } catch (err: unknown) {
                setPrintInfo(err instanceof Error ? err.message : "Não imprimiu.");
              }
            }}
          >
            Imprimir teste A4
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
      ) : null}
    </>
  );
}

function SecurityTab({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  return (
    <section className="mt-8 max-w-xl">
      <h2 className="text-sm font-medium">Segurança e login</h2>
      <p className="mt-1 text-sm text-muted">Troque a senha da academia sem sair do sistema.</p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setInfo("");
          if (next !== confirm) {
            setError("As senhas novas não são iguais.");
            return;
          }
          setBusy(true);
          void changePasswordFn({ data: { current, next, confirm } })
            .then(() => {
              setCurrent("");
              setNext("");
              setConfirm("");
              setInfo("Senha atualizada. Use a senha nova no próximo login.");
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Não foi possível trocar a senha.");
            })
            .finally(() => setBusy(false));
        }}
      >
        <Field label="E-mail de login">
          <Input value={email} readOnly disabled />
        </Field>
        <Field label="Senha atual">
          <PasswordInput
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            minLength={8}
            autoComplete="current-password"
          />
        </Field>
        <Field label="Senha nova">
          <PasswordInput
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Repita a senha nova">
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {info ? <p className="text-sm text-success">{info}</p> : null}
        <Button type="submit" disabled={busy || !current || !next || !confirm}>
          {busy ? "Salvando…" : "Salvar senha nova"}
        </Button>
      </form>
    </section>
  );
}

function BranchesTab() {
  const { branches, addBranch, saveBranch } = useDojo();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [pix, setPix] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPix, setEditPix] = useState("");

  return (
    <section className="mt-8 max-w-xl">
      <h2 className="text-sm font-medium">Filiais</h2>
      <p className="mt-1 text-sm text-muted">
        Cada filial tem plano, PIX, mensalidade e caixa próprios. O aluno paga na unidade onde treina.
      </p>
      <div className="mt-4 grid gap-3">
        {branches.map((b) => (
          <div key={b.id} className="rounded-lg border border-border bg-surface p-4">
            {editId === b.id ? (
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setBusy(true);
                  void saveBranch({ id: b.id, name: editName, address: editAddress, phone: editPhone, pix: editPix, active: b.active })
                    .then(() => {
                      setEditId(null);
                      setInfo("Unidade atualizada.");
                    })
                    .finally(() => setBusy(false));
                }}
              >
                <Field label="Nome">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </Field>
                <Field label="Endereço">
                  <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                </Field>
                <Field label="Telefone">
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </Field>
                <Field label="PIX desta unidade">
                  <Input value={editPix} onChange={(e) => setEditPix(e.target.value)} placeholder="chave PIX" />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    Salvar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditId(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {b.name}{" "}
                  <span className="text-xs font-normal text-muted">{b.kind === "matriz" ? "Matriz" : "Filial"}</span>
                  {!b.active ? <span className="ml-2 text-xs text-danger">inativa</span> : null}
                </p>
                {b.address ? <p className="mt-1 text-sm text-muted">{b.address}</p> : null}
                {b.phone ? <p className="text-sm text-muted">{b.phone}</p> : null}
                <p className="mt-1 text-sm text-muted">PIX: {b.pix || "ainda sem chave"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditId(b.id);
                      setEditName(b.name);
                      setEditAddress(b.address);
                      setEditPhone(b.phone);
                      setEditPix(b.pix);
                    }}
                  >
                    Editar
                  </Button>
                  {b.kind !== "matriz" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void saveBranch({ id: b.id, name: b.name, address: b.address, phone: b.phone, pix: b.pix, active: !b.active })
                          .then(() => setInfo(b.active ? "Filial desativada." : "Filial reativada."))
                          .finally(() => setBusy(false));
                      }}
                    >
                      {b.active ? "Desativar" : "Reativar"}
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <form
        className="mt-6 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setInfo("");
          void addBranch({ name, address, phone, pix })
            .then(() => {
              setName("");
              setAddress("");
              setPhone("");
              setPix("");
              setInfo("Filial criada. Troque a unidade no menu para cadastrar alunos nela.");
            })
            .catch((err: unknown) => setInfo(err instanceof Error ? err.message : "Não criou a filial."))
            .finally(() => setBusy(false));
        }}
      >
        <h3 className="text-sm font-medium">Nova filial</h3>
        <Field label="Nome da unidade">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Unidade Centro" required />
        </Field>
        <Field label="Endereço">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Telefone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="PIX desta unidade">
          <Input value={pix} onChange={(e) => setPix(e.target.value)} placeholder="chave PIX da filial" />
        </Field>
        {info ? <p className="text-sm text-muted">{info}</p> : null}
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Salvando…" : "Adicionar filial"}
        </Button>
      </form>
    </section>
  );
}

function PlanTab() {
  const [desk, setDesk] = useState<SaasDesk | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void saasDeskFn()
      .then(setDesk)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Não carregou o plano."));
    const q = new URLSearchParams(window.location.search);
    const pagamento = q.get("pagamento");
    const id = q.get("payment_id") || q.get("collection_id") || "";
    if (pagamento || id) {
      void saasConfirmFn({ data: { paymentId: id } })
        .then(setDesk)
        .catch(() => undefined)
        .finally(() => history.replaceState({}, "", "/configuracoes"));
    }
  }, []);

  async function payPix() {
    setBusy(true);
    setErr("");
    try {
      const out = await saasCheckoutFn({
        data: { plan: "completo", method: "pix", returnUrl: window.location.origin + "/configuracoes" },
      });
      window.location.assign(out.checkoutUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não abriu o Pix.");
      setBusy(false);
    }
  }

  if (!desk) {
    return <p className="mt-8 text-sm text-muted">{err || "Carregando plano…"}</p>;
  }

  const label =
    desk.access === "vitalicio"
      ? "Vitalício"
      : desk.plan === "completo" && desk.paidUntil
        ? `Completo até ${formatDatePt(desk.paidUntil)}`
        : "Teste gratuito";

  return (
    <section className="mt-8 max-w-xl rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium">Plano TatameSmart</h2>
      <p className="mt-2 text-2xl font-semibold tracking-tight">R$ 99,00 <span className="text-sm font-normal text-muted">/mês</span></p>
      <p className="mt-2 text-sm text-muted">
        Sem débito automático. Todo mês o professor paga o Pix quando quiser renovar.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-muted">Situação</span>
        <Badge tone={desk.access === "vitalicio" || desk.plan === "completo" ? "success" : "warning"}>{label}</Badge>
      </div>
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      {desk.access === "vitalicio" ? (
        <p className="mt-4 text-sm text-muted">Esta academia está no vitalício.</p>
      ) : (
        <Button className="mt-5" type="button" disabled={busy || !desk.configured} onClick={() => void payPix()}>
          {busy ? "Abrindo Pix…" : "Pagar este mês no Pix"}
        </Button>
      )}
      {!desk.configured ? (
        <p className="mt-3 text-sm text-muted">O Pix abre quando a TatameSmart liga o Mercado Pago.</p>
      ) : null}
    </section>
  );
}
