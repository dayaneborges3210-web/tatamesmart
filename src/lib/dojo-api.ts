import { includeScholarshipInvoice } from "./scholarship";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { academyWriteMiddleware, academyMiddleware, academyOf, ensureStaffLoginCols } from "@/lib/academy-actor";
import { getSql } from "@/lib/db";
import { DEFAULT_CHARGE_TEXTS, buildMessage, invoiceStatus, phaseFor } from "@/lib/cobranca";
import { sendWhatsAppText, evolutionQr, evolutionState } from "@/lib/whatsapp";
import { ensureBranchWa, ensurePlatformWa, ensureSchoolWa, savePlatformWa, waReadyOf } from "@/lib/platform-wa.server";
import { addDaysISO, addMinutesHHMM, classDates, daysUntil, todayISO, WEEKDAYS } from "@/lib/money";
import type {
  AgendaItem,
  Attendance,
  Branch,
  ClassGroup,
  DojoSnapshot,
  Invoice,
  Payable,
  Plan,
  ReminderSend,
  Student,
} from "@/lib/dojo-types";
import { clampDegree, clampDueDay, dueDateInMonth, isBelt, isModality, nextDueFromDay, parseDocs } from "@/lib/dojo-types";
import { alarmDue, formatAlarm } from "@/lib/alarms";
import { DEMO_SCHOOL, isDemoEmail } from "@/lib/demo";
import { isMaeEmail } from "@/lib/site";

function asDate(v: unknown) {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function newLoginId() {
  return randomBytes(24).toString("base64url");
}

async function upsertStaffLogin(ownerId: string, staffId: string, emailRaw: string, password: string) {
  await ensureStaffLoginCols();
  const email = emailRaw.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Informe o e-mail do professor.");
  if (isMaeEmail(email)) throw new Error("Esse e-mail é da empresa mãe.");
  if (password.length < 8) throw new Error("A senha do professor precisa ter pelo menos 8 caracteres.");
  const sql = await getSql();
  const staff = await sql<{ login_user_id: string | null }>`
    select login_user_id from staff where id = ${staffId} and user_id = ${ownerId}
  `;
  if (!staff[0]) throw new Error("Professor não encontrado.");
  const existing = await sql<{ id: string }>`select id from "user" where lower(email) = ${email} limit 1`;
  const currentLogin = (staff[0].login_user_id ?? "").trim();
  if (existing[0] && existing[0].id !== currentLogin) {
    throw new Error("Esse e-mail já entra em outra conta.");
  }
  const hashed = await hashPassword(password);
  let loginId = currentLogin;
  if (!loginId) {
    loginId = existing[0]?.id || newLoginId();
    if (!existing[0]) {
      await sql`
        insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        values (${loginId}, ${email.split("@")[0]}, ${email}, false, now(), now())
      `;
    }
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${newLoginId()}, ${loginId}, ${"credential"}, ${loginId}, ${hashed}, now(), now())
    `;
    const acc = await sql<{ id: string }>`
      select id from "account" where "userId" = ${loginId} and "providerId" = ${"credential"} limit 1
    `;
    if (acc[0]) {
      await sql`update "account" set password = ${hashed}, "updatedAt" = now() where id = ${acc[0].id}`;
    }
  } else {
    await sql`update "user" set email = ${email}, "updatedAt" = now() where id = ${loginId}`;
    const acc = await sql<{ id: string }>`
      select id from "account" where "userId" = ${loginId} and "providerId" = ${"credential"} limit 1
    `;
    if (acc[0]) {
      await sql`update "account" set password = ${hashed}, "updatedAt" = now() where id = ${acc[0].id}`;
    } else {
      await sql`
        insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        values (${newLoginId()}, ${loginId}, ${"credential"}, ${loginId}, ${hashed}, now(), now())
      `;
    }
  }
  await sql`update staff set email = ${email}, login_user_id = ${loginId} where id = ${staffId} and user_id = ${ownerId}`;
}

async function dropStaffLogin(ownerId: string, staffId: string) {
  const sql = await getSql();
  await ensureStaffLoginCols();
  const rows = await sql<{ login_user_id: string | null }>`
    select login_user_id from staff where id = ${staffId} and user_id = ${ownerId}
  `;
  const loginId = (rows[0]?.login_user_id ?? "").trim();
  await sql`delete from staff where id = ${staffId} and user_id = ${ownerId}`;
  if (!loginId) return;
  const still = await sql<{ id: string }>`select id from staff where login_user_id = ${loginId} limit 1`;
  if (still.length) return;
  const school = await sql<{ user_id: string }>`select user_id from schools where user_id = ${loginId} limit 1`;
  if (school.length) return;
  await sql`delete from "session" where "userId" = ${loginId}`;
  await sql`delete from "account" where "userId" = ${loginId}`;
  await sql`delete from "user" where id = ${loginId}`;
}

async function ensureAcademyExtras() {
  const g = globalThis as typeof globalThis & { __academyExtras__?: Promise<void> };
  if (!g.__academyExtras__) {
    g.__academyExtras__ = (async () => {
      const sql = await getSql();
      await sql.query(`alter table students add column if not exists scholarship boolean not null default false`);
      await sql.query(`
        create table if not exists plans (
          id text primary key,
          user_id text not null,
          name text not null,
          duration_months int not null default 1,
          billing text not null default 'mensal',
          amount int not null default 0,
          weekly_limit int not null default 0,
          due_day int not null default 10
        )
      `);
      await sql.query(`alter table students add column if not exists degree integer not null default 0`);
      await sql.query(`alter table students add column if not exists birth date`);
      await sql.query(`alter table students add column if not exists plan_id text not null default ''`);
      await sql.query(`alter table students add column if not exists due_day int not null default 10`);
      await sql.query(`alter table students add column if not exists docs text not null default ''`);
    })().catch((err) => {
      g.__academyExtras__ = undefined;
      throw err;
    });
  }
  await g.__academyExtras__;
}

async function ensureBranches(userId: string, schoolName: string): Promise<Branch[]> {
  const sql = await getSql();
  await sql.query(`
    create table if not exists branches (
      id text primary key,
      user_id text not null,
      name text not null,
      kind text not null default 'filial',
      address text not null default '',
      phone text not null default '',
      pix text not null default '',
      active boolean not null default true
    )
  `);
  try {
    await sql.query(`alter table branches add column if not exists pix text not null default ''`);
  } catch {
    /* column already there */
  }
  const tables = ["students", "classes", "staff", "stock_items", "payables", "agenda", "championships", "sales", "plans", "invoices"];
  for (const table of tables) {
    await sql.query(`alter table ${table} add column if not exists branch_id text not null default ''`);
  }
  let rows = await sql<{
    id: string;
    name: string;
    kind: string;
    address: string;
    phone: string;
    pix: string | null;
    active: boolean;
  }>`select id, name, kind, address, phone, pix, active from branches where user_id = ${userId} order by kind, name`;
  if (!rows.length) {
    const id = `${userId}:matriz`;
    const schoolPix = await sql<{ pix: string | null }>`select pix from schools where user_id = ${userId}`;
    await sql`insert into branches (id, user_id, name, kind, address, phone, pix, active)
      values (${id}, ${userId}, ${"Matriz"}, ${"matriz"}, ${""}, ${""}, ${schoolPix[0]?.pix ?? ""}, ${true})`;
    rows = [{ id, name: "Matriz", kind: "matriz", address: "", phone: "", pix: schoolPix[0]?.pix ?? "", active: true }];
  }
  const matriz = rows.find((r) => r.kind === "matriz") ?? rows[0];
  await sql`update students set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update classes set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update staff set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update stock_items set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update payables set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update agenda set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update championships set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update sales set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update plans set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  await sql`update invoices set branch_id = ${matriz.id} where user_id = ${userId} and branch_id = ${""}`;
  if (!(matriz.pix ?? "").trim()) {
    const schoolPix = await sql<{ pix: string | null }>`select pix from schools where user_id = ${userId}`;
    const pix = (schoolPix[0]?.pix ?? "").trim();
    if (pix) {
      await sql`update branches set pix = ${pix} where id = ${matriz.id} and user_id = ${userId}`;
      matriz.pix = pix;
    }
  }
  void schoolName;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind === "matriz" ? "matriz" : "filial",
    address: r.address ?? "",
    phone: r.phone ?? "",
    pix: (r.pix ?? "").trim(),
    active: Boolean(r.active),
  }));
}

async function resolveBranchId(userId: string, requested: string | undefined, schoolName: string, lockedBranchId = "") {
  if (lockedBranchId) return lockedBranchId;
  const branches = await ensureBranches(userId, schoolName);
  const hit = branches.find((b) => b.id === requested && b.active);
  if (hit) return hit.id;
  return (branches.find((b) => b.kind === "matriz") ?? branches[0]).id;
}

async function snapshot(userId: string, sessionUserId = userId): Promise<DojoSnapshot> {
  const actor = await academyOf(sessionUserId);
  userId = actor.ownerId;
  const sql = await getSql();
  await ensureAcademyExtras();
  const me = await sql<{ email: string | null }>`select email from "user" where id = ${actor.sessionUserId}`;
  const mail = (me[0]?.email ?? "").trim().toLowerCase();
  const schools = await sql<{
    name: string;
    pix: string;
    theme: string | null;
    logo: string | null;
    font: string | null;
    type_scale: number | null;
    owner_phone: string | null;
  }>`
    select name, pix, theme, logo, font, type_scale, owner_phone from schools where user_id = ${userId}
  `;
  const branches = await ensureBranches(userId, schools[0]?.name ?? "Matriz");
  let accessStatus = "ok";
  try {
    const acc = await sql<{ access_status: string | null }>`
      select access_status from schools where user_id = ${userId}
    `;
    accessStatus = acc[0]?.access_status || "ok";
  } catch {
    accessStatus = "ok";
  }
  let msgs = {
    inicio: DEFAULT_CHARGE_TEXTS.inicio,
    lembrete: DEFAULT_CHARGE_TEXTS.lembrete,
    vencimento: DEFAULT_CHARGE_TEXTS.vencimento,
    atraso: DEFAULT_CHARGE_TEXTS.atraso,
  };
  try {
    const rows = await sql<{
      msg_inicio: string | null;
      msg_lembrete: string | null;
      msg_vencimento: string | null;
      msg_atraso: string | null;
    }>`select msg_inicio, msg_lembrete, msg_vencimento, msg_atraso from schools where user_id = ${userId}`;
    if (rows[0]) {
      msgs = {
        inicio: rows[0].msg_inicio?.trim() || DEFAULT_CHARGE_TEXTS.inicio,
        lembrete: rows[0].msg_lembrete?.trim() || DEFAULT_CHARGE_TEXTS.lembrete,
        vencimento: rows[0].msg_vencimento?.trim() || DEFAULT_CHARGE_TEXTS.vencimento,
        atraso: rows[0].msg_atraso?.trim() || DEFAULT_CHARGE_TEXTS.atraso,
      };
    }
  } catch {
    /* columns may not exist yet */
  }
  let waReady = false;
  let waAuto = true;
  let waPhoneId = "";
  let waUrl = "";
  let waOwner = false;
  try {
    const platform = await ensurePlatformWa();
    waReady = Boolean(platform.url && platform.token);
    waAuto = true;
    const ownerMail = isMaeEmail(mail);
    waOwner = ownerMail;
    const mine = await sql<{ wa_phone_id: string | null }>`select wa_phone_id from schools where user_id = ${userId}`;
    waPhoneId = (mine[0]?.wa_phone_id || "").trim();
    waUrl = platform.url;
  } catch {
    /* platform table may not exist yet */
  }
  const classRows = await sql<{
    id: string;
    name: string;
    modality: string;
    days: string;
    time: string;
    time_end: string | null;
    instructor: string;
    capacity: number;
    branch_id: string | null;
  }>`select id, name, modality, days, time, time_end, instructor, capacity, branch_id from classes where user_id = ${userId} order by time`;
  try {
    await sql.query(`alter table students add column if not exists degree integer not null default 0`);
  } catch {
    /* column already there */
  }
  const studentRows = await sql<{
    scholarship: boolean;
    id: string;
    name: string;
    phone: string;
    modality: string;
    belt: string;
    class_id: string;
    status: string;
    joined: unknown;
    cpf: string | null;
    address: string | null;
    cep: string | null;
    has_health: boolean | null;
    health_note: string | null;
    degree: number | null;
    birth: unknown;
    plan_id: string | null;
    due_day: number | null;
    docs: string | null;
    branch_id: string | null;
  }>`select scholarship, id, name, phone, modality, belt, class_id, status, joined, cpf, address, cep, has_health, health_note, degree, birth, plan_id, due_day, docs, branch_id from students where user_id = ${userId} order by name`;
  const invRows = await sql<{
    id: string;
    student_id: string;
    month: string;
    amount: number;
    status: string;
    due: unknown;
    branch_id: string | null;
  }>`select id, student_id, month, amount, status, due, branch_id from invoices where user_id = ${userId}`;
  const attRows = await sql<{
    id: string;
    student_id: string;
    class_id: string;
    date: unknown;
    present: boolean;
  }>`select id, student_id, class_id, date, present from attendance where user_id = ${userId}`;
  const remRows = await sql<{
    id: string;
    invoice_id: string;
    date: unknown;
    phase: string;
  }>`select id, invoice_id, date, phase from reminders where user_id = ${userId}`;
  const billRows = await sql<{
    id: string;
    title: string;
    vendor: string;
    category: string;
    amount: number;
    due: unknown;
    status: string;
    branch_id: string | null;
  }>`select id, title, vendor, category, amount, due, status, branch_id from payables where user_id = ${userId} order by due`;
  const agendaRows = await sql<{
    id: string;
    title: string;
    note: string;
    due: unknown;
    done: boolean;
    alarm_at: string | null;
    alarm_sent: boolean | null;
    branch_id: string | null;
  }>`select id, title, note, due, done, alarm_at, alarm_sent, branch_id from agenda where user_id = ${userId} order by due`;
  const staffRows = await sql<{
    id: string;
    name: string;
    role: string;
    phone: string;
    pay: number;
    branch_id: string | null;
    email: string | null;
    login_user_id: string | null;
  }>`select id, name, role, phone, pay, branch_id, email, login_user_id from staff where user_id = ${userId} order by name`;
  const stockRows = await sql<{
    id: string;
    name: string;
    category: string;
    qty: number;
    min_qty: number;
    unit_cost: number;
    price: number | null;
    branch_id: string | null;
  }>`select id, name, category, qty, min_qty, unit_cost, price, branch_id from stock_items where user_id = ${userId} order by name`;
  const saleRows = await sql<{
    id: string;
    student_id: string;
    item_id: string;
    item_name: string;
    qty: number;
    unit_price: number;
    total: number;
    pay_method: string;
    sold_on: unknown;
    branch_id: string | null;
  }>`select id, student_id, item_id, item_name, qty, unit_price, total, pay_method, sold_on, branch_id from sales where user_id = ${userId} order by sold_on desc, id desc`;
  const champRows = await sql<{
    id: string;
    name: string;
    place: string;
    date: unknown;
    time: string | null;
    participants: string | null;
    gold: number;
    silver: number;
    bronze: number;
    trophies: number;
    modality: string | null;
    branch_id: string | null;
  }>`select id, name, place, date, time, participants, gold, silver, bronze, trophies, modality, branch_id from championships where user_id = ${userId} order by date desc`;
  let planRows: {
    id: string;
    name: string;
    duration_months: number;
    billing: string;
    amount: number;
    weekly_limit: number;
    due_day: number;
    branch_id: string | null;
  }[] = [];
  try {
    planRows = await sql`
      select id, name, duration_months, billing, amount, weekly_limit, due_day, branch_id
      from plans where user_id = ${userId} order by name
    `;
  } catch {
    planRows = [];
  }

  const invoices: Invoice[] = invRows.filter((row) => includeScholarshipInvoice(row.status, studentRows.some((student) => student.id === row.student_id && student.scholarship))).map((row) => {
    const inv: Invoice = {
      id: row.id,
      studentId: row.student_id,
      month: row.month,
      amount: Number(row.amount),
      status: row.status as Invoice["status"],
      due: asDate(row.due),
      branchId: row.branch_id || "",
    };
    return { ...inv, status: invoiceStatus(inv) };
  });

  return {
    school: schools[0]?.name ?? "Minha academia",
    pix: schools[0]?.pix ?? "",
    theme: schools[0]?.theme || "aco",
    logo: schools[0]?.logo ?? "",
    font: schools[0]?.font || "plex",
    typeScale: Number(schools[0]?.type_scale) || 100,
    ownerPhone: schools[0]?.owner_phone ?? "",
    chargeTexts: msgs,
    waReady,
    waAuto,
    waPhoneId,
    waUrl,
    waOwner,
    blocked: accessStatus === "blocked" && !isMaeEmail(mail),
    role: actor.isStaff ? "staff" : "owner",
    lockedBranchId: actor.lockedBranchId,
    branches,
    classes: classRows.map((c) => ({
      id: c.id,
      name: c.name,
      modality: c.modality as ClassGroup["modality"],
      days: c.days.split(",").filter(Boolean),
      time: c.time,
      timeEnd: c.time_end || addMinutesHHMM(c.time, 60),
      instructor: c.instructor,
      capacity: Number(c.capacity),
      branchId: c.branch_id || "",
    })),
    students: studentRows.map((s) => ({
      scholarship: Boolean(s.scholarship),
      id: s.id,
      name: s.name,
      phone: s.phone,
      modality: s.modality as Student["modality"],
      belt: isBelt(s.belt) ? s.belt : "Branca",
      degree: Number(s.degree) || 0,
      classId: s.class_id,
      status: s.status as Student["status"],
      joined: asDate(s.joined),
      cpf: s.cpf ?? "",
      address: s.address ?? "",
      cep: s.cep ?? "",
      hasHealth: Boolean(s.has_health),
      healthNote: s.health_note ?? "",
      birth: s.birth ? asDate(s.birth) : "",
      planId: s.plan_id ?? "",
      dueDay: Number(s.due_day) || 10,
      docs: parseDocs(s.docs),
      branchId: s.branch_id || "",
    })),
    invoices,
    attendance: attRows.map((a) => ({
      id: a.id,
      studentId: a.student_id,
      classId: a.class_id,
      date: asDate(a.date),
      present: Boolean(a.present),
    })) as Attendance[],
    reminders: remRows.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      date: asDate(r.date),
      phase: r.phase as ReminderSend["phase"],
    })),
    payables: billRows.map((b) => {
      const due = asDate(b.due);
      const status = b.status === "paga" ? "paga" : daysUntil(due) < 0 ? "atrasada" : "aberta";
      return {
        id: b.id,
        title: b.title,
        vendor: b.vendor,
        category: b.category,
        amount: Number(b.amount),
        due,
        status: status as Payable["status"],
        branchId: b.branch_id || "",
      };
    }),
    agenda: agendaRows.map((a) => ({
      id: a.id,
      title: a.title,
      note: a.note,
      due: asDate(a.due),
      done: Boolean(a.done),
      alarmAt: a.alarm_at ?? "",
      alarmSent: Boolean(a.alarm_sent),
      branchId: a.branch_id || "",
    })),
    staff: staffRows.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      phone: s.phone,
      pay: Number(s.pay),
      branchId: s.branch_id || "",
      email: (s.email ?? "").trim().toLowerCase(),
      hasLogin: Boolean((s.login_user_id ?? "").trim()),
    })),
    stock: stockRows.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      qty: Number(s.qty),
      minQty: Number(s.min_qty),
      unitCost: Number(s.unit_cost),
      price: Number(s.price) || Number(s.unit_cost) * 2,
      branchId: s.branch_id || "",
    })),
    sales: saleRows.map((s) => ({
      id: s.id,
      studentId: s.student_id,
      itemId: s.item_id,
      itemName: s.item_name,
      qty: Number(s.qty),
      unitPrice: Number(s.unit_price),
      total: Number(s.total),
      payMethod: s.pay_method,
      soldOn: asDate(s.sold_on),
      branchId: s.branch_id || "",
    })),
    championships: champRows.map((c) => {
      const raw = c.modality ?? "";
      const modality = isModality(raw) ? raw : "Jiu-jitsu";
      return {
        id: c.id,
        name: c.name,
        place: c.place,
        modality,
        date: asDate(c.date),
        time: c.time ?? "",
        participants: (c.participants || "").split(",").filter(Boolean),
        gold: Number(c.gold) || 0,
        silver: Number(c.silver) || 0,
        bronze: Number(c.bronze) || 0,
        trophies: Number(c.trophies) || 0,
        branchId: c.branch_id || "",
      };
    }),
    plans: planRows.map((p) => ({
      id: p.id,
      name: p.name,
      durationMonths: Number(p.duration_months) || 1,
      billing: p.billing === "unico" ? "unico" : "mensal",
      amount: Number(p.amount) || 0,
      weeklyLimit: Number(p.weekly_limit) || 0,
      dueDay: Number(p.due_day) || 10,
      branchId: p.branch_id || "",
    })) as Plan[],
  };
}

async function seedIfNeeded(userId: string, schoolName: string, withRoster = false) {
  const sql = await getSql();
  const existing = await sql<{ user_id: string }>`select user_id from schools where user_id = ${userId}`;
  const t = todayISO();
  const pid = (s: string) => `${userId}:${s}`;
  const pix = withRoster ? "12.345.678/0001-90" : "";
  const phone = withRoster ? "62 99999-0001" : "";

  if (!existing.length) {
    await sql`insert into schools (user_id, name, pix, owner_phone, wa_auto, billing_plan) values (${userId}, ${schoolName}, ${pix}, ${phone}, ${true}, ${"trial"})`;
    try {
      const platform = await ensurePlatformWa();
      if (platform.url && platform.token) {
        await sql`update schools set wa_url = ${platform.url}, wa_auto = ${true} where user_id = ${userId}`;
      }
    } catch {
      /* platform may be empty on first academy */
    }
  } else if (withRoster) {
    await sql`update schools set name = ${schoolName} where user_id = ${userId}`;
  }

  if (!withRoster) return;

  const classCount = await sql<{ n: number }>`select count(*)::int as n from classes where user_id = ${userId}`;
  if (Number(classCount[0]?.n ?? 0) === 0) {
    const classes = [
      [pid("c1"), "Jiu-jitsu adulto", "Jiu-jitsu", "segunda,quarta,sexta", "19:00", "20:30", "Prof. Rafael Nunes", 24],
      [pid("c2"), "Muay Thai", "Muay Thai", "terça,quinta", "20:00", "21:00", "Prof. Camila Dias", 20],
      [pid("c3"), "Kids", "Kids", "sábado", "10:00", "11:00", "Prof. Rafael Nunes", 16],
      [pid("c4"), "Judô", "Judô", "segunda,quarta", "18:00", "19:00", "Sensei Paulo Mota", 18],
    ] as const;
    for (const c of classes) {
      await sql`insert into classes (id, user_id, name, modality, days, time, time_end, instructor, capacity)
        values (${c[0]}, ${userId}, ${c[1]}, ${c[2]}, ${c[3]}, ${c[4]}, ${c[5]}, ${c[6]}, ${c[7]})`;
    }
  }

  const studentCount = await sql<{ n: number }>`select count(*)::int as n from students where user_id = ${userId}`;
  if (Number(studentCount[0]?.n ?? 0) > 0) return;

  const students: [string, string, string, string, string, string, string, string, string, string, string, boolean, string][] = [
    [pid("s1"), "Lucas Ferreira", "62 98811-2301", "Jiu-jitsu", "Azul", pid("c1"), "ativo", "2025-03-12", "041.228.391-10", "Rua das Palmeiras, 120, Centro, Goianira - GO", "75370-000", false, ""],
    [pid("s2"), "Ana Beatriz Lima", "62 98144-0092", "Muay Thai", "Iniciante", pid("c2"), "ativo", "2026-01-08", "508.114.902-33", "Av. Goiás, 890, Setor Sul, Goiânia - GO", "74013-010", true, "Asma — leva bombinha na bolsa"],
    [pid("s3"), "Pedro Henrique Alves", "62 99210-4410", "Jiu-jitsu", "Branca", pid("c1"), "ativo", "2026-06-02", "219.440.118-07", "Rua 8, 45, Jardim das Oliveiras, Goianira - GO", "75370-142", false, ""],
    [pid("s4"), "Marina Costa", "62 98422-7711", "Kids", "Branca", pid("c3"), "ativo", "2025-11-20", "332.901.774-56", "Rua das Crianças, 22, Parque das Flores, Goianira - GO", "75370-220", false, ""],
    [pid("s5"), "João Vitor Ramos", "62 99901-3320", "Judô", "Azul", pid("c4"), "ativo", "2024-09-14", "117.882.003-91", "Rua 15, 310, Setor Central, Inhumas - GO", "75400-000", true, "Lesão antiga no joelho direito"],
    [pid("s6"), "Helena Souza", "62 98555-1209", "Jiu-jitsu", "Roxa", pid("c1"), "ativo", "2023-04-01", "064.551.229-80", "Av. Contorno, 1500, Setor Bueno, Goiânia - GO", "74210-010", false, ""],
    [pid("s8"), "Clara Martins", "62 98112-0088", "Judô", "Branca", pid("c4"), "ativo", "2026-02-11", "890.221.447-12", "Rua Bela Vista, 18, Vila Mutirão, Goiânia - GO", "74474-000", false, ""],
    [pid("s9"), "Gabriel Pinto", "62 99330-2204", "Jiu-jitsu", "Marrom", pid("c1"), "ativo", "2022-08-30", "275.003.661-44", "Rua do Tatame, 9, Centro, Goianira - GO", "75370-010", true, "Alergia a dipirona"],
  ];
  for (const s of students) {
    await sql`insert into students (id, user_id, name, phone, modality, belt, class_id, status, joined, cpf, address, cep, has_health, health_note)
      values (${s[0]}, ${userId}, ${s[1]}, ${s[2]}, ${s[3]}, ${s[4]}, ${s[5]}, ${s[6]}, ${s[7]}, ${s[8]}, ${s[9]}, ${s[10]}, ${s[11]}, ${s[12]})`;
  }

  const dues: [string, number, boolean][] = [
    [pid("s1"), 5, false],
    [pid("s2"), 3, false],
    [pid("s3"), 0, false],
    [pid("s4"), -6, false],
    [pid("s5"), 10, true],
    [pid("s6"), 1, false],
    [pid("s8"), -1, false],
    [pid("s9"), -2, true],
  ];
  for (const [sid, offset, paid] of dues) {
    const due = addDaysISO(t, offset);
    const amount = sid.endsWith("s4") ? 12990 : 17990;
    const status = paid ? "paga" : offset < 0 ? "atrasada" : "aberta";
    await sql`insert into invoices (id, user_id, student_id, month, amount, status, due)
      values (${`inv-${sid}`}, ${userId}, ${sid}, ${due.slice(0, 7)}, ${amount}, ${status}, ${due})`;
  }
}

async function seedOpsIfNeeded(userId: string) {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from payables where user_id = ${userId} limit 1`;
  if (existing.length) return;
  const t = todayISO();
  const pid = (s: string) => `${userId}:${s}`;
  const bills: [string, string, string, string, number, string, string][] = [
    [pid("p1"), "Aluguel do tatame", "Imobiliária Centro", "Aluguel", 320000, addDaysISO(t, 5), "aberta"],
    [pid("p2"), "Energia", "Equatorial", "Energia", 48000, addDaysISO(t, -2), "atrasada"],
    [pid("p3"), "Repasse professor", "Rafael Nunes", "Professor", 180000, addDaysISO(t, 8), "aberta"],
  ];
  for (const b of bills) {
    await sql`insert into payables (id, user_id, title, vendor, category, amount, due, status)
      values (${b[0]}, ${userId}, ${b[1]}, ${b[2]}, ${b[3]}, ${b[4]}, ${b[5]}, ${b[6]})`;
  }
  const notes: [string, string, string, string, boolean, string][] = [
    [pid("a1"), "Comprar faixa branca infantil", "Estoque baixo na turma Kids.", addDaysISO(t, 1), false, `${addDaysISO(t, 1)}T09:00`],
    [pid("a2"), "Renovar alvará da prefeitura", "Levar contrato e CNPJ.", addDaysISO(t, 12), false, ""],
    [pid("a3"), "Postar horários de setembro", "WhatsApp da academia e Instagram.", t, false, `${t}T18:00`],
  ];
  for (const n of notes) {
    await sql`insert into agenda (id, user_id, title, note, due, done, alarm_at, alarm_sent)
      values (${n[0]}, ${userId}, ${n[1]}, ${n[2]}, ${n[3]}, ${n[4]}, ${n[5]}, ${false})`;
  }
}

async function seedCatalogIfNeeded(userId: string) {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from staff where user_id = ${userId} limit 1`;
  if (existing.length) return;
  const pid = (s: string) => `${userId}:${s}`;
  const people: [string, string, string, string, number][] = [
    [pid("t1"), "Rafael Nunes", "Professor", "62 99110-4400", 180000],
    [pid("t2"), "Camila Dias", "Professora", "62 98220-1188", 140000],
    [pid("t3"), "Paulo Mota", "Sensei", "62 99301-2209", 160000],
  ];
  for (const p of people) {
    await sql`insert into staff (id, user_id, name, role, phone, pay)
      values (${p[0]}, ${userId}, ${p[1]}, ${p[2]}, ${p[3]}, ${p[4]})`;
  }
  const items: [string, string, string, number, number, number, number][] = [
    [pid("k1"), "Faixa branca adulto", "Faixa", 8, 4, 3500, 5990],
    [pid("k2"), "Faixa branca infantil", "Faixa", 2, 6, 2800, 4990],
    [pid("k3"), "Kimono A2", "Kimono", 5, 3, 18900, 28900],
    [pid("k4"), "Luva Muay Thai 12oz", "Luva", 10, 4, 8900, 14900],
  ];
  for (const i of items) {
    await sql`insert into stock_items (id, user_id, name, category, qty, min_qty, unit_cost, price)
      values (${i[0]}, ${userId}, ${i[1]}, ${i[2]}, ${i[3]}, ${i[4]}, ${i[5]}, ${i[6]})`;
  }
}

async function fillStudentFichaIfNeeded(userId: string) {
  const sql = await getSql();
  const blank = await sql<{ id: string; name: string }>`
    select id, name from students where user_id = ${userId} and (cpf is null or cpf = '')
  `;
  if (!blank.length) return;
  const ficha: Record<string, [string, string, string, boolean, string]> = {
    "Lucas Ferreira": ["041.228.391-10", "Rua das Palmeiras, 120, Centro, Goianira - GO", "75370-000", false, ""],
    "Ana Beatriz Lima": ["508.114.902-33", "Av. Goiás, 890, Setor Sul, Goiânia - GO", "74013-010", true, "Asma — leva bombinha na bolsa"],
    "Pedro Henrique Alves": ["219.440.118-07", "Rua 8, 45, Jardim das Oliveiras, Goianira - GO", "75370-142", false, ""],
    "Marina Costa": ["332.901.774-56", "Rua das Crianças, 22, Parque das Flores, Goianira - GO", "75370-220", false, ""],
    "João Vitor Ramos": ["117.882.003-91", "Rua 15, 310, Setor Central, Inhumas - GO", "75400-000", true, "Lesão antiga no joelho direito"],
    "Helena Souza": ["064.551.229-80", "Av. Contorno, 1500, Setor Bueno, Goiânia - GO", "74210-010", false, ""],
    "Clara Martins": ["890.221.447-12", "Rua Bela Vista, 18, Vila Mutirão, Goiânia - GO", "74474-000", false, ""],
    "Gabriel Pinto": ["275.003.661-44", "Rua do Tatame, 9, Centro, Goianira - GO", "75370-010", true, "Alergia a dipirona"],
  };
  for (const row of blank) {
    const data = ficha[row.name];
    if (!data) continue;
    await sql`update students set cpf = ${data[0]}, address = ${data[1]}, cep = ${data[2]}, has_health = ${data[3]}, health_note = ${data[4]} where id = ${row.id} and user_id = ${userId}`;
  }
}

async function seedAttendanceIfNeeded(userId: string) {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from attendance where user_id = ${userId} limit 1`;
  if (existing.length) return;
  const t = todayISO();
  const month = t.slice(0, 7);
  const pid = (s: string) => `${userId}:${s}`;
  const groups: { classId: string; days: string[]; students: string[] }[] = [
    { classId: pid("c1"), days: ["segunda", "quarta", "sexta"], students: [pid("s1"), pid("s3"), pid("s6"), pid("s9")] },
    { classId: pid("c2"), days: ["terça", "quinta"], students: [pid("s2")] },
    { classId: pid("c3"), days: ["sábado"], students: [pid("s4")] },
    { classId: pid("c4"), days: ["segunda", "quarta"], students: [pid("s5"), pid("s8")] },
  ];
  let n = 0;
  for (const g of groups) {
    const dates = classDates(g.days, month, t);
    for (const date of dates) {
      for (const sid of g.students) {
        const present = !(sid.endsWith("s3") && n % 3 === 0) && !(sid.endsWith("s2") && n % 2 === 0);
        const id = `${userId}:att${n}`;
        n += 1;
        await sql`insert into attendance (id, user_id, student_id, class_id, date, present)
          values (${id}, ${userId}, ${sid}, ${g.classId}, ${date}, ${present})`;
      }
    }
  }
}

async function fillShopIfNeeded(userId: string) {
  const sql = await getSql();
  await sql`update stock_items set price = 5990 where user_id = ${userId} and name = ${"Faixa branca adulto"} and (price is null or price = 0)`;
  await sql`update stock_items set price = 4990 where user_id = ${userId} and name = ${"Faixa branca infantil"} and (price is null or price = 0)`;
  await sql`update stock_items set price = 28900 where user_id = ${userId} and name = ${"Kimono A2"} and (price is null or price = 0)`;
  await sql`update stock_items set price = 14900 where user_id = ${userId} and name = ${"Luva Muay Thai 12oz"} and (price is null or price = 0)`;
  await sql`update stock_items set price = unit_cost * 2 where user_id = ${userId} and (price is null or price = 0)`;
  const existing = await sql<{ id: string }>`select id from sales where user_id = ${userId} limit 1`;
  if (existing.length) return;
  const t = todayISO();
  const pid = (s: string) => `${userId}:${s}`;
  await sql`insert into sales (id, user_id, student_id, item_id, item_name, qty, unit_price, total, pay_method, sold_on)
    values (${pid("v1")}, ${userId}, ${pid("s4")}, ${pid("k2")}, ${"Faixa branca infantil"}, ${1}, ${4990}, ${4990}, ${"PIX"}, ${t})`;
  await sql`update stock_items set qty = greatest(qty - 1, 0) where id = ${pid("k2")} and user_id = ${userId}`;
}

async function seedChampionshipsIfNeeded(userId: string) {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from championships where user_id = ${userId} limit 1`;
  if (existing.length) return;
  const t = todayISO();
  const pid = (s: string) => `${userId}:${s}`;
  const past = addDaysISO(t, -20);
  const next = addDaysISO(t, 21);
  const roster = [pid("s1"), pid("s3"), pid("s6"), pid("s9")].join(",");
  await sql`insert into championships (id, user_id, name, place, date, time, participants, gold, silver, bronze, trophies, modality)
    values (${pid("ch1")}, ${userId}, ${"Campeonato Brasileiro"}, ${"São Paulo, SP"}, ${past}, ${"09:00"}, ${roster}, ${27}, ${20}, ${7}, ${3}, ${"Jiu-jitsu"})`;
  await sql`insert into championships (id, user_id, name, place, date, time, participants, gold, silver, bronze, trophies, modality)
    values (${pid("ch2")}, ${userId}, ${"Copa Goiás de Jiu-jitsu"}, ${"Goiânia, GO"}, ${next}, ${"08:30"}, ${[pid("s1"), pid("s3")].join(",")}, ${0}, ${0}, ${0}, ${0}, ${"Jiu-jitsu"})`;
}

async function fillClassEndIfNeeded(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string; time: string; time_end: string | null }>`
    select id, time, time_end from classes where user_id = ${userId}
  `;
  for (const row of rows) {
    if (row.time_end) continue;
    const end = addMinutesHHMM(row.time, 60);
    await sql`update classes set time_end = ${end} where id = ${row.id} and user_id = ${userId}`;
  }
}

async function wipeDemoSeedFromRealSchool(userId: string) {
  const sql = await getSql();
  await sql`delete from sales where user_id = ${userId} and (
    item_name = ${"Faixa branca infantil"} or item_name = ${"Faixa branca adulto"} or
    item_name = ${"Kimono A2"} or item_name = ${"Luva Muay Thai 12oz"}
  )`;
  await sql`delete from stock_items where user_id = ${userId} and (
    name = ${"Faixa branca infantil"} or name = ${"Faixa branca adulto"} or
    name = ${"Kimono A2"} or name = ${"Luva Muay Thai 12oz"}
  )`;
  await sql`delete from payables where user_id = ${userId} and (
    title = ${"Aluguel do tatame"} or title = ${"Energia"} or title = ${"Repasse professor"}
  )`;
  await sql`delete from agenda where user_id = ${userId} and (
    title = ${"Comprar faixa branca infantil"} or title = ${"Renovar alvará da prefeitura"} or
    title = ${"Postar horários de setembro"}
  )`;
  await sql`delete from staff where user_id = ${userId} and (
    name = ${"Rafael Nunes"} or name = ${"Camila Dias"} or name = ${"Paulo Mota"}
  )`;
  await sql`delete from championships where user_id = ${userId} and (
    name = ${"Campeonato Brasileiro"} or name = ${"Copa Goiás de Jiu-jitsu"}
  )`;
  await sql`delete from students where user_id = ${userId} and (
    name = ${"Lucas Ferreira"} or name = ${"Ana Beatriz Lima"} or name = ${"Pedro Henrique Alves"} or
    name = ${"Marina Costa"} or name = ${"João Vitor Ramos"} or name = ${"Helena Souza"} or
    name = ${"Clara Martins"} or name = ${"Gabriel Pinto"}
  )`;
  await sql`delete from classes where user_id = ${userId} and (
    name = ${"Jiu-jitsu adulto"} or name = ${"Muay Thai"} or name = ${"Kids"} or name = ${"Judô"}
  )`;
  await sql`update schools set pix = ${""}, owner_phone = ${""}
    where user_id = ${userId} and pix = ${"12.345.678/0001-90"}`;
}

export const loadDojo = createServerFn({ method: "GET" })
  .middleware([academyMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const users = await sql<{ name: string | null; email: string | null }>`
      select name, email from "user" where id = ${context.userId}
    `;
    const email = users[0]?.email ?? "";
    const found = await sql<{ name: string }>`select name from schools where user_id = ${context.userId}`.catch(
      () => [] as { name: string }[],
    );
    const demo = isDemoEmail(email) || users[0]?.name === DEMO_SCHOOL || found[0]?.name === DEMO_SCHOOL;

    if (isMaeEmail(email)) {
      if (!found.length) await seedIfNeeded(context.userId, "TatameSmart", false);
      return snapshot(context.userId, context.sessionUserId);
    }

    if (!found.length) {
      await seedIfNeeded(context.userId, demo ? DEMO_SCHOOL : users[0]?.name?.trim() || "Minha academia", demo);
    } else if (demo) {
      const roster = await sql<{ n: number }>`select count(*)::int as n from students where user_id = ${context.userId}`;
      if (Number(roster[0]?.n ?? 0) === 0) {
        await seedIfNeeded(context.userId, DEMO_SCHOOL, true);
        try {
          await seedOpsIfNeeded(context.userId);
          await seedCatalogIfNeeded(context.userId);
          await fillStudentFichaIfNeeded(context.userId);
          await seedAttendanceIfNeeded(context.userId);
          await fillShopIfNeeded(context.userId);
          await seedChampionshipsIfNeeded(context.userId);
          await fillClassEndIfNeeded(context.userId);
        } catch (err) {
          console.error("[dojo] extra seed", err);
        }
      }
    }
    return snapshot(context.userId, context.sessionUserId);
  });

async function dispatchToday(userId: string, sessionUserId = userId) {
  const sql = await getSql();
  await sql.query(`
    create table if not exists wa_dispatch_claims (
      user_id text not null,
      kind text not null,
      item_id text not null,
      dispatch_day text not null,
      status text not null default 'attempting',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (user_id, kind, item_id, dispatch_day)
    )
  `);
  const snap = await snapshot(userId, sessionUserId);
  const today = todayISO();
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const credsCache = new Map<string, { url: string; instance: string; token: string }>();
  const matrizId = snap.branches.find((b) => b.kind === "matriz")?.id || snap.lockedBranchId;
  async function credsFor(branchId: string) {
    const key = branchId || matrizId || "default";
    const hit = credsCache.get(key);
    if (hit) return hit;
    const unit = branchId || matrizId;
    const creds = unit ? await ensureBranchWa(userId, unit) : await ensureSchoolWa(userId);
    credsCache.set(key, creds);
    return creds;
  }
  const invoices = snap.lockedBranchId
    ? snap.invoices.filter((inv) => {
        if (inv.branchId === snap.lockedBranchId) return true;
        const student = snap.students.find((s) => s.id === inv.studentId);
        return Boolean(student && student.branchId === snap.lockedBranchId);
      })
    : snap.invoices;
  for (const inv of invoices) {
    const status = invoiceStatus(inv, today);
    if (status === "paga") continue;
    const phase = phaseFor(daysUntil(inv.due, today));
    if (!phase) continue;
    if (snap.reminders.some((r) => r.invoiceId === inv.id && r.date === today)) continue;
    const student = snap.students.find((s) => s.id === inv.studentId);
    if (student?.scholarship) continue;
    if (!student?.phone) {
      failed += 1;
      errors.push("Aluno sem WhatsApp.");
      continue;
    }
    const text = buildMessage({
      school: snap.school,
      pix: snap.branches.find((b) => b.id === student.branchId)?.pix || snap.pix,
      student,
      invoice: inv,
      phase,
      templates: snap.chargeTexts,
    });
    const claim = await sql`insert into wa_dispatch_claims (user_id, kind, item_id, dispatch_day)
      values (${userId}, ${"invoice"}, ${inv.id}, ${today})
      on conflict do nothing returning item_id`;
    if (!claim.length) continue;
    try {
      const creds = await credsFor(student.branchId || inv.branchId || matrizId);
      await sendWhatsAppText({ ...creds, to: student.phone, body: text });
      const id = `${userId}:r${Date.now()}${sent}`;
      await sql`insert into reminders (id, user_id, invoice_id, date, phase)
        values (${id}, ${userId}, ${inv.id}, ${today}, ${phase})`;
      await sql`update wa_dispatch_claims set status = 'sent', updated_at = now()
        where user_id = ${userId} and kind = 'invoice' and item_id = ${inv.id} and dispatch_day = ${today}`;
      sent += 1;
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : "falhou";
      errors.push(`${student.name}: ${msg}`);
      await sql`update wa_dispatch_claims set status = 'uncertain', updated_at = now()
        where user_id = ${userId} and kind = 'invoice' and item_id = ${inv.id} and dispatch_day = ${today}`;
      if (/tempo de resposta|alcançar a Evolution/i.test(msg)) break;
    }
  }
  return { sent, failed, errors: errors.slice(0, 6) };
}

async function dispatchAlarms(userId: string) {
  const sql = await getSql();
  const creds = await ensureSchoolWa(userId);
  const school = await sql<{ name: string; owner_phone: string | null }>`
    select name, owner_phone from schools where user_id = ${userId}
  `;
  const phone = school[0]?.owner_phone ?? "";
  if (!phone) return { sent: 0, failed: 0 };
  const rows = await sql<{ id: string; title: string; note: string; alarm_at: string | null; alarm_sent: boolean | null }>`
    select id, title, note, alarm_at, alarm_sent from agenda where user_id = ${userId} and done = ${false}
  `;
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.alarm_sent) continue;
    if (!row.alarm_at || !alarmDue(row.alarm_at)) continue;
    const alarmKey = String(row.alarm_at);
    const claim = await sql`insert into wa_dispatch_claims (user_id, kind, item_id, dispatch_day)
      values (${userId}, ${"alarm"}, ${row.id}, ${alarmKey})
      on conflict do nothing returning item_id`;
    if (!claim.length) continue;
    try {
      await sendWhatsAppText({
        ...creds,
        to: phone,
        body: `TatameSmart — ${school[0]?.name || "Agenda"}\n\n${row.title}\n${row.note}\n${formatAlarm(row.alarm_at)}`,
      });
      await sql`update agenda set alarm_sent = ${true} where id = ${row.id} and user_id = ${userId}`;
      await sql`update wa_dispatch_claims set status = 'sent', updated_at = now()
        where user_id = ${userId} and kind = 'alarm' and item_id = ${row.id} and dispatch_day = ${alarmKey}`;
      sent += 1;
    } catch {
      failed += 1;
      await sql`update wa_dispatch_claims set status = 'uncertain', updated_at = now()
        where user_id = ${userId} and kind = 'alarm' and item_id = ${row.id} and dispatch_day = ${alarmKey}`;
    }
  }
  return { sent, failed };
}

export const runWaBot = createServerOnlyFn(async () => {
  const sql = await getSql();
  const schools = await sql<{ user_id: string; name: string }>`
    select s.user_id, s.name from schools s
    left join "user" u on u.id = s.user_id
    where coalesce(s.wa_auto, true) = true
  `;
  const results: { school: string; sent: number; failed: number; alarms: number; error?: string }[] = [];
  for (const s of schools) {
    const mailRows = await sql<{ email: string | null }>`select email from "user" where id = ${s.user_id}`;
    if (isDemoEmail(mailRows[0]?.email)) continue;
    try {
      const { assertAcademyWritable } = await import("./academy-access.server");
      await assertAcademyWritable(s.user_id);
      const cob = await dispatchToday(s.user_id);
      const al = await dispatchAlarms(s.user_id);
      results.push({ school: s.name, sent: cob.sent, failed: cob.failed, alarms: al.sent });
    } catch (err) {
      results.push({
        school: s.name,
        sent: 0,
        failed: 0,
        alarms: 0,
        error: err instanceof Error ? err.message : "falhou",
      });
    }
  }
  return results;
});

export const dispatchTodayFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .handler(async ({ context }) => {
    const result = await dispatchToday(context.userId, context.sessionUserId);
    return { ...result, snapshot: await snapshot(context.userId, context.sessionUserId) };
  });

export const testWhatsAppFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      name: string;
      owner_phone: string | null;
      wa_phone_id: string | null;
      wa_token: string | null;
      wa_url: string | null;
    }>`select name, owner_phone, wa_phone_id, wa_token, wa_url from schools where user_id = ${context.userId}`;
    const row = rows[0];
    if (!row?.owner_phone) throw new Error("Cadastre o WhatsApp do dono em Identidade.");
    const platform = await ensureSchoolWa(context.userId);
    if (!platform.token || !platform.url) {
      throw new Error("WhatsApp da TatameSmart ainda não está ligado.");
    }
    await sendWhatsAppText({
      token: platform.token,
      url: platform.url,
      instance: platform.instance,
      to: row.owner_phone,
      body: `TatameSmart: o WhatsApp da ${row.name} está no ar. As mensalidades saem sozinhas.`,
    });
    return { ok: true as const };
  });

async function schoolWa(userId: string) {
  return ensureSchoolWa(userId);
}

export const waStateFn = createServerFn({ method: "POST" })
  .middleware([academyMiddleware])
  .handler(async ({ context }) => {
    const creds = await schoolWa(context.userId);
    const state = await evolutionState(creds);
    return { state };
  });

export const waQrFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .handler(async ({ context }) => {
    const creds = await schoolWa(context.userId);
    return evolutionQr(creds);
  });

export const addStudentFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator(
    (d: {
      name: string;
      phone: string;
      classId: string;
      modality: string;
      belt: string;
      degree?: number;
      cpf: string;
      address: string;
      cep: string;
      hasHealth: boolean;
      healthNote: string;
      birth?: string;
      scholarship?: boolean;
      planId?: string;
      dueDay?: number;
      docs?: string[];
      trial?: boolean;
      branchId?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureAcademyExtras();
    const id = `${context.userId}:s${Date.now()}`;
    const t = todayISO();
    const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
    const plans = await sql<{ id: string; amount: number; due_day: number }>`
      select id, amount, due_day from plans
      where user_id = ${context.userId} and id = ${data.planId ?? ""} and (branch_id = ${branchId} or branch_id = ${""})
    `;
    const plan = plans[0];
    const dueDay = clampDueDay(data.dueDay || plan?.due_day || 10);
    const due = nextDueFromDay(dueDay, t);
    const amount = plan ? Number(plan.amount) : data.modality === "Kids" ? 12990 : 17990;
    const cpf = data.cpf.replace(/[^\d.\-]/g, "").slice(0, 14);
    const cep = data.cep.replace(/[^\d\-]/g, "").slice(0, 9);
    const address = data.address.trim().slice(0, 200);
    const hasHealth = Boolean(data.hasHealth);
    const healthNote = hasHealth ? data.healthNote.trim().slice(0, 300) : "";
    const degree = clampDegree(data.belt, data.degree ?? 0);
    const birth = /^\d{4}-\d{2}-\d{2}$/.test(data.birth ?? "") ? data.birth : null;
    const docs = parseDocs((data.docs ?? []).join(",")).join(",");
    const status = data.trial ? "trial" : "ativo";
    const planId = plan?.id ?? "";
    await sql`insert into students (id, user_id, name, phone, modality, belt, degree, class_id, status, joined, cpf, address, cep, has_health, health_note, birth, plan_id, due_day, docs, branch_id, scholarship)
      values (${id}, ${context.userId}, ${data.name}, ${data.phone}, ${data.modality}, ${data.belt}, ${degree}, ${data.classId}, ${status}, ${t}, ${cpf}, ${address}, ${cep}, ${hasHealth}, ${healthNote}, ${birth}, ${planId}, ${dueDay}, ${docs}, ${branchId}, ${data.scholarship === true})`;
    if (data.scholarship !== true) await sql`insert into invoices (id, user_id, student_id, month, amount, status, due, branch_id)
      values (${`inv-${id}`}, ${context.userId}, ${id}, ${due.slice(0, 7)}, ${amount}, ${"aberta"}, ${due}, ${branchId})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const saveStudentFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator(
    (d: {
      id: string;
      name?: string;
      phone?: string;
      classId?: string;
      modality?: string;
      belt?: string;
      degree?: number;
      cpf?: string;
      address?: string;
      cep?: string;
      hasHealth?: boolean;
      healthNote?: string;
      birth?: string;
      scholarship?: boolean;
      planId?: string;
      dueDay?: number;
      docs?: string[];
      status?: Student["status"];
      branchId?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureAcademyExtras();
    const rows = await sql<{ id: string }>`select id from students where id = ${data.id} and user_id = ${context.userId}`;
    if (!rows.length) throw new Error("Aluno não encontrado.");
    if (data.name !== undefined) {
      const name = data.name.trim().slice(0, 80);
      if (!name) throw new Error("Dê um nome ao aluno.");
      const cpf = (data.cpf ?? "").replace(/[^\d.\-]/g, "").slice(0, 14);
      const cep = (data.cep ?? "").replace(/[^\d\-]/g, "").slice(0, 9);
      const address = (data.address ?? "").trim().slice(0, 200);
      const hasHealth = Boolean(data.hasHealth);
      const healthNote = hasHealth ? (data.healthNote ?? "").trim().slice(0, 300) : "";
      const belt = data.belt ?? "Branca";
      const degree = clampDegree(belt, data.degree ?? 0);
      const modality = data.modality && isModality(data.modality) ? data.modality : "Jiu-jitsu";
      const birth = /^\d{4}-\d{2}-\d{2}$/.test(data.birth ?? "") ? data.birth : null;
      const classId = (data.classId ?? "").slice(0, 80);
      await sql`update students set name = ${name}, phone = ${(data.phone ?? "").slice(0, 20)}, cpf = ${cpf}, cep = ${cep}, address = ${address}, has_health = ${hasHealth}, health_note = ${healthNote}, belt = ${belt}, degree = ${degree}, modality = ${modality}, class_id = ${classId}, birth = ${birth}
        where id = ${data.id} and user_id = ${context.userId}`;
    }
    if (data.scholarship !== undefined) {
      await sql`update students set scholarship = ${data.scholarship === true} where id = ${data.id} and user_id = ${context.userId}`;
    }
    if (data.docs) {
      const docs = parseDocs(data.docs.join(",")).join(",");
      await sql`update students set docs = ${docs} where id = ${data.id} and user_id = ${context.userId}`;
    }
    if (data.planId !== undefined) {
      await sql`update students set plan_id = ${data.planId} where id = ${data.id} and user_id = ${context.userId}`;
    }
    if (data.dueDay !== undefined) {
      const dueDay = clampDueDay(data.dueDay);
      await sql`update students set due_day = ${dueDay} where id = ${data.id} and user_id = ${context.userId}`;
      const open = await sql<{ id: string; month: string }>`
        select id, month from invoices where student_id = ${data.id} and user_id = ${context.userId} and status <> ${"paga"}
      `;
      for (const inv of open) {
        const month = /^\d{4}-\d{2}$/.test(inv.month) ? inv.month : todayISO().slice(0, 7);
        const due = dueDateInMonth(month, dueDay);
        await sql`update invoices set due = ${due} where id = ${inv.id} and user_id = ${context.userId}`;
      }
    }
    if (data.status) {
      await sql`update students set status = ${data.status} where id = ${data.id} and user_id = ${context.userId}`;
    }
    if (data.branchId !== undefined) {
      const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
      await sql`update students set branch_id = ${branchId} where id = ${data.id} and user_id = ${context.userId}`;
    }
    return snapshot(context.userId, context.sessionUserId);
  });

export const deleteStudentFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`select id from students where id = ${data.id} and user_id = ${context.userId}`;
    if (!rows.length) throw new Error("Aluno não encontrado.");
    await sql`delete from reminders where user_id = ${context.userId} and invoice_id in (select id from invoices where student_id = ${data.id} and user_id = ${context.userId})`;
    await sql`delete from invoices where student_id = ${data.id} and user_id = ${context.userId}`;
    await sql`delete from attendance where student_id = ${data.id} and user_id = ${context.userId}`;
    await sql`delete from students where id = ${data.id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const addPlanFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator(
    (d: { name: string; durationMonths: number; billing: "mensal" | "unico"; amount: number; weeklyLimit: number; dueDay: number; branchId?: string }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureAcademyExtras();
    const id = `${context.userId}:p${Date.now()}`;
    const name = data.name.trim().slice(0, 80);
    if (!name) throw new Error("Dê um nome ao plano.");
    const duration = [1, 3, 6, 12].includes(data.durationMonths) ? data.durationMonths : 1;
    const amount = Math.max(0, Math.round(data.amount));
    const weekly = Math.max(0, Math.round(data.weeklyLimit));
    const dueDay = clampDueDay(data.dueDay);
    const billing = data.billing === "unico" ? "unico" : "mensal";
    const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
    await sql`insert into plans (id, user_id, name, duration_months, billing, amount, weekly_limit, due_day, branch_id)
      values (${id}, ${context.userId}, ${name}, ${duration}, ${billing}, ${amount}, ${weekly}, ${dueDay}, ${branchId})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const savePlanFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator(
    (d: { id: string; name: string; durationMonths: number; billing: "mensal" | "unico"; amount: number; weeklyLimit: number; dueDay: number }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureAcademyExtras();
    const name = data.name.trim().slice(0, 80);
    if (!name) throw new Error("Dê um nome ao plano.");
    const duration = [1, 3, 6, 12].includes(data.durationMonths) ? data.durationMonths : 1;
    const amount = Math.max(0, Math.round(data.amount));
    const weekly = Math.max(0, Math.round(data.weeklyLimit));
    const dueDay = clampDueDay(data.dueDay);
    const billing = data.billing === "unico" ? "unico" : "mensal";
    await sql`update plans set name = ${name}, duration_months = ${duration}, billing = ${billing}, amount = ${amount}, weekly_limit = ${weekly}, due_day = ${dueDay}
      where id = ${data.id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const deletePlanFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureAcademyExtras();
    await sql`update students set plan_id = ${""} where plan_id = ${data.id} and user_id = ${context.userId}`;
    await sql`delete from plans where id = ${data.id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const toggleAttendanceFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { studentId: string; classId: string; date: string; present: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : todayISO();
    const rows = await sql<{ id: string; present: boolean }>`
      select id, present from attendance
      where user_id = ${context.userId} and student_id = ${data.studentId} and class_id = ${data.classId} and date = ${date}
    `;
    if (rows[0]) {
      await sql`update attendance set present = ${data.present} where id = ${rows[0].id} and user_id = ${context.userId}`;
    } else {
      const id = `${context.userId}:att${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      await sql`insert into attendance (id, user_id, student_id, class_id, date, present)
        values (${id}, ${context.userId}, ${data.studentId}, ${data.classId}, ${date}, ${data.present})`;
    }
    return snapshot(context.userId, context.sessionUserId);
  });

export const markPaidFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: invoiceId }) => {
    const sql = await getSql();
    await sql.query(`alter table invoices add column if not exists paid_at timestamptz`);
    const visible = await snapshot(context.userId, context.sessionUserId);
    if (!visible.invoices.some((invoice) => invoice.id === invoiceId && (!context.lockedBranchId || (invoice.branchId || visible.students.find((student) => student.id === invoice.studentId)?.branchId) === context.lockedBranchId))) throw new Error("Mensalidade não encontrada nesta unidade.");
    await sql`update invoices set status = ${"paga"}, paid_at = coalesce(paid_at, now()) where id = ${invoiceId} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const markReminderFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { invoiceId: string; phase: ReminderSend["phase"] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureAcademyExtras();
    const exempt = await sql<{ id: string }>`select i.id from invoices i join students s on s.id = i.student_id and s.user_id = i.user_id where i.id = ${data.invoiceId} and i.user_id = ${context.userId} and s.scholarship = true`;
    if (exempt.length) throw new Error("Aluno com bolsa integral não recebe cobrança.");
    const date = todayISO();
    const existing = await sql<{ id: string }>`
      select id from reminders where user_id = ${context.userId} and invoice_id = ${data.invoiceId} and date = ${date}
    `;
    if (!existing.length) {
      const id = `${context.userId}:r${Date.now()}`;
      await sql`insert into reminders (id, user_id, invoice_id, date, phase)
        values (${id}, ${context.userId}, ${data.invoiceId}, ${date}, ${data.phase})`;
    }
    return snapshot(context.userId, context.sessionUserId);
  });

export const addPayableFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { title: string; vendor: string; category: string; amount: number; due: string; branchId?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = `${context.userId}:p${Date.now()}`;
    const status = daysUntil(data.due) < 0 ? "atrasada" : "aberta";
    const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
    await sql`insert into payables (id, user_id, title, vendor, category, amount, due, status, branch_id)
      values (${id}, ${context.userId}, ${data.title}, ${data.vendor}, ${data.category}, ${data.amount}, ${data.due}, ${status}, ${branchId})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const settlePayableFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`update payables set status = ${"paga"} where id = ${id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const addAgendaFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { title: string; note: string; due: string; alarmAt: string; branchId?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = `${context.userId}:a${Date.now()}`;
    const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
    await sql`insert into agenda (id, user_id, title, note, due, done, alarm_at, alarm_sent, branch_id)
      values (${id}, ${context.userId}, ${data.title}, ${data.note}, ${data.due}, ${false}, ${data.alarmAt}, ${false}, ${branchId})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const toggleAgendaFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<{ done: boolean }>`
      select done from agenda where id = ${id} and user_id = ${context.userId}
    `;
    if (rows[0]) {
      const next = !rows[0].done;
      await sql`update agenda set done = ${next} where id = ${id} and user_id = ${context.userId}`;
    }
    return snapshot(context.userId, context.sessionUserId);
  });

export const markAlarmFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`update agenda set alarm_sent = ${true} where id = ${id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const saveSchoolFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: {
    name: string;
    theme: string;
    logo: string;
    font: string;
    typeScale: number;
    ownerPhone: string;
    chargeTexts?: {
      inicio: string;
      lembrete: string;
      vencimento: string;
      atraso: string;
    };
    waPhoneId?: string;
    waToken?: string;
    waAuto?: boolean;
    waUrl?: string;
  }) => d)
  .handler(async ({ context, data }) => {
    const { isBrandId } = await import("@/lib/brands");
    const { isFontId, clampScale } = await import("@/lib/fonts");
    const name = data.name.trim().slice(0, 80) || "Minha academia";
    const theme = isBrandId(data.theme) ? data.theme : "aco";
    const font = isFontId(data.font) ? data.font : "plex";
    const typeScale = clampScale(data.typeScale);
    const ownerPhone = data.ownerPhone.replace(/[^\d+\s-]/g, "").slice(0, 20);
    const logo =
      !data.logo || (data.logo.startsWith("data:image/") && data.logo.length < 400_000)
        ? data.logo
        : "";
    const sql = await getSql();
    const clip = (s: string) => s.slice(0, 2000);
    if (data.chargeTexts) {
      await sql`update schools set name = ${name}, theme = ${theme}, logo = ${logo}, font = ${font}, type_scale = ${typeScale}, owner_phone = ${ownerPhone}, msg_inicio = ${clip(data.chargeTexts.inicio)}, msg_lembrete = ${clip(data.chargeTexts.lembrete)}, msg_vencimento = ${clip(data.chargeTexts.vencimento)}, msg_atraso = ${clip(data.chargeTexts.atraso)} where user_id = ${context.userId}`;
    } else {
      await sql`update schools set name = ${name}, theme = ${theme}, logo = ${logo}, font = ${font}, type_scale = ${typeScale}, owner_phone = ${ownerPhone} where user_id = ${context.userId}`;
    }
    if (data.waPhoneId !== undefined || data.waAuto !== undefined || data.waToken !== undefined || data.waUrl !== undefined) {
      await savePlatformWa(context.userId, {
        url: data.waUrl,
        instance: data.waPhoneId,
        token: data.waToken,
      });
    }
    return snapshot(context.userId, context.sessionUserId);
  });

export const addStaffFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { name: string; role: string; phone: string; pay: number; branchId?: string; email?: string; password?: string }) => d)
  .handler(async ({ context, data }) => {
    if (context.isStaff) throw new Error("Só o dono libera o login da filial.");
    const sql = await getSql();
    await ensureStaffLoginCols();
    const id = `${context.userId}:t${Date.now()}`;
    const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
    await sql`insert into staff (id, user_id, name, role, phone, pay, branch_id, email)
      values (${id}, ${context.userId}, ${data.name}, ${data.role}, ${data.phone}, ${data.pay}, ${branchId}, ${(data.email ?? "").trim().toLowerCase()})`;
    if ((data.email ?? "").trim() && (data.password ?? "").trim()) {
      await upsertStaffLogin(context.userId, id, data.email ?? "", data.password ?? "");
    }
    return snapshot(context.userId, context.sessionUserId);
  });

export const saveStaffFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string; name: string; role: string; phone: string; pay: number; email?: string; password?: string }) => d)
  .handler(async ({ context, data }) => {
    if (context.isStaff) throw new Error("Só o dono altera o login da filial.");
    const sql = await getSql();
    const name = data.name.trim().slice(0, 80);
    if (!name) throw new Error("Dê um nome ao professor.");
    await ensureStaffLoginCols();
    await sql`update staff set name = ${name}, role = ${data.role.slice(0, 40)}, phone = ${data.phone.slice(0, 20)}, pay = ${Math.max(0, Math.round(data.pay))}, email = ${(data.email ?? "").trim().toLowerCase()}
      where id = ${data.id} and user_id = ${context.userId}`;
    if ((data.email ?? "").trim() && (data.password ?? "").trim()) {
      await upsertStaffLogin(context.userId, data.id, data.email ?? "", data.password ?? "");
    }
    return snapshot(context.userId, context.sessionUserId);
  });

export const deleteStaffFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    if (context.isStaff) throw new Error("Só o dono exclui professor.");
    await dropStaffLogin(context.userId, data.id);
    return snapshot(context.userId, context.sessionUserId);
  });

export const addStockFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { name: string; category: string; qty: number; minQty: number; unitCost: number; price: number; branchId?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = `${context.userId}:k${Date.now()}`;
    const price = data.price || data.unitCost * 2;
    const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
    await sql`insert into stock_items (id, user_id, name, category, qty, min_qty, unit_cost, price, branch_id)
      values (${id}, ${context.userId}, ${data.name}, ${data.category}, ${data.qty}, ${data.minQty}, ${data.unitCost}, ${price}, ${branchId})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const adjustStockFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string; delta: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ qty: number }>`
      select qty from stock_items where id = ${data.id} and user_id = ${context.userId}
    `;
    if (rows[0]) {
      const qty = Math.max(0, Number(rows[0].qty) + data.delta);
      await sql`update stock_items set qty = ${qty} where id = ${data.id} and user_id = ${context.userId}`;
    }
    return snapshot(context.userId, context.sessionUserId);
  });

export const saveStockFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string; name: string; category: string; qty: number; minQty: number; unitCost: number; price: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const name = data.name.trim().slice(0, 80);
    if (!name) return snapshot(context.userId, context.sessionUserId);
    const qty = Math.max(0, Math.floor(data.qty) || 0);
    const minQty = Math.max(0, Math.floor(data.minQty) || 0);
    const unitCost = Math.max(0, Math.floor(data.unitCost) || 0);
    const price = Math.max(0, Math.floor(data.price) || unitCost * 2);
    const cat = ["Faixa", "Kimono", "Luva", "Outro"].includes(data.category) ? data.category : "Outro";
    await sql`
      update stock_items
      set name = ${name}, category = ${cat}, qty = ${qty}, min_qty = ${minQty}, unit_cost = ${unitCost}, price = ${price}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return snapshot(context.userId, context.sessionUserId);
  });

export const deleteStockFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from stock_items where id = ${data.id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const sellStockFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { itemId: string; studentId: string; qty: number; payMethod: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const qty = Math.max(1, Math.floor(data.qty));
    const method = ["PIX", "Dinheiro", "Cartão"].includes(data.payMethod) ? data.payMethod : "PIX";
    const rows = await sql<{ id: string; name: string; qty: number; price: number; unit_cost: number }>`
      select id, name, qty, price, unit_cost from stock_items where id = ${data.itemId} and user_id = ${context.userId}
    `;
    const item = rows[0];
    if (!item || Number(item.qty) < qty) return snapshot(context.userId, context.sessionUserId);
    const price = Number(item.price) || Number(item.unit_cost) * 2;
    const next = Number(item.qty) - qty;
    await sql`update stock_items set qty = ${next} where id = ${item.id} and user_id = ${context.userId}`;
    const id = `${context.userId}:v${Date.now()}`;
    const branchId = await resolveBranchId(context.userId, undefined, "", context.lockedBranchId);
    const itemBranch = await sql<{ branch_id: string | null }>`select branch_id from stock_items where id = ${item.id}`;
    await sql`insert into sales (id, user_id, student_id, item_id, item_name, qty, unit_price, total, pay_method, sold_on, branch_id)
      values (${id}, ${context.userId}, ${data.studentId}, ${item.id}, ${item.name}, ${qty}, ${price}, ${price * qty}, ${method}, ${todayISO()}, ${itemBranch[0]?.branch_id || branchId})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const addClassFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { name: string; modality: string; days: string[]; time: string; timeEnd: string; instructor: string; capacity: number; branchId?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = `${context.userId}:c${Date.now()}`;
    const days = WEEKDAYS.filter((d) => data.days.includes(d)).join(",");
    const cap = Math.max(1, Math.floor(data.capacity) || 20);
    const start = data.time.slice(0, 8);
    const end = (data.timeEnd || addMinutesHHMM(start, 60)).slice(0, 8);
    const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
    await sql`insert into classes (id, user_id, name, modality, days, time, time_end, instructor, capacity, branch_id)
      values (${id}, ${context.userId}, ${data.name.trim().slice(0, 80)}, ${data.modality}, ${days}, ${start}, ${end}, ${data.instructor.trim().slice(0, 80)}, ${cap}, ${branchId})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const saveClassFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string; name: string; modality: string; days: string[]; time: string; timeEnd: string; instructor: string; capacity: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const days = WEEKDAYS.filter((d) => data.days.includes(d)).join(",");
    const cap = Math.max(1, Math.floor(data.capacity) || 20);
    const start = data.time.slice(0, 8);
    const end = (data.timeEnd || addMinutesHHMM(start, 60)).slice(0, 8);
    await sql`update classes set name = ${data.name.trim().slice(0, 80)}, modality = ${data.modality}, days = ${days}, time = ${start}, time_end = ${end}, instructor = ${data.instructor.trim().slice(0, 80)}, capacity = ${cap}
      where id = ${data.id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const deleteClassFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`update students set class_id = ${""} where class_id = ${data.id} and user_id = ${context.userId}`;
    await sql`delete from attendance where class_id = ${data.id} and user_id = ${context.userId}`;
    await sql`delete from classes where id = ${data.id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

type ChampIn = {
  name: string;
  place: string;
  modality: string;
  date: string;
  time: string;
  participants: string[];
  gold: number;
  silver: number;
  bronze: number;
  trophies: number;
  branchId?: string;
};

function packChamp(data: ChampIn) {
  const modality = isModality(data.modality) ? data.modality : "Jiu-jitsu";
  return {
    name: data.name.trim().slice(0, 120),
    place: data.place.trim().slice(0, 120),
    modality,
    date: /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : todayISO(),
    time: data.time.slice(0, 8),
    participants: data.participants.filter(Boolean).join(","),
    gold: Math.max(0, Math.floor(data.gold) || 0),
    silver: Math.max(0, Math.floor(data.silver) || 0),
    bronze: Math.max(0, Math.floor(data.bronze) || 0),
    trophies: Math.max(0, Math.floor(data.trophies) || 0),
  };
}

export const addChampionshipFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: ChampIn) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = packChamp(data);
    const allowed = await sql<{ id: string; modality: string }>`
      select id, modality from students where user_id = ${context.userId}
    `;
    const participants = data.participants
      .filter((id) => allowed.some((s) => s.id === id && s.modality === row.modality))
      .join(",");
    const id = `${context.userId}:ch${Date.now()}`;
    const branchId = await resolveBranchId(context.userId, data.branchId, "", context.lockedBranchId);
    await sql`insert into championships (id, user_id, name, place, date, time, participants, gold, silver, bronze, trophies, modality, branch_id)
      values (${id}, ${context.userId}, ${row.name}, ${row.place}, ${row.date}, ${row.time}, ${participants}, ${row.gold}, ${row.silver}, ${row.bronze}, ${row.trophies}, ${row.modality}, ${branchId})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const saveChampionshipFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: ChampIn & { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = packChamp(data);
    const allowed = await sql<{ id: string; modality: string }>`
      select id, modality from students where user_id = ${context.userId}
    `;
    const participants = data.participants
      .filter((id) => allowed.some((s) => s.id === id && s.modality === row.modality))
      .join(",");
    await sql`update championships set name = ${row.name}, place = ${row.place}, date = ${row.date}, time = ${row.time}, participants = ${participants}, gold = ${row.gold}, silver = ${row.silver}, bronze = ${row.bronze}, trophies = ${row.trophies}, modality = ${row.modality}
      where id = ${data.id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const addBranchFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { name: string; address?: string; phone?: string; pix?: string }) => d)
  .handler(async ({ context, data }) => {
    if (context.isStaff) throw new Error("Só o dono cadastra filial.");
    const sql = await getSql();
    await ensureBranches(context.userId, "");
    const name = data.name.trim().slice(0, 80);
    if (!name) throw new Error("Dê um nome à filial.");
    const id = `${context.userId}:b${Date.now()}`;
    await sql`insert into branches (id, user_id, name, kind, address, phone, pix, active)
      values (${id}, ${context.userId}, ${name}, ${"filial"}, ${(data.address ?? "").trim().slice(0, 200)}, ${(data.phone ?? "").trim().slice(0, 20)}, ${(data.pix ?? "").trim().slice(0, 80)}, ${true})`;
    return snapshot(context.userId, context.sessionUserId);
  });

export const saveBranchFn = createServerFn({ method: "POST" })
  .middleware([academyWriteMiddleware])
  .validator((d: { id: string; name: string; address?: string; phone?: string; pix?: string; active?: boolean }) => d)
  .handler(async ({ context, data }) => {
    if (context.isStaff) throw new Error("Só o dono altera filial.");
    const sql = await getSql();
    const rows = await sql<{ id: string; kind: string }>`
      select id, kind from branches where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!rows[0]) throw new Error("Unidade não encontrada.");
    const name = data.name.trim().slice(0, 80);
    if (!name) throw new Error("Dê um nome à unidade.");
    const active = rows[0].kind === "matriz" ? true : data.active !== false;
    await sql`update branches set name = ${name}, address = ${(data.address ?? "").trim().slice(0, 200)}, phone = ${(data.phone ?? "").trim().slice(0, 20)}, pix = ${(data.pix ?? "").trim().slice(0, 80)}, active = ${active}
      where id = ${data.id} and user_id = ${context.userId}`;
    return snapshot(context.userId, context.sessionUserId);
  });
