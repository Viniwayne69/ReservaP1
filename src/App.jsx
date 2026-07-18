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
  FileText,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
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
  simulations: "p1_simulations"
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

async function ensureProfile(firebaseUser) {
  const email = firebaseUser.email?.toLowerCase() || "";
  const profileRef = doc(db, COLLECTIONS.users, firebaseUser.uid);
  const profileSnap = await getDoc(profileRef);
  const knownUser = findKnownUserByEmail(email);

  if (profileSnap.exists()) {
    const savedProfile = profileSnap.data();
    const displayName = knownUser?.displayName || savedProfile.displayName || savedProfile.name;

    if (knownUser && savedProfile.name !== knownUser.displayName) {
      await setDoc(
        profileRef,
        {
          name: knownUser.displayName,
          fullName: knownUser.name,
          displayName: knownUser.displayName,
          email,
          role: knownUser.role,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    return {
      id: firebaseUser.uid,
      ...savedProfile,
      name: displayName,
      displayName,
      email
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

  function submit(event) {
    event.preventDefault();
    onLogin({ email, password });
  }

  return (
    <main className="login-screen">
      <section className="login-brand" aria-label="Imagem automotiva P1" />

      <form className="login-card" onSubmit={submit}>
        <div className="login-card-head">
          <h2>Entrar no painel</h2>
          <p>Use seu e-mail e senha cadastrados para acessar seu ambiente de trabalho.</p>
        </div>

        <label>
          E-mail
          <input
            type="email"
            autoComplete="email"
            list="seller-logins"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="vendedor@email.com"
            required
          />
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
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            required
          />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Acessar painel"}
          <ChevronRight size={18} />
        </button>

        <div className="login-footnote">
          <ShieldCheck size={15} />
          Acesso exclusivo para equipe autorizada da P1 Auto Recife
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

function AppointmentCard({ item, profile, onEdit, onDelete, onStatus }) {
  const canManage = profile.role === "admin" || item.sellerId === profile.id;

  return (
    <article className="record-card appointment-card">
      <div className="appointment-content">
        <div className="record-main">
          <div className="record-icon">
            <CalendarCheck size={18} />
          </div>

          <div className="appointment-info">
            <div className="record-title-line">
              <div>
                <h3>{item.clientName}</h3>
                <p>{item.vehicle || "Não informado"}</p>
              </div>
              <StatusBadge status={item.status} map={APPOINTMENT_STATUS} />
            </div>

            <div className="record-meta">
              <span>
                <Clock3 size={14} />
                {formatDate(item.date)} às {item.time}
              </span>
              <span>
                <Phone size={14} />
                {item.whatsapp}
              </span>
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

            {item.notes ? <p className="record-notes">{item.notes}</p> : null}
          </div>
        </div>

        {canManage ? (
          <div className="record-actions appointment-actions">
            <div className="status-actions" aria-label="Atualizar status">
              <button type="button" onClick={() => onStatus(item, "visited")}>
                Visitou
              </button>
              <button type="button" onClick={() => onStatus(item, "sold")}>
                Vendeu
              </button>
              <button type="button" onClick={() => onStatus(item, "no_show")}>
                Não veio
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
            {profile.role === "admin" ? (
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

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [section, setSection] = useState("appointments");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [sellerFilter, setSellerFilter] = useState("all");
  const [appointmentForm, setAppointmentForm] = useState(createAppointmentForm());
  const [simulationForm, setSimulationForm] = useState(createSimulationForm());
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
        setSelectedMonth(currentMonth());
        setSection("appointments");
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

    return () => {
      usersUnsubscribe();
      appointmentsUnsubscribe();
      simulationsUnsubscribe();
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

    if (profile?.role === "seller" && !map.has(profile.id)) {
      map.set(profile.id, profile);
    }

    return Array.from(map.values()).sort((a, b) => clean(a.name).localeCompare(clean(b.name)));
  }, [appointments, profile, simulations, users]);

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
    if (!window.confirm(`Excluir o agendamento de ${item.clientName}?`)) return;
    await deleteDoc(doc(db, COLLECTIONS.appointments, item.id));
  }

  async function deleteSimulation(item) {
    if (!window.confirm(`Excluir a simulação de ${item.clientName}?`)) return;
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

  const navItems = [
    {
      id: "appointments",
      label: "Agendamentos",
      icon: ClipboardList
    },
    {
      id: "simulations",
      label: "Simulações",
      icon: FileText
    },
    ...(profile.role === "admin"
      ? [
          {
            id: "team",
            label: "Equipe",
            icon: UsersRound
          }
        ]
      : [])
  ];

  const sectionTitles = {
    appointments: "Agendamentos",
    simulations: "Simulações",
    team: "Painel da equipe"
  };

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
                  <span className="section-eyebrow">
                    <RefreshCw size={15} />
                    Atualização automática
                  </span>
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
                      onEdit={editAppointment}
                      onDelete={deleteAppointment}
                      onStatus={updateAppointmentStatus}
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
          <section className="module-grid section-view">
            <div className="module-left">
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
            </div>

            <div className="module-right">
              <div className="list-header">
                <div>
                  <span className="section-eyebrow">
                    <UserCog size={15} />
                    Análise da administração
                  </span>
                  <h2>Solicitações do mês</h2>
                </div>
                <span>{visibleSimulations.length} registros</span>
              </div>

              <div className="record-list">
                {visibleSimulations.length ? (
                  visibleSimulations.map(item => (
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
