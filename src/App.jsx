import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  Car,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ClipboardList,
  Edit3,
  Flame,
  FileText,
  IdCard,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Eye,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
  XCircle
} from "lucide-react";
import { adminEmails, auth, db } from "./firebase";
import { findKnownUserByEmail, knownTeam, sellerDisplayName } from "./team";

const COLLECTIONS = {
  users: "p1_users",
  appointments: "p1_appointments",
  simulations: "p1_simulations",
  followups: "p1_followups",
  notes: "p1_notes",
  hotClients: "p1_hot_clients"
};

const LOGIN_WELCOME_MESSAGES = {
  "nathy.kassia77@gmail.com": "Nati a fera das Vendas",
  "thayanneclemente62@gmail.com": "Fala Thay da coca!",
  "viniciusribeironetwork@gmail.com": "V, é isso ai po"
};

const LOGIN_WELCOME_DURATION = 1600;

const APPOINTMENT_STATUS = {
  scheduled: { label: "Agendado", tone: "blue" },
  visited: { label: "Visitou", tone: "green" },
  sold: { label: "Vendeu", tone: "lime" },
  no_show: { label: "Não compareceu", tone: "amber" },
  cancelled: { label: "Cancelado", tone: "red" }
};

const SIMULATION_STATUS = {
  pending: { label: "Em análise", tone: "amber" },
  approved: { label: "Aprovado", tone: "green" },
  denied: { label: "Negativo", tone: "red" }
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function normalizeSellerName(value) {
  const text = clean(value).toLowerCase();
  const knownUser = knownTeam.find(user => {
    return (
      user.email === text ||
      user.name.toLowerCase() === text ||
      user.displayName.toLowerCase() === text ||
      user.email.split("@")[0] === text
    );
  });

  return knownUser?.displayName || value;
}

function localDateInput(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function currentMonth() {
  return localDateInput().slice(0, 7);
}

function clean(value) {
  return String(value || "").trim();
}

function parseMoney(value) {
  const normalized = clean(value).replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(value) {
  if (!value) return "Sem data";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatMonth(value) {
  if (!value) return "Mês atual";
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 2);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatEntry(value) {
  if (!value) return "Sem entrada";
  return moneyFormatter.format(Number(value));
}

function copyText(value) {
  const text = clean(value);
  if (!text) return;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    return;
  }

  fallbackCopyText(text);
}

function fallbackCopyText(text) {
  if (typeof document === "undefined") return;

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.top = "0";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  input.setSelectionRange(0, text.length);
  document.execCommand("copy");
  document.body.removeChild(input);
}

function WhatsappCopyChip({ value }) {
  const whatsapp = clean(value);
  if (!whatsapp) return null;

  function handleCopy(event) {
    event.preventDefault();
    event.stopPropagation();
    copyText(whatsapp);
  }

  return (
    <button
      className="meta-copy-chip"
      type="button"
      onPointerDown={event => event.stopPropagation()}
      onClick={handleCopy}
      title="Copiar WhatsApp"
    >
      <small className="copy-chip-label">Copiar</small>
      <Phone size={14} />
      <strong className="copy-chip-number">{whatsapp}</strong>
    </button>
  );
}

function nameFromEmail(email) {
  return clean(email)
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function createAppointmentForm(profile) {
  return {
    sellerId: profile?.role === "seller" ? profile.id : "",
    clientName: "",
    whatsapp: "",
    date: localDateInput(),
    time: "",
    entryValue: "",
    vehicle: "",
    status: "scheduled",
    notes: ""
  };
}

function createSimulationForm(profile) {
  return {
    sellerId: profile?.role === "seller" ? profile.id : "",
    clientName: "",
    whatsapp: "",
    cpf: "",
    birthDate: "",
    license: "sim",
    vehicle: "",
    notes: ""
  };
}

function createNoteForm(profile) {
  return {
    sellerId: profile?.role === "seller" ? profile.id : "",
    title: "",
    text: ""
  };
}

function appointmentDateTime(item) {
  if (!item?.date) return null;
  const [year, month, day] = item.date.split("-").map(Number);
  const [hour = 23, minute = 59] = String(item.time || "23:59").split(":").map(Number);

  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return new Date(year, month - 1, day, hour, minute);
}

function isAutomaticPending(item) {
  if (item?.status !== "scheduled") return false;
  const date = appointmentDateTime(item);
  return date ? date.getTime() < Date.now() : false;
}

async function ensureProfile(firebaseUser) {
  const email = firebaseUser.email?.toLowerCase() || "";
  const profileRef = doc(db, COLLECTIONS.users, firebaseUser.uid);
  const profileSnap = await getDoc(profileRef);
  const knownUser = findKnownUserByEmail(email);

  if (profileSnap.exists()) {
    const savedProfile = profileSnap.data();
    const displayName = knownUser?.displayName || savedProfile.displayName || savedProfile.name;
    const normalizedProfile = knownUser
      ? {
          name: knownUser.displayName,
          fullName: knownUser.name,
          displayName: knownUser.displayName,
          email,
          role: knownUser.role
        }
      : {
          name: displayName,
          displayName,
          email,
          role: savedProfile.role || (adminEmails.includes(email) ? "admin" : "seller")
        };

    if (
      knownUser &&
      (savedProfile.name !== knownUser.displayName ||
        savedProfile.displayName !== knownUser.displayName ||
        savedProfile.fullName !== knownUser.name ||
        savedProfile.role !== knownUser.role)
    ) {
      await setDoc(
        profileRef,
        {
          ...normalizedProfile,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    return {
      id: firebaseUser.uid,
      ...savedProfile,
      ...normalizedProfile
    };
  }

  const role = adminEmails.includes(email) ? "admin" : "seller";
  const profile = {
    name: knownUser?.displayName || firebaseUser.displayName || nameFromEmail(email) || "Vendedor P1",
    fullName: knownUser?.name || firebaseUser.displayName || nameFromEmail(email) || "Vendedor P1",
    displayName: knownUser?.displayName || firebaseUser.displayName || nameFromEmail(email) || "Vendedor P1",
    email,
    role: knownUser?.role || role,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(profileRef, profile, { merge: true });

  return {
    id: firebaseUser.uid,
    ...profile,
    createdAt: null,
    updatedAt: null
  };
}

function metricValue(value) {
  return String(value).padStart(2, "0");
}

function loginWelcomeMessage(profile) {
  const email = String(profile?.email || "").toLowerCase();
  return LOGIN_WELCOME_MESSAGES[email] || `${profile?.displayName || profile?.name || "Bem-vindo"} no painel`;
}

function StatusBadge({ status, map }) {
  const meta = map[status] || { label: status || "Sem status", tone: "neutral" };

  return <span className={`status-badge ${meta.tone}`}>{meta.label}</span>;
}

function MetricCard({ icon: Icon, label, value, hint, tone = "neutral" }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span className="metric-icon">
        <Icon size={18} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
    </article>
  );
}

function EmptyState({ title, text, icon: Icon }) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={22} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function LoginView({ onLogin, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(event) {
    event.preventDefault();
    onLogin({ email, password });
  }

  return (
    <main className="login-screen">
      <section className="login-brand" aria-label="Imagem automotiva P1">
        <img className="login-hero-image" src="/p1-login-hero.png" alt="" aria-hidden="true" />
        <div className="login-brand-mark" aria-label="P1 Sistemas">
          <div className="login-brand-main">
            <span className="login-speed-grid" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="login-brand-p">P</span>
            <span className="login-brand-one">1</span>
          </div>
          <span className="login-brand-system">SISTEMAS</span>
        </div>
        <div className="login-brand-copy">
          <h1>Gestão de pré-vendas da P1</h1>
          <p>Agendamentos, simulações e acompanhamento comercial em um só lugar.</p>
        </div>
      </section>

      <form className="login-card" onSubmit={submit}>
        <div className="login-user-icon">
          <UserRound size={24} />
        </div>

        <div className="login-card-head">
          <h2>Bem-vindo ao P1 Sistemas</h2>
          <p>Acesse sua conta para continuar no painel.</p>
        </div>

        <label>
          E-mail
          <span className="login-input-wrap">
            <Mail size={19} />
            <input
              type="email"
              autoComplete="email"
              list="seller-logins"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="vendedor@email.com"
              required
            />
          </span>
          <datalist id="seller-logins">
            {knownTeam.map(person => (
              <option key={person.email} value={person.email}>
                {person.name}
              </option>
            ))}
          </datalist>
        </label>

        <label>
          Senha
          <span className="login-input-wrap">
            <LockKeyhole size={19} />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword(current => !current)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              <Eye size={18} />
            </button>
          </span>
        </label>

        <button className="forgot-password" type="button">
          Esqueci minha senha
        </button>

        {error ? <div className="form-error">{error}</div> : null}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar no painel"}
          <ChevronRight size={18} />
        </button>

        <div className="login-footnote">
          <ShieldCheck size={15} />
          Ambiente seguro e exclusivo para colaboradores autorizados.
        </div>
      </form>
    </main>
  );
}

function AppointmentForm({
  form,
  setForm,
  sellers,
  profile,
  editing,
  onSubmit,
  onCancel
}) {
  const sellerOptions = sellers.filter(seller => seller.role !== "admin");

  return (
    <form className="panel-card form-card" onSubmit={onSubmit}>
      <div className="panel-title-row">
        <div>
          <span className="section-eyebrow">
            <CalendarDays size={15} />
            Agendamento
          </span>
          <h3>{editing ? "Editar agendamento" : "Novo agendamento"}</h3>
        </div>
        {editing ? (
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancelar edição
          </button>
        ) : null}
      </div>

      <div className="form-grid">
        {profile.role === "admin" ? (
          <label>
            Vendedor
            <select
              value={form.sellerId}
              onChange={event => setForm(current => ({ ...current, sellerId: event.target.value }))}
              required
            >
              <option value="">Selecione</option>
              {sellerOptions.map(seller => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          Nome do cliente
          <input
            value={form.clientName}
            onChange={event => setForm(current => ({ ...current, clientName: event.target.value }))}
            placeholder="Nome completo"
            required
          />
        </label>

        <label>
          WhatsApp
          <input
            value={form.whatsapp}
            onChange={event => setForm(current => ({ ...current, whatsapp: event.target.value }))}
            placeholder="(81) 99999-9999"
            required
          />
        </label>

        <label>
          Data
          <input
            type="date"
            value={form.date}
            onChange={event => setForm(current => ({ ...current, date: event.target.value }))}
            required
          />
        </label>

        <label>
          Horário
          <input
            type="time"
            value={form.time}
            onChange={event => setForm(current => ({ ...current, time: event.target.value }))}
            required
          />
        </label>

        <label>
          Entrada
          <input
            inputMode="decimal"
            value={form.entryValue}
            onChange={event => setForm(current => ({ ...current, entryValue: event.target.value }))}
            placeholder="Sem entrada, deixe vazio"
          />
        </label>

        <label>
          Veículo de interesse
          <input
            value={form.vehicle}
            onChange={event => setForm(current => ({ ...current, vehicle: event.target.value }))}
            placeholder="Modelo desejado"
            required
          />
        </label>

        <label>
          Status
          <select
            value={form.status}
            onChange={event => setForm(current => ({ ...current, status: event.target.value }))}
          >
            {Object.entries(APPOINTMENT_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="full-label">
        Observações
        <textarea
          value={form.notes}
          onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
          placeholder="Detalhes úteis para o atendimento"
          rows={3}
        />
      </label>

      <button className="primary-button" type="submit">
        {editing ? "Salvar alterações" : "Registrar agendamento"}
        <ChevronRight size={18} />
      </button>
    </form>
  );
}

function AppointmentCard({
  item,
  profile,
  hotClient,
  appointmentFollowup,
  onEdit,
  onDelete,
  onStatus,
  onHotClient,
  onFollowup
}) {
  const canManage = profile.role === "admin" || item.sellerId === profile.id;

  return (
    <article className="record-card appointment-card">
      <div className="appointment-status-area">
        <StatusBadge status={item.status} map={APPOINTMENT_STATUS} />
      </div>

      <div className="appointment-content">
        <div className="record-main">
          <div className="appointment-info">
            <div className="record-title-line">
              <div className="appointment-heading">
                <div className="client-name-row">
                  <h3>{item.clientName}</h3>
                </div>
                <p>{item.vehicle || "Não informado"}</p>
              </div>
            </div>

            <div className="record-meta">
              <span>
                <Clock3 size={14} />
                {formatDate(item.date)} às {item.time}
              </span>
              <WhatsappCopyChip value={item.whatsapp} />
              <span>
                <WalletCards size={14} />
                {formatEntry(item.entryValue)}
              </span>
              {profile.role === "admin" ? (
                <span>
                  <UserRound size={14} />
                  {item.sellerName || "Vendedor"}
                </span>
              ) : null}
            </div>

            {item.notes ? (
              <div className="record-notes">
                <strong>Observações:</strong>
                <span>{item.notes}</span>
              </div>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <div className="record-actions appointment-actions">
            <div className="status-actions" aria-label="Atualizar status">
              <button
                className={item.status === "visited" ? "primary-status-action" : ""}
                type="button"
                onClick={() => onStatus(item, "visited")}
              >
                <Eye size={15} />
                Visitou
              </button>
              <button
                className={item.status === "sold" ? "primary-status-action" : ""}
                type="button"
                onClick={() => onStatus(item, "sold")}
              >
                Vendeu
              </button>
              <button
                className={item.status === "no_show" ? "primary-status-action" : ""}
                type="button"
                onClick={() => onStatus(item, "no_show")}
              >
                Não veio
              </button>
              <button
                className={hotClient ? "hot-status-action" : "hot-icon-action"}
                type="button"
                onClick={() => onHotClient(item)}
                aria-label={hotClient ? "Desmarcar cliente quente" : "Marcar cliente quente"}
                title={hotClient ? "Desmarcar cliente quente" : "Marcar cliente quente"}
              >
                <Flame size={15} />
                {hotClient ? <span className="hot-button-label">Quente</span> : null}
              </button>
              <button
                className={appointmentFollowup ? "followup-status-action" : "followup-icon-action"}
                type="button"
                onClick={() => onFollowup(item)}
                aria-label={appointmentFollowup ? "Remover do follow-up" : "Marcar para follow-up"}
                title={appointmentFollowup ? "Remover do follow-up" : "Marcar para follow-up"}
              >
                <MessageCircle size={15} />
                {appointmentFollowup ? <span className="followup-button-label">Follow-up</span> : null}
              </button>
            </div>

            <div className="icon-actions">
              <button className="icon-action" type="button" onClick={() => onEdit(item)} aria-label="Editar">
                <Edit3 size={15} />
              </button>
              <button
                className="icon-action danger"
                type="button"
                onClick={() => onDelete(item)}
                aria-label="Excluir"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function HotClientRecordCard({ item, profile, onDelete }) {
  const observation = item.notes || item.note;

  return (
    <article className="record-card appointment-card hot-client-card">
      {item.status ? (
        <div className="appointment-status-area">
          <StatusBadge status={item.status} map={APPOINTMENT_STATUS} />
        </div>
      ) : null}

      <div className="appointment-content">
        <div className="record-main">
          <div className="appointment-info">
            <div className="record-title-line">
              <div className="appointment-heading">
                <div className="client-name-row">
                  <h3>{item.clientName}</h3>
                </div>
                <p>{item.vehicle || "Não informado"}</p>
              </div>
            </div>

            <div className="record-meta">
              {item.date ? (
                <span>
                  <Clock3 size={14} />
                  {formatDate(item.date)}{item.time ? ` às ${item.time}` : ""}
                </span>
              ) : null}
              <WhatsappCopyChip value={item.whatsapp} />
              <span>
                <WalletCards size={14} />
                {formatEntry(item.entryValue)}
              </span>
              {profile.role === "admin" && item.sellerName ? (
                <span>
                  <UserRound size={14} />
                  {item.sellerName}
                </span>
              ) : null}
            </div>

            {observation ? (
              <div className="record-notes">
                <strong>Observações:</strong>
                <span>{observation}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="record-actions appointment-actions hot-client-actions">
          <div className="icon-actions">
            <button className="icon-action danger" type="button" onClick={() => onDelete(item)} aria-label="Excluir">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FollowupRecordCard({ item, profile, onDone, onDelete }) {
  const observation = item.notes || item.note;

  return (
    <article className="record-card appointment-card hot-client-card followup-record-card">
      <div className="appointment-content">
        <div className="record-main">
          <div className="appointment-info">
            <div className="record-title-line">
              <div className="appointment-heading">
                <div className="client-name-row">
                  <h3>{item.clientName}</h3>
                </div>
                <p>{item.vehicle || "Não informado"}</p>
              </div>
            </div>

            <div className="record-meta">
              <span>
                <Clock3 size={14} />
                {item.date && item.time ? `${formatDate(item.date)} às ${item.time}` : `Retorno em ${formatDate(item.dueDate)}`}
              </span>
              <WhatsappCopyChip value={item.whatsapp} />
              <span>
                <WalletCards size={14} />
                {formatEntry(item.entryValue)}
              </span>
              {profile.role === "admin" && item.sellerName ? (
                <span>
                  <UserRound size={14} />
                  {item.sellerName}
                </span>
              ) : null}
            </div>

            {observation ? (
              <div className="record-notes">
                <strong>Observações:</strong>
                <span>{observation}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="record-actions appointment-actions hot-client-actions followup-record-actions">
          <button type="button" onClick={() => onDone(item)}>
            Concluir
          </button>
          <div className="icon-actions">
            <button className="icon-action danger" type="button" onClick={() => onDelete(item)} aria-label="Excluir">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SimulationForm({
  form,
  setForm,
  sellers,
  profile,
  editing,
  onSubmit,
  onCancel
}) {
  const sellerOptions = sellers.filter(seller => seller.role !== "admin");

  return (
    <form className="panel-card form-card" onSubmit={onSubmit}>
      <div className="panel-title-row">
        <div>
          <span className="section-eyebrow">
            <Search size={15} />
            Simulação
          </span>
          <h3>{editing ? "Editar simulação" : "Nova simulação"}</h3>
        </div>
        {editing ? (
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancelar edição
          </button>
        ) : null}
      </div>

      <div className="form-grid">
        {profile.role === "admin" ? (
          <label>
            Vendedor
            <select
              value={form.sellerId}
              onChange={event => setForm(current => ({ ...current, sellerId: event.target.value }))}
              required
            >
              <option value="">Selecione</option>
              {sellerOptions.map(seller => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          Nome do cliente
          <input
            value={form.clientName}
            onChange={event => setForm(current => ({ ...current, clientName: event.target.value }))}
            placeholder="Nome completo"
            required
          />
        </label>

        <label>
          WhatsApp
          <input
            value={form.whatsapp}
            onChange={event => setForm(current => ({ ...current, whatsapp: event.target.value }))}
            placeholder="(81) 99999-9999"
            required
          />
        </label>

        <label>
          CPF
          <input
            value={form.cpf}
            onChange={event => setForm(current => ({ ...current, cpf: event.target.value }))}
            placeholder="000.000.000-00"
            required
          />
        </label>

        <label>
          Data de nascimento
          <input
            type="date"
            value={form.birthDate}
            onChange={event => setForm(current => ({ ...current, birthDate: event.target.value }))}
            required
          />
        </label>

        <label>
          Habilitação
          <select
            value={form.license}
            onChange={event => setForm(current => ({ ...current, license: event.target.value }))}
          >
            <option value="sim">Possui</option>
            <option value="nao">Não possui</option>
            <option value="processo">Em processo</option>
          </select>
        </label>

        <label>
          Carro para simular
          <input
            value={form.vehicle}
            onChange={event => setForm(current => ({ ...current, vehicle: event.target.value }))}
            placeholder="Modelo desejado"
            required
          />
        </label>
      </div>

      <label className="full-label">
        Observações para a administração
        <textarea
          value={form.notes}
          onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
          placeholder="Entrada desejada, renda informada, condição ou qualquer detalhe relevante"
          rows={3}
        />
      </label>

      <button className="primary-button" type="submit">
        {editing ? "Salvar alterações" : "Enviar simulação"}
        <ChevronRight size={18} />
      </button>
    </form>
  );
}

function SimulationCard({ item, profile, onEdit, onDelete, onReview }) {
  const [response, setResponse] = useState(item.adminResponse || "");
  const canManage = profile.role === "admin" || item.sellerId === profile.id;

  useEffect(() => {
    setResponse(item.adminResponse || "");
  }, [item.id, item.adminResponse]);

  return (
    <article className="record-card simulation-card">
      <div className="record-main">
        <div className="record-icon">
          <IdCard size={20} />
        </div>
        <div>
          <div className="record-title-line">
            <h3>{item.clientName}</h3>
            <StatusBadge status={item.status} map={SIMULATION_STATUS} />
          </div>
          <p>{item.vehicle}</p>
          <div className="record-meta">
            <span>
              <Phone size={14} />
              {item.whatsapp}
            </span>
            <span>
              <IdCard size={14} />
              {item.cpf}
            </span>
            <span>
              <CalendarDays size={14} />
              {formatDate(item.birthDate)}
            </span>
            <span>
              <BadgeCheck size={14} />
              Habilitação: {item.licenseLabel}
            </span>
            {isAdmin && sellerFilterSections.includes(section) ? (
              <span>
                <UserRound size={14} />
                {item.sellerName || "Vendedor"}
              </span>
            ) : null}
          </div>
          {item.notes ? <p className="record-notes">{item.notes}</p> : null}
          {item.adminResponse ? (
            <div className="admin-response">
              <strong>Resposta da administração</strong>
              <p>{item.adminResponse}</p>
            </div>
          ) : null}
        </div>
      </div>

      {profile.role === "admin" ? (
        <div className="review-box">
          <textarea
            value={response}
            onChange={event => setResponse(event.target.value)}
            placeholder="Resposta para o vendedor, exemplo: Foi liberado nesse valor aqui"
            rows={3}
          />
          <div className="record-actions">
            <button type="button" onClick={() => onReview(item, "approved", response)}>
              Aprovar
            </button>
            <button type="button" onClick={() => onReview(item, "denied", response)}>
              Negativar
            </button>
            <button className="icon-action" type="button" onClick={() => onEdit(item)} aria-label="Editar">
              <Edit3 size={16} />
            </button>
            <button
              className="icon-action danger"
              type="button"
              onClick={() => onDelete(item)}
              aria-label="Excluir"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : canManage ? (
        <div className="record-actions">
          <button className="icon-action" type="button" onClick={() => onEdit(item)} aria-label="Editar">
            <Edit3 size={16} />
          </button>
          <button
            className="icon-action danger"
            type="button"
            onClick={() => onDelete(item)}
            aria-label="Excluir"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}
    </article>
  );
}

function SellerSelectField({ form, setForm, sellers, profile }) {
  const sellerOptions = sellers.filter(seller => seller.role !== "admin");

  if (profile.role !== "admin") return null;

  return (
    <label>
      Vendedor
      <select
        value={form.sellerId}
        onChange={event => setForm(current => ({ ...current, sellerId: event.target.value }))}
        required
      >
        <option value="">Selecione</option>
        {sellerOptions.map(seller => (
          <option key={seller.id} value={seller.id}>
            {seller.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function InternalNoteForm({ form, setForm, sellers, profile, onSubmit }) {
  return (
    <form className="panel-card form-card compact-tool-form" onSubmit={onSubmit}>
      <div className="panel-title-row">
        <div>
          <span className="section-eyebrow">
            <StickyNote size={15} />
            Notas internas
          </span>
          <h3>Nova nota</h3>
        </div>
      </div>

      <div className="form-grid">
        <SellerSelectField form={form} setForm={setForm} sellers={sellers} profile={profile} />

        <label>
          Título
          <input
            value={form.title}
            onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
            placeholder="Exemplo: Retornos importantes"
            required
          />
        </label>
      </div>

      <label className="full-label">
        Nota
        <textarea
          value={form.text}
          onChange={event => setForm(current => ({ ...current, text: event.target.value }))}
          placeholder="Escreva uma anotação para organizar seu atendimento"
          rows={5}
          required
        />
      </label>

      <button className="primary-button" type="submit">
        Salvar nota
        <ChevronRight size={18} />
      </button>
    </form>
  );
}

function ToolRecordCard({ icon: Icon, title, subtitle, meta, note, sellerName, profile, onDelete, onDone }) {
  return (
    <article className="record-card tool-record-card">
      <div className="record-main">
        <div className="record-icon">
          <Icon size={19} />
        </div>
        <div>
          <div className="record-title-line">
            <h3>{title}</h3>
            {profile.role === "admin" && sellerName ? <StatusBadge status={sellerName} map={{}} /> : null}
          </div>
          {subtitle ? <p>{subtitle}</p> : null}
          <div className="record-meta">
            {meta.map(item => (
              <span key={item}>
                <Clock3 size={14} />
                {item}
              </span>
            ))}
          </div>
          {note ? <p className="record-notes">{note}</p> : null}
        </div>
      </div>

      <div className="record-actions">
        {onDone ? (
          <button type="button" onClick={onDone}>
            Concluir
          </button>
        ) : null}
        <button className="icon-action danger" type="button" onClick={onDelete} aria-label="Excluir">
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [internalNotes, setInternalNotes] = useState([]);
  const [hotClients, setHotClients] = useState([]);
  const [section, setSection] = useState("appointments");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [sellerFilter, setSellerFilter] = useState("all");
  const [appointmentForm, setAppointmentForm] = useState(createAppointmentForm());
  const [simulationForm, setSimulationForm] = useState(createSimulationForm());
  const [noteForm, setNoteForm] = useState(createNoteForm());
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [editingSimulation, setEditingSimulation] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [dataError, setDataError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const welcomeTimeoutRef = useRef(null);

  function showLoginWelcome(nextProfile) {
    if (welcomeTimeoutRef.current) {
      clearTimeout(welcomeTimeoutRef.current);
    }

    setWelcomeMessage(loginWelcomeMessage(nextProfile));
    welcomeTimeoutRef.current = setTimeout(() => {
      setWelcomeMessage("");
      welcomeTimeoutRef.current = null;
    }, LOGIN_WELCOME_DURATION);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      setBooting(true);
      setLoginError("");
      setDataError("");

      if (!firebaseUser) {
        if (welcomeTimeoutRef.current) {
          clearTimeout(welcomeTimeoutRef.current);
          welcomeTimeoutRef.current = null;
        }
        setWelcomeMessage("");
        setUser(null);
        setProfile(null);
        setBooting(false);
        return;
      }

      try {
        const nextProfile = await ensureProfile(firebaseUser);
        setUser(firebaseUser);
        setProfile(nextProfile);
        setAppointmentForm(createAppointmentForm(nextProfile));
        setSimulationForm(createSimulationForm(nextProfile));
        setNoteForm(createNoteForm(nextProfile));
        setSelectedMonth(currentMonth());
        setSection(nextProfile.role === "admin" ? "overview" : "appointments");
        showLoginWelcome(nextProfile);
      } catch (error) {
        setLoginError("Não foi possível carregar o perfil. Verifique as permissões do Firebase.");
        console.error(error);
      } finally {
        setBooting(false);
      }
    });

    return () => {
      unsubscribe();
      if (welcomeTimeoutRef.current) {
        clearTimeout(welcomeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function animatePressedCard(event) {
      if (event.target.closest("button, a, input, select, textarea, label")) return;

      const card = event.target.closest(".metric-card, .record-card, .team-row, .empty-state");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const tapX = `${event.clientX - rect.left}px`;
      const tapY = `${event.clientY - rect.top}px`;

      card.classList.remove("is-tapped");
      card.style.setProperty("--tap-x", tapX);
      card.style.setProperty("--tap-y", tapY);
      window.requestAnimationFrame(() => {
        card.classList.add("is-tapped");
        window.setTimeout(() => card.classList.remove("is-tapped"), 520);
      });
    }

    document.addEventListener("pointerdown", animatePressedCard);

    return () => {
      document.removeEventListener("pointerdown", animatePressedCard);
    };
  }, []);

  useEffect(() => {
    if (!user || !profile) return undefined;

    const usersUnsubscribe = onSnapshot(
      collection(db, COLLECTIONS.users),
      snapshot => {
        setUsers(
          snapshot.docs.map(item => {
            const data = item.data();
            return {
              id: item.id,
              ...data,
              name: sellerDisplayName(data),
              displayName: sellerDisplayName(data)
            };
          })
        );
      },
      error => {
        setDataError("Não consegui carregar os vendedores. Confira as regras do Firestore.");
        console.error(error);
      }
    );

    const appointmentSource =
      profile.role === "admin"
        ? collection(db, COLLECTIONS.appointments)
        : query(collection(db, COLLECTIONS.appointments), where("sellerId", "==", user.uid));

    const appointmentsUnsubscribe = onSnapshot(
      appointmentSource,
      snapshot => {
        setAppointments(
          snapshot.docs.map(item => {
            const data = item.data();
            return {
              id: item.id,
              ...data,
              sellerName: normalizeSellerName(data.sellerName)
            };
          })
        );
      },
      error => {
        setDataError("Não consegui carregar os agendamentos. Confira as regras do Firestore.");
        console.error(error);
      }
    );

    const simulationSource =
      profile.role === "admin"
        ? collection(db, COLLECTIONS.simulations)
        : query(collection(db, COLLECTIONS.simulations), where("sellerId", "==", user.uid));

    const simulationsUnsubscribe = onSnapshot(
      simulationSource,
      snapshot => {
        setSimulations(
          snapshot.docs.map(item => {
            const data = item.data();
            return {
              id: item.id,
              ...data,
              sellerName: normalizeSellerName(data.sellerName)
            };
          })
        );
      },
      error => {
        setDataError("Não consegui carregar as simulações. Confira as regras do Firestore.");
        console.error(error);
      }
    );

    const followupSource =
      profile.role === "admin"
        ? collection(db, COLLECTIONS.followups)
        : query(collection(db, COLLECTIONS.followups), where("sellerId", "==", user.uid));

    const followupsUnsubscribe = onSnapshot(
      followupSource,
      snapshot => {
        setFollowups(
          snapshot.docs.map(item => {
            const data = item.data();
            return {
              id: item.id,
              ...data,
              sellerName: normalizeSellerName(data.sellerName)
            };
          })
        );
      },
      error => {
        setDataError("Não consegui carregar os follow-ups. Confira as regras do Firestore.");
        console.error(error);
      }
    );

    const notesSource =
      profile.role === "admin"
        ? collection(db, COLLECTIONS.notes)
        : query(collection(db, COLLECTIONS.notes), where("sellerId", "==", user.uid));

    const notesUnsubscribe = onSnapshot(
      notesSource,
      snapshot => {
        setInternalNotes(
          snapshot.docs.map(item => {
            const data = item.data();
            return {
              id: item.id,
              ...data,
              sellerName: normalizeSellerName(data.sellerName)
            };
          })
        );
      },
      error => {
        setDataError("Não consegui carregar as notas internas. Confira as regras do Firestore.");
        console.error(error);
      }
    );

    const hotClientSource =
      profile.role === "admin"
        ? collection(db, COLLECTIONS.hotClients)
        : query(collection(db, COLLECTIONS.hotClients), where("sellerId", "==", user.uid));

    const hotClientsUnsubscribe = onSnapshot(
      hotClientSource,
      snapshot => {
        setHotClients(
          snapshot.docs.map(item => {
            const data = item.data();
            return {
              id: item.id,
              ...data,
              sellerName: normalizeSellerName(data.sellerName)
            };
          })
        );
      },
      error => {
        setDataError("Não consegui carregar os clientes quentes. Confira as regras do Firestore.");
        console.error(error);
      }
    );

    return () => {
      usersUnsubscribe();
      appointmentsUnsubscribe();
      simulationsUnsubscribe();
      followupsUnsubscribe();
      notesUnsubscribe();
      hotClientsUnsubscribe();
    };
  }, [profile, user]);

  const sellers = useMemo(() => {
    const map = new Map();

    users
      .filter(item => item.role !== "admin")
      .forEach(item => map.set(item.id, item));

    appointments.forEach(item => {
      if (item.sellerId && !map.has(item.sellerId)) {
        map.set(item.sellerId, {
          id: item.sellerId,
          name: item.sellerName || "Vendedor",
          role: "seller"
        });
      }
    });

    simulations.forEach(item => {
      if (item.sellerId && !map.has(item.sellerId)) {
        map.set(item.sellerId, {
          id: item.sellerId,
          name: item.sellerName || "Vendedor",
          role: "seller"
        });
      }
    });

    [...followups, ...internalNotes, ...hotClients].forEach(item => {
      if (item.sellerId && !map.has(item.sellerId)) {
        map.set(item.sellerId, {
          id: item.sellerId,
          name: item.sellerName || "Vendedor",
          role: "seller"
        });
      }
    });

    if (profile?.role === "seller" && !map.has(profile.id)) {
      map.set(profile.id, profile);
    }

    return Array.from(map.values()).sort((a, b) => clean(a.name).localeCompare(clean(b.name)));
  }, [appointments, followups, hotClients, internalNotes, profile, simulations, users]);

  const visibleAppointments = useMemo(() => {
    return appointments
      .filter(item => (item.month || item.date?.slice(0, 7)) === selectedMonth)
      .filter(item => sellerFilter === "all" || item.sellerId === sellerFilter)
      .sort((a, b) => `${a.date || ""}${a.time || ""}`.localeCompare(`${b.date || ""}${b.time || ""}`));
  }, [appointments, selectedMonth, sellerFilter]);

  const visibleSimulations = useMemo(() => {
    return simulations
      .filter(item => (item.month || item.createdDate?.slice(0, 7)) === selectedMonth)
      .filter(item => sellerFilter === "all" || item.sellerId === sellerFilter)
      .sort((a, b) => clean(b.createdDate).localeCompare(clean(a.createdDate)));
  }, [sellerFilter, selectedMonth, simulations]);

  const visiblePendingSimulations = useMemo(() => {
    return visibleSimulations.filter(item => item.status === "pending");
  }, [visibleSimulations]);

  const automaticPendingAppointments = useMemo(() => {
    return appointments
      .filter(isAutomaticPending)
      .filter(item => sellerFilter === "all" || item.sellerId === sellerFilter)
      .sort((a, b) => {
        const dateA = appointmentDateTime(a)?.getTime() || 0;
        const dateB = appointmentDateTime(b)?.getTime() || 0;
        return dateA - dateB;
      });
  }, [appointments, sellerFilter]);

  const visibleFollowups = useMemo(() => {
    return followups
      .map(item => {
        const appointment = appointments.find(appointmentItem => appointmentItem.id === item.appointmentId);

        if (!appointment) return item;

        return {
          ...item,
          sellerId: appointment.sellerId || item.sellerId,
          sellerName: appointment.sellerName || item.sellerName,
          clientName: appointment.clientName || item.clientName,
          whatsapp: appointment.whatsapp || item.whatsapp,
          dueDate: appointment.date || item.dueDate,
          date: appointment.date || item.date,
          time: appointment.time || item.time,
          entryValue: appointment.entryValue ?? item.entryValue,
          vehicle: appointment.vehicle || item.vehicle,
          appointmentStatus: appointment.status || item.appointmentStatus,
          notes: appointment.notes || item.notes || item.note,
          note: appointment.notes || item.note
        };
      })
      .filter(item => item.status !== "done")
      .filter(item => sellerFilter === "all" || item.sellerId === sellerFilter)
      .sort((a, b) => clean(a.dueDate).localeCompare(clean(b.dueDate)));
  }, [appointments, followups, sellerFilter]);

  const visibleInternalNotes = useMemo(() => {
    return internalNotes
      .filter(item => sellerFilter === "all" || item.sellerId === sellerFilter)
      .sort((a, b) => clean(b.createdDate).localeCompare(clean(a.createdDate)));
  }, [internalNotes, sellerFilter]);

  const visibleHotClients = useMemo(() => {
    return hotClients
      .map(item => {
        const appointment = appointments.find(appointmentItem => appointmentItem.id === item.appointmentId);

        if (!appointment) return item;

        return {
          ...item,
          sellerId: appointment.sellerId || item.sellerId,
          sellerName: appointment.sellerName || item.sellerName,
          clientName: appointment.clientName || item.clientName,
          whatsapp: appointment.whatsapp || item.whatsapp,
          date: appointment.date || item.date,
          time: appointment.time || item.time,
          entryValue: appointment.entryValue ?? item.entryValue,
          vehicle: appointment.vehicle || item.vehicle,
          status: appointment.status || item.status,
          notes: appointment.notes || item.notes || item.note
        };
      })
      .filter(item => sellerFilter === "all" || item.sellerId === sellerFilter)
      .sort((a, b) => clean(b.createdDate).localeCompare(clean(a.createdDate)));
  }, [appointments, hotClients, sellerFilter]);

  const appointmentMetrics = useMemo(() => {
    const visits = visibleAppointments.filter(item => ["visited", "sold"].includes(item.status)).length;
    const sold = visibleAppointments.filter(item => item.status === "sold").length;
    const noShow = visibleAppointments.filter(item => item.status === "no_show").length;
    const conversion = visits ? Math.round((sold / visits) * 100) : 0;

    return {
      total: visibleAppointments.length,
      visits,
      sold,
      noShow,
      conversion
    };
  }, [visibleAppointments]);

  const simulationMetrics = useMemo(() => {
    return {
      total: visibleSimulations.length,
      pending: visibleSimulations.filter(item => item.status === "pending").length,
      approved: visibleSimulations.filter(item => item.status === "approved").length,
      denied: visibleSimulations.filter(item => item.status === "denied").length
    };
  }, [visibleSimulations]);

  const teamRows = useMemo(() => {
    return sellers.map(seller => {
      const sellerAppointments = appointments.filter(item => {
        const itemMonth = item.month || item.date?.slice(0, 7);
        return item.sellerId === seller.id && itemMonth === selectedMonth;
      });
      const sellerSimulations = simulations.filter(item => {
        const itemMonth = item.month || item.createdDate?.slice(0, 7);
        return item.sellerId === seller.id && itemMonth === selectedMonth;
      });
      const visits = sellerAppointments.filter(item => ["visited", "sold"].includes(item.status)).length;
      const sold = sellerAppointments.filter(item => item.status === "sold").length;
      const conversion = visits ? Math.round((sold / visits) * 100) : 0;

      return {
        seller,
        appointments: sellerAppointments.length,
        visits,
        sold,
        conversion,
        simulations: sellerSimulations.length,
        approved: sellerSimulations.filter(item => item.status === "approved").length
      };
    });
  }, [appointments, selectedMonth, sellers, simulations]);

  const adminMonthAppointments = useMemo(() => {
    return appointments.filter(item => (item.month || item.date?.slice(0, 7)) === selectedMonth);
  }, [appointments, selectedMonth]);

  const adminMonthSimulations = useMemo(() => {
    return simulations.filter(item => (item.month || item.createdDate?.slice(0, 7)) === selectedMonth);
  }, [selectedMonth, simulations]);

  const adminOverviewMetrics = useMemo(() => {
    const visits = adminMonthAppointments.filter(item => ["visited", "sold"].includes(item.status)).length;
    const sold = adminMonthAppointments.filter(item => item.status === "sold").length;
    const noShow = adminMonthAppointments.filter(item => item.status === "no_show").length;
    const conversion = visits ? Math.round((sold / visits) * 100) : 0;

    return {
      appointments: adminMonthAppointments.length,
      visits,
      sold,
      noShow,
      conversion,
      pendingSimulations: adminMonthSimulations.filter(item => item.status === "pending").length,
      openFollowups: followups.filter(item => item.status !== "done").length,
      hotClients: hotClients.length,
      pendingAppointments: appointments.filter(isAutomaticPending).length
    };
  }, [adminMonthAppointments, adminMonthSimulations, appointments, followups, hotClients.length]);

  async function handleLogin(credentials) {
    setLoginLoading(true);
    setLoginError("");

    try {
      await signInWithEmailAndPassword(auth, clean(credentials.email).toLowerCase(), credentials.password);
    } catch (error) {
      setLoginError("E-mail ou senha inválidos. Confira os dados e tente novamente.");
      console.error(error);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  function resolveSeller(sellerId) {
    if (profile.role === "seller") return profile;
    return sellers.find(seller => seller.id === sellerId);
  }

  async function submitAppointment(event) {
    event.preventDefault();
    const sellerId = profile.role === "seller" ? profile.id : appointmentForm.sellerId;
    const seller = resolveSeller(sellerId);

    if (!sellerId || !seller) {
      setDataError("Escolha um vendedor antes de salvar o agendamento.");
      return;
    }

    const entryValue = parseMoney(appointmentForm.entryValue);
    const payload = {
      sellerId,
      sellerName: seller.name,
      clientName: clean(appointmentForm.clientName),
      whatsapp: clean(appointmentForm.whatsapp),
      date: appointmentForm.date,
      time: appointmentForm.time,
      month: appointmentForm.date.slice(0, 7),
      entryValue: entryValue > 0 ? entryValue : null,
      vehicle: clean(appointmentForm.vehicle),
      status: appointmentForm.status,
      notes: clean(appointmentForm.notes),
      updatedAt: serverTimestamp()
    };

    if (editingAppointment) {
      await updateDoc(doc(db, COLLECTIONS.appointments, editingAppointment.id), payload);
    } else {
      await addDoc(collection(db, COLLECTIONS.appointments), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    setEditingAppointment(null);
    setAppointmentForm(createAppointmentForm(profile));
  }

  async function submitSimulation(event) {
    event.preventDefault();
    const sellerId = profile.role === "seller" ? profile.id : simulationForm.sellerId;
    const seller = resolveSeller(sellerId);

    if (!sellerId || !seller) {
      setDataError("Escolha um vendedor antes de salvar a simulação.");
      return;
    }

    const createdDate = editingSimulation?.createdDate || localDateInput();
    const licenseLabels = {
      sim: "possui",
      nao: "não possui",
      processo: "em processo"
    };
    const payload = {
      sellerId,
      sellerName: seller.name,
      clientName: clean(simulationForm.clientName),
      whatsapp: clean(simulationForm.whatsapp),
      cpf: clean(simulationForm.cpf),
      birthDate: simulationForm.birthDate,
      license: simulationForm.license,
      licenseLabel: licenseLabels[simulationForm.license],
      vehicle: clean(simulationForm.vehicle),
      notes: clean(simulationForm.notes),
      createdDate,
      month: createdDate.slice(0, 7),
      status: editingSimulation?.status || "pending",
      adminResponse: editingSimulation?.adminResponse || "",
      updatedAt: serverTimestamp()
    };

    if (editingSimulation) {
      await updateDoc(doc(db, COLLECTIONS.simulations, editingSimulation.id), payload);
    } else {
      await addDoc(collection(db, COLLECTIONS.simulations), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    setEditingSimulation(null);
    setSimulationForm(createSimulationForm(profile));
  }

  async function submitInternalNote(event) {
    event.preventDefault();
    const sellerId = profile.role === "seller" ? profile.id : noteForm.sellerId;
    const seller = resolveSeller(sellerId);

    if (!sellerId || !seller) {
      setDataError("Escolha um vendedor antes de salvar a nota.");
      return;
    }

    await addDoc(collection(db, COLLECTIONS.notes), {
      sellerId,
      sellerName: seller.name,
      title: clean(noteForm.title),
      text: clean(noteForm.text),
      createdDate: localDateInput(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    setNoteForm(createNoteForm(profile));
  }

  async function markAppointmentAsHotClient(item) {
    const existing = hotClients.find(client => client.appointmentId === item.id);
    if (existing) {
      await deleteDoc(doc(db, COLLECTIONS.hotClients, existing.id));
      return;
    }

    await addDoc(collection(db, COLLECTIONS.hotClients), {
      sellerId: item.sellerId,
      sellerName: item.sellerName || profile.name,
      appointmentId: item.id,
      clientName: clean(item.clientName),
      whatsapp: clean(item.whatsapp),
      date: item.date || "",
      time: item.time || "",
      entryValue: item.entryValue || null,
      vehicle: clean(item.vehicle),
      status: item.status || "scheduled",
      notes: clean(item.notes),
      note: clean(item.notes) || "Marcado como cliente quente pelo agendamento.",
      createdDate: localDateInput(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async function markAppointmentAsFollowup(item) {
    const existing = followups.find(followup => followup.appointmentId === item.id);
    if (existing) {
      await deleteDoc(doc(db, COLLECTIONS.followups, existing.id));
      return;
    }

    await addDoc(collection(db, COLLECTIONS.followups), {
      sellerId: item.sellerId,
      sellerName: item.sellerName || profile.name,
      appointmentId: item.id,
      clientName: clean(item.clientName),
      whatsapp: clean(item.whatsapp),
      dueDate: item.date || localDateInput(),
      date: item.date || "",
      time: item.time || "",
      entryValue: item.entryValue || null,
      vehicle: clean(item.vehicle),
      appointmentStatus: item.status || "scheduled",
      notes: clean(item.notes),
      note: clean(item.notes) || "Follow-up criado pelo agendamento.",
      status: "open",
      createdDate: localDateInput(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  function editAppointment(item) {
    setEditingAppointment(item);
    setAppointmentForm({
      sellerId: item.sellerId || "",
      clientName: item.clientName || "",
      whatsapp: item.whatsapp || "",
      date: item.date || localDateInput(),
      time: item.time || "",
      entryValue: item.entryValue ? String(item.entryValue) : "",
      vehicle: item.vehicle || "",
      status: item.status || "scheduled",
      notes: item.notes || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editSimulation(item) {
    setEditingSimulation(item);
    setSimulationForm({
      sellerId: item.sellerId || "",
      clientName: item.clientName || "",
      whatsapp: item.whatsapp || "",
      cpf: item.cpf || "",
      birthDate: item.birthDate || "",
      license: item.license || "sim",
      vehicle: item.vehicle || "",
      notes: item.notes || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteAppointment(item) {
    await deleteDoc(doc(db, COLLECTIONS.appointments, item.id));
  }

  async function deleteSimulation(item) {
    await deleteDoc(doc(db, COLLECTIONS.simulations, item.id));
  }

  async function updateAppointmentStatus(item, status) {
    await updateDoc(doc(db, COLLECTIONS.appointments, item.id), {
      status,
      updatedAt: serverTimestamp()
    });
  }

  async function reviewSimulation(item, status, response) {
    await updateDoc(doc(db, COLLECTIONS.simulations, item.id), {
      status,
      adminResponse: clean(response),
      answeredBy: profile.name,
      answeredAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });
  }

  async function completeFollowup(item) {
    await updateDoc(doc(db, COLLECTIONS.followups, item.id), {
      status: "done",
      completedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });
  }

  async function deleteFollowup(item) {
    await deleteDoc(doc(db, COLLECTIONS.followups, item.id));
  }

  async function deleteInternalNote(item) {
    await deleteDoc(doc(db, COLLECTIONS.notes, item.id));
  }

  async function deleteHotClient(item) {
    await deleteDoc(doc(db, COLLECTIONS.hotClients, item.id));
  }

  function openSection(nextSection) {
    setSection(nextSection);
    setMobileNavOpen(false);
  }

  if (booting) {
    return <main className="boot-screen" aria-label="Carregando" />;
  }

  if (!profile) {
    return <LoginView onLogin={handleLogin} loading={loginLoading} error={loginError} />;
  }

  if (welcomeMessage) {
    return (
      <main className="welcome-screen">
        <div className="welcome-loader-card">
          <h1>{welcomeMessage}</h1>
          <div className="welcome-progress" aria-hidden="true">
            <span />
          </div>
        </div>
      </main>
    );
  }

  const isAdmin = profile.role === "admin";
  const sellerFilterSections = ["appointments", "simulations", "pending", "followups", "notes", "hot-clients"];
  const sellerNavItems = [
    {
      id: "appointments",
      label: "Agendamentos",
      icon: ClipboardList
    },
    {
      id: "followups",
      label: "Follow-up",
      icon: MessageCircle
    },
    {
      id: "hot-clients",
      label: "Clientes quentes",
      icon: Flame
    },
    {
      id: "pending",
      label: "Pendências",
      icon: Clock3
    },
    {
      id: "notes",
      label: "Notas internas",
      icon: StickyNote
    },
    {
      id: "simulations",
      label: "Simulações",
      icon: FileText
    }
  ];

  const adminNavItems = [
    {
      id: "overview",
      label: "Visao geral",
      icon: LayoutDashboard
    },
    {
      id: "sellers",
      label: "Vendedores",
      icon: UsersRound
    },
    {
      id: "appointments",
      label: "Agendamentos",
      icon: ClipboardList
    },
    {
      id: "simulations",
      label: "Simulacoes pendentes",
      icon: FileText
    },
    {
      id: "followups",
      label: "Follow-ups atrasados",
      icon: MessageCircle
    },
    {
      id: "hot-clients",
      label: "Clientes quentes",
      icon: Flame
    },
    {
      id: "pending",
      label: "Pendencias",
      icon: Clock3
    },
    {
      id: "notes",
      label: "Notas internas",
      icon: StickyNote
    },
    {
      id: "history",
      label: "Historico mensal",
      icon: ChartNoAxesCombined
    }
  ];

  const navItems = isAdmin ? adminNavItems : sellerNavItems;

  const sectionTitles = {
    overview: "Visao geral",
    appointments: "Agendamentos",
    simulations: "Simulações",
    pending: "Pendências automáticas",
    followups: "Follow-up",
    notes: "Notas internas",
    "hot-clients": "Clientes quentes",
    team: "Painel da equipe",
    sellers: "Vendedores",
    history: "Historico mensal"
  };
  const simulationRecords = isAdmin ? visiblePendingSimulations : visibleSimulations;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/logop1veiculos.png" alt="P1 Auto Recife" />
          <div>
            <strong>Sistemas P1</strong>
            <span>{profile.role === "admin" ? "Administração" : "Vendedor"}</span>
          </div>
        </div>

        <nav>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={section === item.id ? "active" : ""}
                type="button"
                onClick={() => openSection(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-profile">
          <div className="avatar">
            <UserRound size={18} />
          </div>
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.role === "admin" ? "Administrador" : "Vendedor"}</span>
          </div>
        </div>

        <button className="logout-button" type="button" onClick={handleLogout}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="mobile-menu" type="button" onClick={() => setMobileNavOpen(true)}>
            <Menu size={20} />
          </button>

          <div>
            <span className="section-eyebrow">
              <LayoutDashboard size={15} />
              {formatMonth(selectedMonth)}
            </span>
            <h1>{sectionTitles[section]}</h1>
          </div>

          <div className="topbar-controls">
            <label>
              Mês
              <input
                type="month"
                value={selectedMonth}
                onChange={event => setSelectedMonth(event.target.value || currentMonth())}
              />
            </label>

            {profile.role === "admin" ? (
              <label>
                Vendedor
                <select value={sellerFilter} onChange={event => setSellerFilter(event.target.value)}>
                  <option value="all">Todos</option>
                  {sellers.map(seller => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </header>

        {dataError ? (
          <div className="data-error">
            <XCircle size={18} />
            {dataError}
            <button type="button" onClick={() => setDataError("")}>
              Fechar
            </button>
          </div>
        ) : null}

        {section === "overview" ? (
          <section className="admin-overview section-view">
            <div className="metrics-grid admin-metrics-grid">
              <MetricCard
                icon={CalendarDays}
                label="agendamentos da equipe"
                value={metricValue(adminOverviewMetrics.appointments)}
                tone="blue"
              />
              <MetricCard icon={CheckCircle2} label="visitas realizadas" value={metricValue(adminOverviewMetrics.visits)} tone="green" />
              <MetricCard icon={CircleDollarSign} label="vendas fechadas" value={metricValue(adminOverviewMetrics.sold)} tone="lime" />
              <MetricCard
                icon={ChartNoAxesCombined}
                label="conversao geral"
                value={`${adminOverviewMetrics.conversion}%`}
                hint="vendas sobre visitas"
                tone="blue"
              />
              <MetricCard icon={XCircle} label="clientes que nao vieram" value={metricValue(adminOverviewMetrics.noShow)} tone="amber" />
              <MetricCard icon={FileText} label="simulacoes pendentes" value={metricValue(adminOverviewMetrics.pendingSimulations)} tone="amber" />
              <MetricCard icon={MessageCircle} label="follow-ups abertos" value={metricValue(adminOverviewMetrics.openFollowups)} tone="blue" />
              <MetricCard icon={Flame} label="clientes quentes" value={metricValue(adminOverviewMetrics.hotClients)} tone="red" />
            </div>

            <div className="panel-card admin-command-panel">
              <div className="panel-title-row">
                <div>
                  <span className="section-eyebrow">
                    <ShieldCheck size={15} />
                    Central da administracao
                  </span>
                  <h3>Atalhos de acompanhamento</h3>
                </div>
              </div>

              <div className="admin-shortcut-grid">
                {adminNavItems
                  .filter(item => !["overview", "history"].includes(item.id))
                  .map(item => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} type="button" onClick={() => openSection(item.id)}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                        <ChevronRight size={17} />
                      </button>
                    );
                  })}
              </div>
            </div>
          </section>
        ) : null}

        {section === "appointments" ? (
          <section className="module-grid section-view">
            <div className="module-left">
              <div className="metrics-grid">
                <MetricCard icon={CalendarDays} label="agendamentos" value={metricValue(appointmentMetrics.total)} />
                <MetricCard icon={CheckCircle2} label="visitas" value={metricValue(appointmentMetrics.visits)} tone="green" />
                <MetricCard icon={CircleDollarSign} label="vendas" value={metricValue(appointmentMetrics.sold)} tone="lime" />
                <MetricCard
                  icon={ChartNoAxesCombined}
                  label="conversão"
                  value={`${appointmentMetrics.conversion}%`}
                  hint="vendas sobre visitas"
                  tone="blue"
                />
              </div>

              <AppointmentForm
                form={appointmentForm}
                setForm={setAppointmentForm}
                sellers={sellers}
                profile={profile}
                editing={editingAppointment}
                onSubmit={submitAppointment}
                onCancel={() => {
                  setEditingAppointment(null);
                  setAppointmentForm(createAppointmentForm(profile));
                }}
              />
            </div>

            <div className="module-right">
              <div className="list-header">
                <div>
                  <h2>Agenda do mês</h2>
                </div>
                <span>{visibleAppointments.length} registros</span>
              </div>

              <div className="record-list">
                {visibleAppointments.length ? (
                  visibleAppointments.map(item => (
                    <AppointmentCard
                      key={item.id}
                      item={item}
                      profile={profile}
                      hotClient={hotClients.find(client => client.appointmentId === item.id)}
                      appointmentFollowup={followups.find(followup => followup.appointmentId === item.id)}
                      onEdit={editAppointment}
                      onDelete={deleteAppointment}
                      onStatus={updateAppointmentStatus}
                      onHotClient={markAppointmentAsHotClient}
                      onFollowup={markAppointmentAsFollowup}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="Nenhum agendamento neste mês"
                    text="Quando um vendedor registrar um cliente, ele aparece aqui."
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === "simulations" ? (
          <section className={isAdmin ? "tool-page section-view" : "module-grid section-view"}>
            {!isAdmin ? <div className="module-left">
              <div className="metrics-grid">
                <MetricCard icon={FileText} label="simulações" value={metricValue(simulationMetrics.total)} />
                <MetricCard icon={Clock3} label="em análise" value={metricValue(simulationMetrics.pending)} tone="amber" />
                <MetricCard icon={CheckCircle2} label="aprovadas" value={metricValue(simulationMetrics.approved)} tone="green" />
                <MetricCard icon={XCircle} label="negativas" value={metricValue(simulationMetrics.denied)} tone="red" />
              </div>

              <SimulationForm
                form={simulationForm}
                setForm={setSimulationForm}
                sellers={sellers}
                profile={profile}
                editing={editingSimulation}
                onSubmit={submitSimulation}
                onCancel={() => {
                  setEditingSimulation(null);
                  setSimulationForm(createSimulationForm(profile));
                }}
              />
            </div> : null}

            <div className="module-right">
              <div className="list-header">
                <div>
                  <span className="section-eyebrow">
                    <UserCog size={15} />
                    Análise da administração
                  </span>
                  <h2>Solicitações do mês</h2>
                </div>
                <span>{simulationRecords.length} registros</span>
              </div>

              <div className="record-list">
                {simulationRecords.length ? (
                  simulationRecords.map(item => (
                    <SimulationCard
                      key={item.id}
                      item={item}
                      profile={profile}
                      onEdit={editSimulation}
                      onDelete={deleteSimulation}
                      onReview={reviewSimulation}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={Search}
                    title="Nenhuma simulação neste mês"
                    text="As solicitações enviadas pelos vendedores ficam reunidas aqui."
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === "pending" ? (
          <section className="tool-page section-view">
            <div className="panel-card">
              <div className="list-header">
                <div>
                  <span className="section-eyebrow">
                    <Clock3 size={15} />
                    Status ainda agendado
                  </span>
                  <h2>Clientes com horário já passado</h2>
                </div>
                <span>{automaticPendingAppointments.length} registros</span>
              </div>

              <div className="record-list">
                {automaticPendingAppointments.length ? (
                  automaticPendingAppointments.map(item => (
                    <AppointmentCard
                      key={item.id}
                      item={item}
                      profile={profile}
                      hotClient={hotClients.find(client => client.appointmentId === item.id)}
                      appointmentFollowup={followups.find(followup => followup.appointmentId === item.id)}
                      onEdit={editAppointment}
                      onDelete={deleteAppointment}
                      onStatus={updateAppointmentStatus}
                      onHotClient={markAppointmentAsHotClient}
                      onFollowup={markAppointmentAsFollowup}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={Clock3}
                    title="Nenhuma pendência automática"
                    text="Quando um atendimento passar do horário e continuar como agendado, ele aparece aqui."
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === "followups" ? (
          <section className="tool-page section-view">
            <div className="panel-card">
              <div className="list-header">
                <div>
                  <span className="section-eyebrow">
                    <MessageCircle size={15} />
                    Retornos programados
                  </span>
                  <h2>Clientes marcados nos agendamentos</h2>
                </div>
                <span>{visibleFollowups.length} registros</span>
              </div>

              <div className="record-list auto-card-grid">
                {visibleFollowups.length ? (
                  visibleFollowups.map(item => (
                    <FollowupRecordCard
                      key={item.id}
                      item={item}
                      profile={profile}
                      onDone={() => completeFollowup(item)}
                      onDelete={() => deleteFollowup(item)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={MessageCircle}
                    title="Nenhum follow-up aberto"
                    text="Marque o ícone azul no card do agendamento para enviar o cliente para cá."
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === "notes" ? (
          <section className="module-grid section-view">
            <div className="module-left">
              <InternalNoteForm
                form={noteForm}
                setForm={setNoteForm}
                sellers={sellers}
                profile={profile}
                onSubmit={submitInternalNote}
              />
            </div>

            <div className="module-right">
              <div className="list-header">
                <div>
                  <span className="section-eyebrow">
                    <StickyNote size={15} />
                    Organização pessoal
                  </span>
                  <h2>Notas salvas</h2>
                </div>
                <span>{visibleInternalNotes.length} registros</span>
              </div>

              <div className="record-list">
                {visibleInternalNotes.length ? (
                  visibleInternalNotes.map(item => (
                    <ToolRecordCard
                      key={item.id}
                      icon={StickyNote}
                      title={item.title}
                      subtitle={formatDate(item.createdDate)}
                      meta={[]}
                      note={item.text}
                      sellerName={item.sellerName}
                      profile={profile}
                      onDelete={() => deleteInternalNote(item)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={StickyNote}
                    title="Nenhuma nota interna"
                    text="Use este espaço para lembretes e informações que ajudam no atendimento."
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === "hot-clients" ? (
          <section className="tool-page section-view">
            <div className="panel-card">
              <div className="list-header">
                <div>
                  <span className="section-eyebrow">
                    <Flame size={15} />
                    Prioridade comercial
                  </span>
                  <h2>Clientes marcados nos agendamentos</h2>
                </div>
                <span>{visibleHotClients.length} registros</span>
              </div>

              <div className="record-list auto-card-grid">
                {visibleHotClients.length ? (
                  visibleHotClients.map(item => (
                    <HotClientRecordCard
                      key={item.id}
                      item={item}
                      profile={profile}
                      onDelete={() => deleteHotClient(item)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={Flame}
                    title="Nenhum cliente quente"
                    text="Marque um cliente como quente direto no card do agendamento para ele aparecer aqui."
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === "sellers" ? (
          <section className="team-panel section-view">
            <div className="seller-card-grid">
              {teamRows.length ? (
                teamRows.map(row => (
                  <article className="seller-performance-card panel-card" key={row.seller.id}>
                    <div className="seller-card-head">
                      <div className="avatar">
                        <UserRound size={18} />
                      </div>
                      <div>
                        <h3>{row.seller.name}</h3>
                        <span>Desempenho de {formatMonth(selectedMonth)}</span>
                      </div>
                    </div>

                    <div className="seller-mini-grid">
                      <span>
                        <strong>{metricValue(row.appointments)}</strong>
                        agendamentos
                      </span>
                      <span>
                        <strong>{metricValue(row.visits)}</strong>
                        visitas
                      </span>
                      <span>
                        <strong>{metricValue(row.sold)}</strong>
                        vendas
                      </span>
                      <span>
                        <strong>{row.conversion}%</strong>
                        conversao
                      </span>
                    </div>

                    <button
                      className="primary-button seller-open-button"
                      type="button"
                      onClick={() => {
                        setSellerFilter(row.seller.id);
                        openSection("appointments");
                      }}
                    >
                      Abrir agendamentos
                      <ChevronRight size={18} />
                    </button>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon={UsersRound}
                  title="Nenhum vendedor encontrado"
                  text="Assim que os logins forem usados, os vendedores aparecem neste painel."
                />
              )}
            </div>
          </section>
        ) : null}

        {section === "history" ? (
          <section className="team-panel section-view">
            <div className="metrics-grid">
              <MetricCard icon={UsersRound} label="vendedores" value={metricValue(teamRows.length)} />
              <MetricCard icon={CalendarDays} label="agendamentos" value={metricValue(adminOverviewMetrics.appointments)} tone="blue" />
              <MetricCard icon={Car} label="visitas" value={metricValue(adminOverviewMetrics.visits)} tone="green" />
              <MetricCard icon={CircleDollarSign} label="vendas" value={metricValue(adminOverviewMetrics.sold)} tone="lime" />
            </div>

            <div className="panel-card">
              <div className="panel-title-row">
                <div>
                  <span className="section-eyebrow">
                    <ChartNoAxesCombined size={15} />
                    Consulta por mes
                  </span>
                  <h3>{formatMonth(selectedMonth)}</h3>
                </div>
              </div>

              <div className="team-table">
                <div className="team-row table-head">
                  <span>Vendedor</span>
                  <span>Agend.</span>
                  <span>Visitas</span>
                  <span>Vendas</span>
                  <span>Conv.</span>
                  <span>Simulacoes</span>
                  <span>Aprov.</span>
                </div>

                {teamRows.length ? (
                  teamRows.map(row => (
                    <div className="team-row" key={row.seller.id}>
                      <strong>{row.seller.name}</strong>
                      <span>{row.appointments}</span>
                      <span>{row.visits}</span>
                      <span>{row.sold}</span>
                      <span>{row.conversion}%</span>
                      <span>{row.simulations}</span>
                      <span>{row.approved}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={UsersRound}
                    title="Nenhum vendedor encontrado"
                    text="Assim que os logins forem usados, os vendedores aparecem neste painel."
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === "team" ? (
          <section className="team-panel section-view">
            <div className="metrics-grid">
              <MetricCard icon={UsersRound} label="vendedores" value={metricValue(teamRows.length)} />
              <MetricCard
                icon={CalendarDays}
                label="agendamentos"
                value={metricValue(teamRows.reduce((total, row) => total + row.appointments, 0))}
                tone="blue"
              />
              <MetricCard
                icon={Car}
                label="visitas"
                value={metricValue(teamRows.reduce((total, row) => total + row.visits, 0))}
                tone="green"
              />
              <MetricCard
                icon={CircleDollarSign}
                label="vendas"
                value={metricValue(teamRows.reduce((total, row) => total + row.sold, 0))}
                tone="lime"
              />
            </div>

            <div className="panel-card">
              <div className="panel-title-row">
                <div>
                  <span className="section-eyebrow">
                    <ChartNoAxesCombined size={15} />
                    Desempenho por vendedor
                  </span>
                  <h3>{formatMonth(selectedMonth)}</h3>
                </div>
              </div>

              <div className="team-table">
                <div className="team-row table-head">
                  <span>Vendedor</span>
                  <span>Agend.</span>
                  <span>Visitas</span>
                  <span>Vendas</span>
                  <span>Conv.</span>
                  <span>Simulações</span>
                  <span>Aprov.</span>
                </div>

                {teamRows.length ? (
                  teamRows.map(row => (
                    <div className="team-row" key={row.seller.id}>
                      <strong>{row.seller.name}</strong>
                      <span>{row.appointments}</span>
                      <span>{row.visits}</span>
                      <span>{row.sold}</span>
                      <span>{row.conversion}%</span>
                      <span>{row.simulations}</span>
                      <span>{row.approved}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={UsersRound}
                    title="Nenhum vendedor encontrado"
                    text="Assim que os logins forem usados, os vendedores aparecem neste painel."
                  />
                )}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
