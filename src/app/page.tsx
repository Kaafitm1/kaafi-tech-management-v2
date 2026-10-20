"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, BookOpen, CalendarCheck, Check, ChevronDown, CircleDollarSign,
  ClipboardList, Clock3, Download, FileSpreadsheet, Printer, GraduationCap, LayoutDashboard, Menu,
  Plus, Search, Settings, ShieldCheck, UserRound, Users, Wallet, X
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string; course_code: string; name: string; description: string | null;
  fee: number; duration_weeks: number | null; class_capacity: number | null; status: string;
};

type ClassRow = {
  id: string; course_id: string; class_name: string; teacher_id: string | null;
  classroom: string | null; shift: string | null; start_date: string | null;
  expected_end_date: string | null; status: string;
};
type Teacher = { id: string; full_name: string; role: string };
type Schedule = { id: string; class_id: string; weekday: number; start_time: string; end_time: string; duration_minutes: number | null };

type PaymentTransaction = {
  id: string; student_id: string; amount: number; payment_date: string;
  payment_method: string; period_name: string; receipt_number: string;
  notes: string | null; recorded_by: string | null; created_at: string;
};

type Student = {
  id: string; course_id?: string | null; student_code: string; full_name: string; sex: string | null;
  phone: string | null; whatsapp: string | null; guardian_name: string | null;
  guardian_phone: string | null; neighborhood: string | null; education_level: string | null;
  course_name: string | null; course_fee: number | null; learning_mode: string | null;
  shift: string | null; monthly_payment_status: string | null; book_issued: boolean;
  status: string; registered_at: string;
};

const nav = [
  ["Dashboard", LayoutDashboard], ["Students", Users], ["Register Student", Plus],
  ["Courses", BookOpen], ["Classes & Timetable", Clock3], ["Attendance", CalendarCheck],
  ["Fees & Payments", Wallet], ["Student Reports", ClipboardList], ["Attendance Reports", CalendarCheck], ["Books Management", BookOpen],
  ["Staff & Users", ShieldCheck], ["Settings", Settings],
] as const;

function localMonth(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function money(n: number) { return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n); }

export default function Home() {
  const [page, setPage] = useState("Dashboard");
  const [reportStatus, setReportStatus] = useState("all");
  const [reportLimit, setReportLimit] = useState("all");
  const [printOrientation, setPrintOrientation] = useState("landscape");
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendanceClassId, setAttendanceClassId] = useState("");
  const [attendanceScheduleId, setAttendanceScheduleId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [attendanceRoster, setAttendanceRoster] = useState<(Student & { attendance_status: string; attendance_note: string })[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [attendanceReportLoading, setAttendanceReportLoading] = useState(false);
  const [attendanceReportClass, setAttendanceReportClass] = useState("all");
  const [attendanceReportStatus, setAttendanceReportStatus] = useState("all");
  const [attendanceReportFrom, setAttendanceReportFrom] = useState("");
  const [attendanceReportTo, setAttendanceReportTo] = useState("");
  const [studentReportSearch, setStudentReportSearch] = useState("");
  const [studentReportStatus, setStudentReportStatus] = useState("all");
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [feeLedger, setFeeLedger] = useState<any[]>([]);
  const [feePeriods, setFeePeriods] = useState<any[]>([]);
  const [waiverRequests, setWaiverRequests] = useState<any[]>([]);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState("all");
  const [staffSavingId, setStaffSavingId] = useState<string | null>(null);
  const [permissionProfile, setPermissionProfile] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const permissionModules = [
    { key: "dashboard", label: "Dashboard" }, { key: "students", label: "Ardayda" },
    { key: "courses", label: "Koorsooyinka" }, { key: "classes", label: "Fasallada iyo jadwalka" },
    { key: "attendance", label: "Xaadirinta" }, { key: "payments", label: "Lacagaha iyo lacag-bixinta" },
    { key: "student_reports", label: "Warbixinta ardayda" }, { key: "attendance_reports", label: "Warbixinta xaadirinta" },
    { key: "books", label: "Buugaagta iyo agabka" }, { key: "staff_users", label: "Shaqaalaha iyo isticmaalayaasha" },
    { key: "settings", label: "Dejinta nidaamka" },
  ];
  const permissionActions = [
    { key: "view", label: "Arag" }, { key: "create", label: "Abuur" },
    { key: "edit", label: "Wax ka beddel" }, { key: "delete", label: "Tirtir" },
    { key: "export", label: "Export" },
  ];
  const [staffCreateOpen, setStaffCreateOpen] = useState(false);
  const [staffCreateSaving, setStaffCreateSaving] = useState(false);
  const [staffCreateForm, setStaffCreateForm] = useState({full_name:"", email:"", password:"", role:"registration_staff"});
  const [waiverForm, setWaiverForm] = useState({student_id:"",amount_requested:"",reason:"",period_name:localMonth()});
  const [refundForm, setRefundForm] = useState({payment_transaction_id:"",amount_requested:"",reason:""});
  const [closingNotes, setClosingNotes] = useState("");
  const [feeActionLoading, setFeeActionLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({student_id:"",amount:"",payment_date:localDate(),payment_method:"Cash",period_name:localMonth(),notes:""});
  const [paymentSearch, setPaymentSearch] = useState("");
  const [debtPeriod, setDebtPeriod] = useState(localMonth());
  const [dashboardPeriod, setDashboardPeriod] = useState(localMonth());
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [dashboardReportCourse, setDashboardReportCourse] = useState("all");
  const [dashboardReportStatus, setDashboardReportStatus] = useState("all");
  const [dashboardReportSex, setDashboardReportSex] = useState("all");
  const [dashboardReportFrom, setDashboardReportFrom] = useState("");
  const [dashboardReportTo, setDashboardReportTo] = useState("");
  const [dashboardReportIncludePhone, setDashboardReportIncludePhone] = useState(true);
  const [dashboardReportIncludeFees, setDashboardReportIncludeFees] = useState(true);
  const [dashboardReportIncludeRegistration, setDashboardReportIncludeRegistration] = useState(true);
  const [ktProfile, setKtProfile] = useState({
    organizationName: "Kaafi Tech and Media Center",
    shortName: "KAAFI TECH",
    phone: "",
    email: "",
    address: "",
    website: "",
    registrationNumber: "",
    tagline: "Technology · Training · Media",
  });
  const [ktProfileSaved, setKtProfileSaved] = useState(false);
  const [courseMaterials, setCourseMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsSaving, setMaterialsSaving] = useState(false);
  const [materialsSearch, setMaterialsSearch] = useState("");
  const [materialsCourseFilter, setMaterialsCourseFilter] = useState("all");
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState({course_id:"", title:"", material_type:"Lesson", lesson_number:"1", description:"", content:"", reference_url:""});

  const [classLoading, setClassLoading] = useState(false);
  const [classSaving, setClassSaving] = useState(false);
  const [classFormOpen, setClassFormOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [scheduleClassId, setScheduleClassId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({class_name:"",course_id:"",teacher_id:"",classroom:"",shift:"Subax",start_date:"",expected_end_date:"",status:"Active"});
  const [scheduleForm, setScheduleForm] = useState({weekday:"1",start_time:"09:00",end_time:"10:00"});
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseForm, setCourseForm] = useState({course_code:"",name:"",description:"",fee:"0",duration_months:"2",class_capacity:"15",status:"Active"});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState({
    full_name:"", sex:"", phone:"", whatsapp:"", guardian_name:"", guardian_phone:"",
    neighborhood:"", education_level:"", course_id:"", course_name:"Office Programs", course_fee:"60",
    learning_mode:"Full-time", shift:"Subax", monthly_payment_status:"Unpaid",
    book_issued:false, status:"Active"
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("kaafi-tech-profile-v1");
      if (saved) setKtProfile(current => ({ ...current, ...JSON.parse(saved) }));
    } catch { /* Ignore unavailable or invalid local profile data. */ }
  }, []);

  function saveKtProfile() {
    try {
      window.localStorage.setItem("kaafi-tech-profile-v1", JSON.stringify(ktProfile));
      setKtProfileSaved(true);
      setMessage("KT Profile waa la kaydiyey qalabkan.");
    } catch {
      setMessage("KT Profile lama kaydin karin browser-kan.");
    }
  }

  function printDashboardStudentReport() {
    const rows = students.filter(st =>
      (dashboardReportCourse === "all" || st.course_id === dashboardReportCourse) &&
      (dashboardReportStatus === "all" || st.status === dashboardReportStatus) &&
      (dashboardReportSex === "all" || String(st.sex || "").toLowerCase() === dashboardReportSex.toLowerCase()) &&
      (!dashboardReportFrom || String(st.registered_at || "").slice(0, 10) >= dashboardReportFrom) &&
      (!dashboardReportTo || String(st.registered_at || "").slice(0, 10) <= dashboardReportTo)
    );
    const headers = ["Student ID", "Magaca ardayga", ...(dashboardReportIncludePhone ? ["Telefoon"] : []), "Koorsada", "Xaaladda", ...(dashboardReportIncludeFees ? ["Fee"] : []), ...(dashboardReportIncludeRegistration ? ["Taariikhda diiwaangelinta"] : [])];
    const reportRows = rows.map(st => [
      st.student_code,
      st.full_name,
      ...(dashboardReportIncludePhone ? [st.phone || ""] : []),
      st.course_name || courses.find(c => c.id === st.course_id)?.name || "",
      st.status,
      ...(dashboardReportIncludeFees ? [money(Number(st.course_fee || 0))] : []),
      ...(dashboardReportIncludeRegistration ? [String(st.registered_at || "").slice(0, 10)] : []),
    ]);
    const criteria = [
      `Koorsada: ${dashboardReportCourse === "all" ? "Dhammaan" : courses.find(c => c.id === dashboardReportCourse)?.name || "La doortay"}`,
      `Xaaladda: ${dashboardReportStatus === "all" ? "Dhammaan" : dashboardReportStatus}`,
      `Jinsiga: ${dashboardReportSex === "all" ? "Dhammaan" : dashboardReportSex}`,
      `Laga bilaabo: ${dashboardReportFrom || "Bilow kasta"}`,
      `Ilaa: ${dashboardReportTo || "Taariikh kasta"}`,
    ];
    printSimpleReport(`Warbixinta Guud ee Ardayda (${rows.length}) — ${criteria.join(" · ")}`, headers, reportRows);
  }

  async function loadCourses() {
    if (!supabase) { setCourses([]); return; }
    setCourseLoading(true);
    const { data, error } = await supabase.from("courses")
      .select("id,course_code,name,description,fee,duration_weeks,class_capacity,status")
      .order("name", { ascending: true });
    setCourseLoading(false);
    if (error) { setMessage(`Koorsooyinka lama soo qaadi karin: ${error.message}`); return; }
    const loadedCourses = (data ?? []) as Course[];
    setCourses(loadedCourses);
    const activeCourses = loadedCourses.filter(c => c.status === "Active");
    setForm(current => {
      if (current.course_id && activeCourses.some(c => c.id === current.course_id)) return current;
      const first = activeCourses[0];
      return first ? { ...current, course_id: first.id, course_name: first.name, course_fee: String(first.fee ?? 0) } : current;
    });
  }

  async function loadClasses() {
    if (!supabase) return;
    setClassLoading(true);
    const [classResult, teacherResult, scheduleResult] = await Promise.all([
      supabase.from("classes").select("id,course_id,class_name,teacher_id,classroom,shift,start_date,expected_end_date,status").order("created_at", {ascending:false}),
      supabase.from("profiles").select("id,full_name,role").order("full_name"),
      supabase.from("class_schedules").select("id,class_id,weekday,start_time,end_time,duration_minutes").order("weekday").order("start_time")
    ]);
    setClassLoading(false);
    if (classResult.error) { setMessage(`Fasallada lama soo qaadi karin: ${classResult.error.message}`); return; }
    setClasses((classResult.data ?? []) as ClassRow[]);
    if (!teacherResult.error) setTeachers(((teacherResult.data ?? []) as Teacher[]).filter(t => ["teacher", "macallin", "instructor"].includes(String(t.role ?? "").trim().toLowerCase())));
    if (!scheduleResult.error) setSchedules((scheduleResult.data ?? []) as Schedule[]);
  }

  async function fetchAllRows(tableName: string, orderColumn: string, ascending = false) {
    if (!supabase) return { data: [] as any[], error: null as any };
    const all: any[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const result = await (supabase as any).from(tableName).select("*").order(orderColumn,{ascending}).range(from,from+pageSize-1);
      if (result.error) return { data: null as any[] | null, error: result.error };
      const page = result.data ?? [];
      all.push(...page);
      if (page.length < pageSize) break;
    }
    return { data: all, error: null as any };
  }

  async function loadCourseMaterials() {
    if (!supabase) return;
    setMaterialsLoading(true);
    const { data, error } = await supabase.from("course_materials").select("*").order("course_id").order("lesson_number").order("created_at", {ascending:false});
    setMaterialsLoading(false);
    if (error) { setMessage(`Agabka koorsooyinka lama soo qaadi karin: ${error.message}. Hubi SQL migration-ka course_materials.`); return; }
    setCourseMaterials(data ?? []);
  }

  function resetMaterialForm() {
    setMaterialForm({course_id: courses[0]?.id ?? "", title:"", material_type:"Lesson", lesson_number:"1", description:"", content:"", reference_url:""});
    setEditingMaterialId(null);
    setMaterialFormOpen(false);
  }

  async function saveCourseMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    if (!materialForm.course_id || !materialForm.title.trim()) { setMessage("Dooro koorso oo geli magaca buugga/casharka."); return; }
    setMaterialsSaving(true); setMessage("");
    const payload = {course_id:materialForm.course_id,title:materialForm.title.trim(),material_type:materialForm.material_type,lesson_number:Math.max(1,Number(materialForm.lesson_number)||1),description:materialForm.description.trim()||null,content:materialForm.content.trim()||null,reference_url:materialForm.reference_url.trim()||null,created_by:session?.user.id??null,updated_at:new Date().toISOString()};
    const result = editingMaterialId
      ? await supabase.from("course_materials").update(payload).eq("id",editingMaterialId)
      : await supabase.from("course_materials").insert(payload);
    setMaterialsSaving(false);
    if (result.error) { setMessage(`Agabka lama kaydin: ${result.error.message}`); return; }
    setMessage(editingMaterialId ? "Buugga/casharka waa la cusboonaysiiyey." : "Buugga/casharka waa la kaydiyey.");
    resetMaterialForm(); await loadCourseMaterials();
  }

  function editCourseMaterial(item:any) {
    setEditingMaterialId(item.id);
    setMaterialForm({course_id:item.course_id,title:item.title??"",material_type:item.material_type??"Lesson",lesson_number:String(item.lesson_number??1),description:item.description??"",content:item.content??"",reference_url:item.reference_url??""});
    setMaterialFormOpen(true);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function deleteCourseMaterial(item:any) {
    if (!supabase || !window.confirm(`Ma hubtaa inaad tirtirayso “${item.title}”?`)) return;
    const {error}=await supabase.from("course_materials").delete().eq("id",item.id);
    if(error){setMessage(`Lama tirtiri karin: ${error.message}`);return;}
    setMessage("Buugga/casharka waa la tirtiray."); await loadCourseMaterials();
  }

  async function loadStudents() {
    if (!supabase) { setConnected(false); setStudents([]); return; }
    setLoading(true);
    const { data, error } = await fetchAllRows("students","registered_at",false);
    setLoading(false);
    if (error) { setMessage(`Xogta ardayda lama soo qaadi karin: ${error.message}`); setConnected(true); return; }
    setStudents((data ?? []) as Student[]);
    setConnected(true);
    setMessage("");
  }
  async function loadPayments() {
    if (!supabase) return;
    setPaymentLoading(true);
    const [paymentResult, ledgerResult, periodResult, waiverResult, refundResult, profileResult] = await Promise.all([
      fetchAllRows("payment_transactions","payment_date",false),
      fetchAllRows("monthly_fee_ledger","period_name",false),
      fetchAllRows("monthly_fee_periods","period_name",false),
      fetchAllRows("fee_waiver_requests","created_at",false),
      fetchAllRows("refund_requests","created_at",false),
      supabase.from("profiles").select("role").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle()
    ]);
    setPaymentLoading(false);
    const failed = [paymentResult,ledgerResult,periodResult,waiverResult,refundResult].find((r:any)=>r.error);
    if (failed?.error) { setMessage(`Xogta lacagaha lama wada soo qaadi karin: ${failed.error.message}`); return; }
    setPayments((paymentResult.data ?? []) as PaymentTransaction[]);
    setFeeLedger(ledgerResult.data ?? []);
    setFeePeriods(periodResult.data ?? []);
    setWaiverRequests(waiverResult.data ?? []);
    setRefundRequests(refundResult.data ?? []);
    if (profileResult.error) setMessage(`Role-ka maamulka lama xaqiijin: ${profileResult.error.message}`);
    setIsAdmin(String(profileResult.data?.role ?? "").toLowerCase() === "admin");
  }

  async function refreshDashboardData() {
    if (!supabase) return;
    setDashboardRefreshing(true);
    try { await Promise.all([loadStudents(), loadCourses(), loadClasses(), loadPayments()]); }
    finally { setDashboardRefreshing(false); }
  }


  async function loadStaffProfiles() {
    if (!supabase) return;
    setStaffLoading(true);
    setMessage("");
    const { data: authData } = await supabase.auth.getUser();
    const { data: myProfile, error: myProfileError } = await supabase.from("profiles").select("id,full_name,role").eq("id", authData.user?.id ?? "").maybeSingle();
    if (myProfileError || String(myProfile?.role ?? "").toLowerCase() !== "admin") {
      setStaffLoading(false);
      setMessage(myProfileError ? `Role-ka lama xaqiijin: ${myProfileError.message}` : "Qaybtan waxaa geli kara Admin oo keliya.");
      setStaffProfiles([]);
      return;
    }
    setIsAdmin(true);
    const { data, error } = await supabase.from("profiles").select("id,full_name,role").order("full_name", {ascending:true});
    setStaffLoading(false);
    if (error) { setMessage(`Liiska shaqaalaha lama soo qaadi karin: ${error.message}. Hubi policies-ka profiles.`); return; }
    setStaffProfiles(data ?? []);
  }

  async function updateStaffRole(profile: any, nextRole: string) {
    if (!supabase || !isAdmin) { setMessage("Kaliya Admin ayaa beddeli kara rukhsadaha."); return; }
    if (profile.id === session?.user.id) { setMessage("Amniga awgiis, role-ka akoonka aad hadda ku jirto halkan lagama beddeli karo."); return; }
    const previousRole = String(profile.role ?? "staff");
    if (previousRole === nextRole) return;
    if (!window.confirm(`Ma hubtaa inaad ${profile.full_name || "isticmaalahan"} ka beddelayso ${previousRole} una beddelayso ${nextRole}?`)) return;
    setStaffSavingId(profile.id); setMessage("");
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/users/${profile.id}`, { method:"PATCH", headers:{"Content-Type":"application/json", Authorization:`Bearer ${currentSession?.access_token ?? ""}`}, body:JSON.stringify({role:nextRole}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Role-ka lama beddeli karin.");
      setStaffProfiles(rows => rows.map(row => row.id === profile.id ? {...row, role:nextRole} : row));
      setMessage(`Rukhsadda ${profile.full_name || "isticmaalaha"} waa la cusboonaysiiyey.`);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Role-ka lama beddeli karin."); }
    finally { setStaffSavingId(null); }
  }

  async function loadUserPermissions(profile: any) {
    if (!supabase || !isAdmin) { setMessage("Admin-ka keliya ayaa maamuli kara rukhsadaha."); return; }
    setPermissionProfile(profile); setPermissionsLoading(true); setMessage("");
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) throw new Error("Fadlan mar kale gal nidaamka.");
      const response = await fetch(`/api/admin/users/${profile.id}/permissions`, { headers: { Authorization: `Bearer ${currentSession.access_token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Rukhsadaha lama soo qaadi karin.");
      setUserPermissions(result.permissions || {});
    } catch (error) {
      setPermissionProfile(null); setMessage(error instanceof Error ? error.message : "Rukhsadaha lama soo qaadi karin.");
    } finally { setPermissionsLoading(false); }
  }

  async function saveUserPermissions() {
    if (!supabase || !isAdmin || !permissionProfile) { setMessage("Dooro isticmaale sax ah marka hore."); return; }
    setPermissionsSaving(true); setMessage("");
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) throw new Error("Fadlan mar kale gal nidaamka.");
      const response = await fetch(`/api/admin/users/${permissionProfile.id}/permissions`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSession.access_token}` },
        body: JSON.stringify({ permissions: userPermissions }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Rukhsadaha lama kaydin karin.");
      setUserPermissions(result.permissions || {}); setMessage(`Rukhsadaha ${permissionProfile.full_name || "isticmaalaha"} waa la kaydiyey.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Rukhsadaha lama kaydin karin."); }
    finally { setPermissionsSaving(false); }
  }

  async function createStaffAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !isAdmin) { setMessage("Admin-ka keliya ayaa abuuri kara akoonno."); return; }
    const full_name = staffCreateForm.full_name.trim();
    const emailValue = staffCreateForm.email.trim().toLowerCase();
    if (!full_name || !emailValue || staffCreateForm.password.length < 8) {
      setMessage("Geli magaca, email sax ah, iyo password ugu yaraan 8 xaraf ah."); return;
    }
    setStaffCreateSaving(true); setMessage("");
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) throw new Error("Fadlan mar kale gal nidaamka.");
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSession.access_token}` },
        body: JSON.stringify({ full_name, email: emailValue, password: staffCreateForm.password, role: staffCreateForm.role })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Akoonka lama abuuri karin.");
      setStaffCreateForm({full_name:"",email:"",password:"",role:"registration_staff"});
      setStaffCreateOpen(false);
      setMessage(`Akoonka ${full_name} waa la abuuray. Role: ${result.user.role}.`);
      await loadStaffProfiles();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Khalad ayaa dhacay markii akoonka la abuurayay.");
    } finally { setStaffCreateSaving(false); }
  }

  const filteredStaffProfiles = staffProfiles.filter(profile => {
    const query = `${profile.full_name ?? ""} ${profile.role ?? ""} ${profile.id ?? ""}`.toLowerCase();
    return query.includes(staffSearch.toLowerCase()) && (staffRoleFilter === "all" || String(profile.role ?? "").toLowerCase() === staffRoleFilter);
  });

  async function generateMonthlyFees() {
    if (!supabase) return;
    setFeeActionLoading(true); setMessage("");
    const { data, error } = await supabase.rpc("generate_monthly_fee_ledger", { p_period_name: debtPeriod });
    setFeeActionLoading(false);
    if (error) { setMessage(`Lama abuuri karin kharashka bisha: ${error.message}`); return; }
    setMessage(`Kharashka ${debtPeriod} waa la diyaariyey. Diiwaanno cusub: ${Number(data ?? 0)}. Diiwaannadii hore lama tirtirin.`);
    await loadPayments();
  }

  async function closeMonthlyFees() {
    if (!supabase || !window.confirm(`Ma hubtaa inaad xirayso bisha ${debtPeriod}? Marka la xiro dib looma abuuri karo ledger-ka bishan.`)) return;
    setFeeActionLoading(true); setMessage("");
    const { error } = await supabase.rpc("close_monthly_fee_period", { p_period_name: debtPeriod, p_notes: closingNotes.trim() || null });
    setFeeActionLoading(false);
    if (error) { setMessage(`Bisha lama xiri karin: ${error.message}`); return; }
    setClosingNotes(""); setMessage(`Bisha ${debtPeriod} waa la xiray. Diiwaanka lacagaha waa la ilaaliyey.`); await loadPayments();
  }

  async function submitWaiverRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !waiverForm.student_id || !waiverForm.period_name || Number(waiverForm.amount_requested) <= 0 || !waiverForm.reason.trim()) { setMessage("Buuxi ardayga, bisha, qadarka iyo sababta codsiga ka-dhaafista."); return; }
    const waiverLedger = feeLedger.find((r:any)=>r.student_id===waiverForm.student_id && r.period_name===waiverForm.period_name);
    if (!waiverLedger) { setMessage(`Marka hore abuur ledger-ka bisha ${waiverForm.period_name}; codsiga ka-dhaafistu wuxuu u baahan yahay diiwaan kharash oo jira.`); return; }
    if (feePeriods.find((r:any)=>r.period_name===waiverForm.period_name)?.status === "Closed") { setMessage("Bishan waa xiran tahay; codsi ka-dhaafis cusub lama gudbin karo."); return; }
    const existingWaiver = waiverRequests.some((r:any)=>r.student_id===waiverForm.student_id && r.period_name===waiverForm.period_name && r.status!=="Rejected");
    if (existingWaiver) { setMessage("Ardaygan bishaas codsi ka-dhaafis ayuu hore u leeyahay; ka eeg liiska codsiyada."); return; }
    const availableToWaive = Math.max(0,Number(waiverLedger.amount_due||0)-Number(waiverLedger.amount_waived||0)-studentPaidTotal(waiverForm.student_id,waiverForm.period_name));
    if (Number(waiverForm.amount_requested)>availableToWaive) { setMessage(`Ka-dhaafistu kama badnaan karto hadhaaga kharashka ${money(availableToWaive)}.`); return; }
    setFeeActionLoading(true); setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("fee_waiver_requests").insert({student_id:waiverForm.student_id,period_name:waiverForm.period_name,amount_requested:Number(waiverForm.amount_requested),reason:waiverForm.reason.trim(),requested_by:userData.user?.id});
    setFeeActionLoading(false);
    if (error) { setMessage(`Codsiga ka-dhaafista lama gudbin: ${error.message}`); return; }
    setWaiverForm(v=>({...v,student_id:"",amount_requested:"",reason:""})); setMessage("Codsiga ka-dhaafista waa la gudbiyey si maamulka u eego."); await loadPayments();
  }

  async function submitRefundRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payment = payments.find(p=>p.id===refundForm.payment_transaction_id);
    if (!supabase || !payment || Number(refundForm.amount_requested)<=0 || !refundForm.reason.trim()) { setMessage("Dooro lacag-bixinta, geli qadarka lacag-celinta iyo sababta."); return; }
    const priorRefunds = refundRequests.filter((r:any)=>r.payment_transaction_id===payment.id && ["Pending","Approved","Paid"].includes(r.status)).reduce((sum:number,r:any)=>sum+Number(r.amount_requested||0),0);
    if (priorRefunds + Number(refundForm.amount_requested) > Number(payment.amount)) { setMessage(`Lacag-celinta cusub iyo codsiyadii hore kama badnaan karaan lacagtii asalka ahayd ${money(Number(payment.amount))}.`); return; }
    setFeeActionLoading(true); setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("refund_requests").insert({payment_transaction_id:payment.id,amount_requested:Number(refundForm.amount_requested),reason:refundForm.reason.trim(),requested_by:userData.user?.id});
    setFeeActionLoading(false);
    if (error) { setMessage(`Codsiga lacag-celinta lama gudbin: ${error.message}`); return; }
    setRefundForm({payment_transaction_id:"",amount_requested:"",reason:""}); setMessage("Codsiga lacag-celinta waa la gudbiyey. Lacag-bixintii asalka ahayd lama tirtirin."); await loadPayments();
  }

  async function reviewRequest(table: "fee_waiver_requests"|"refund_requests", id: string, status: "Approved"|"Rejected") {
    if (!supabase || !isAdmin) { setMessage("Kaliya Admin ayaa ansixin ama diidi kara codsiyada."); return; }
    const note = window.prompt(`Faallo maamulka (ikhtiyaari) — ${status}:`);
    if (note === null) return;
    setFeeActionLoading(true); setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    let error: { message: string } | null = null;
    if (table === "fee_waiver_requests") {
      const result = await supabase.rpc("review_fee_waiver_request", { p_request_id:id, p_status:status, p_review_note:note.trim() || null });
      error = result.error;
    } else {
      const result = await supabase.from("refund_requests").update({status,reviewed_by:userData.user?.id ?? null,reviewed_at:new Date().toISOString(),review_note:note.trim() || null}).eq("id",id).eq("status","Pending");
      error = result.error;
    }
    setFeeActionLoading(false);
    if (error) { setMessage(`Go'aanka lama kaydin: ${error.message}`); return; }
    setMessage(table === "fee_waiver_requests" && status === "Approved" ? "Codsiga waa la ansixiyey, ledger-kana waa la cusboonaysiiyey." : `Codsiga waa ${status === "Approved" ? "la ansixiyey" : "la diiday"}.`); await loadPayments();
  }


  async function markRefundAsPaid(id: string) {
    if (!supabase || !isAdmin) { setMessage("Kaliya Admin ayaa xaqiijin kara lacag-celin la fuliyey."); return; }
    const reference = window.prompt("Geli tixraaca lacag-celinta (transaction/reference number). Haddii aan jirin, geli qoraal sharaxaad ah:");
    if (reference === null || !reference.trim()) return;
    setFeeActionLoading(true); setMessage("");
    const { error } = await supabase.rpc("mark_refund_paid", { p_request_id:id, p_refund_reference:reference.trim() });
    setFeeActionLoading(false);
    if (error) { setMessage(`Lacag-celinta lama xaqiijin: ${error.message}`); return; }
    setMessage("Lacag-celinta waxaa loo calaamadeeyey in la bixiyey. Wadarta lacagta saafiga ah waa la cusboonaysiinayaa.");
    await loadPayments();
  }

  async function savePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !paymentForm.student_id || !paymentForm.amount || Number(paymentForm.amount) <= 0 || !paymentForm.payment_date || !paymentForm.period_name) {
      setMessage("Buuxi ardayga, lacagta, taariikhda iyo bisha; lacagtu waa inay ka weyn tahay eber."); return;
    }
    const student = students.find(s => s.id === paymentForm.student_id);
    if (!student) { setMessage("Ardayga la doortay lama helin."); return; }
    const ledger = feeLedger.find((r:any)=>r.student_id===student.id && r.period_name===paymentForm.period_name);
    if (!ledger) { setMessage(`Kharashka bisha ${paymentForm.period_name} weli lama abuurin. Marka hore ka samee qaybta Maamulka Kharashka Bisha.`); return; }
    const period = feePeriods.find((r:any)=>r.period_name===paymentForm.period_name);
    if (period?.status === "Closed") { setMessage(`Bisha ${paymentForm.period_name} waa xiran tahay; lacag-bixin cusub lama diiwaangelin karo.`); return; }
    const periodFee = Math.max(0, Number(ledger.amount_due || 0) - Number(ledger.amount_waived || 0));
    const alreadyPaid = studentPaidTotal(student.id, paymentForm.period_name);
    const remainingDue = Math.max(0, periodFee - alreadyPaid);
    if (remainingDue <= 0) { setMessage("Ardaygani muddadan wax lacag ah kuma laha sida ledger-ku qabo. Hubi lacag-bixinta ama ka-dhaafista."); return; }
    if (Number(paymentForm.amount) > remainingDue) { setMessage(`Lacagta la geliyey waxay ka badan tahay hadhaaga ledger-ka ee ${money(remainingDue)} muddadan.`); return; }
    setPaymentSaving(true); setMessage("");
    const receipt = `KT-${Date.now().toString().slice(-8)}`;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("payment_transactions").insert({
      student_id: paymentForm.student_id, amount: Number(paymentForm.amount),
      payment_date: paymentForm.payment_date, payment_method: paymentForm.payment_method,
      period_name: paymentForm.period_name, receipt_number: receipt,
      notes: paymentForm.notes.trim() || null, recorded_by: userData.user?.id ?? null
    });
    setPaymentSaving(false);
    if (error) { setMessage(`Lacagta lama kaydin: ${error.message}`); return; }
    setMessage(`Lacagta waa la kaydiyey. Rasiid: ${receipt}`);
    setPaymentForm(current => ({...current, amount:"", notes:""}));
    await loadPayments();
  }

  function studentPaidTotal(studentId: string, period?: string) {
    return payments.filter(p => p.student_id === studentId && (!period || p.period_name === period))
      .reduce((sum,p) => sum + Number(p.amount || 0), 0);
  }

  function printReceipt(payment: PaymentTransaction) {
    const student = students.find(s => s.id === payment.student_id);
    const safe = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch] as string));
    const periodPaid = studentPaidTotal(payment.student_id, payment.period_name);
    const ledger = feeLedger.find((r:any)=>r.student_id===payment.student_id && r.period_name===payment.period_name);
    const monthlyFee = Math.max(0, Number(ledger?.amount_due ?? 0) - Number(ledger?.amount_waived ?? 0));
    const balance = Math.max(0, monthlyFee - periodPaid);
    const amountText = money(Number(payment.amount || 0));
    const qrPayload = `KAAFI TECH RECEIPT|Receipt:${payment.receipt_number}|Student:${student?.student_code || payment.student_id}|Name:${student?.full_name || ""}|Date:${payment.payment_date}|Period:${payment.period_name}|Paid:${amountText}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=1&data=${encodeURIComponent(qrPayload)}`;
    const w = window.open("", "_blank", "width=760,height=850");
    if (!w) { setMessage("Browser-ku wuxuu xannibay daaqadda rasiidka. Oggolow pop-ups kadib isku day mar kale."); return; }
    const copy = (copyName: string) => `<article class="receipt"><div class="accent"></div><div class="receipt-inner">
      <div class="top"><div class="brandline"><div class="mark">K</div><div><div class="brand">KAAFI TECH</div><div class="muted">AND MEDIA CENTER</div><div class="muted">Rasiid rasmi ah oo lacag-bixin</div></div></div><div class="copytag">${copyName}</div></div>
      <div class="heading"><div><h1>Rasiidka lacag-bixinta</h1><div class="muted">Caddayn rasmi ah oo lacag la helay</div></div><div class="receiptno">Rasiid No.<strong>${safe(payment.receipt_number)}</strong></div></div>
      <div class="grid"><div class="info"><div class="label">Magaca ardayga</div><div class="value">${safe(student?.full_name)}</div></div><div class="info"><div class="label">ID-ga ardayga</div><div class="value">${safe(student?.student_code || payment.student_id)}</div></div><div class="info"><div class="label">Taariikhda lacagta la bixiyey</div><div class="value">${safe(payment.payment_date)}</div></div><div class="info"><div class="label">Koorso / Muddada</div><div class="value">${safe(student?.course_name)}</div><div class="code">${safe(payment.period_name)}</div></div></div>
      <div class="amountbox"><div><span>LACAGTA LA BIXIYEY</span><div class="amount">${safe(amountText)}</div></div><div class="paidmark">✓ LACAG LA HELAY</div></div>
      <div class="bottomrow"><div class="paymentdetails"><div><b>Habka bixinta:</b> ${safe(payment.payment_method)}</div><div><b>Lacagta muddada:</b> ${safe(money(monthlyFee))}</div><div><b>Wadarta la bixiyey:</b> ${safe(money(periodPaid))}</div><div><b>Hadhaaga:</b> <strong class="balance">${safe(money(balance))}</strong></div>${payment.notes ? `<div><b>Faallo:</b> ${safe(payment.notes)}</div>` : ""}</div><div class="qr"><img src="${qrUrl}" alt="QR code rasiidka"/><span>QR xaqiijinta rasiidka</span></div></div>
      <div class="foot"><strong>Mahadsanid!</strong> · Kaafi Tech and Media Center · Rasiidkan waa caddayn lacag-bixin. Fadlan u kaydi diiwaankaaga.</div></div></article>`;
    w.document.write(`<!doctype html><html lang="so"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rasiid ${safe(payment.receipt_number)}</title><style>
      *{box-sizing:border-box}body{font:11px Arial,Helvetica,sans-serif;color:#142b4a;margin:0;padding:20px;background:#eef3f9}.receipt{width:100%;max-width:760px;margin:0 auto 16px;background:#fff;border:1px solid #dce5f0;border-radius:12px;overflow:hidden;break-inside:avoid}.accent{height:5px;background:linear-gradient(90deg,#f7931e 0 32%,#102b4b 32% 100%)}.receipt-inner{padding:17px 20px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:10px;border-bottom:1px solid #e6edf5}.brandline{display:flex;gap:9px;align-items:center}.mark{width:36px;height:36px;border-radius:9px;background:#f7931e;color:#102b4b;font-size:22px;font-weight:900;display:grid;place-items:center}.brand{font-size:15px;font-weight:900;letter-spacing:.02em}.muted{color:#64748b;margin-top:3px;font-size:9px}.copytag{border:1px solid #f7931e;color:#9a4d00;padding:6px 9px;border-radius:20px;font-size:9px;font-weight:800;white-space:nowrap}.heading{display:flex;justify-content:space-between;gap:12px;align-items:end;margin:12px 0 10px}.heading h1{font-size:17px;margin:0 0 3px}.receiptno{text-align:right;font-size:9px;color:#64748b}.receiptno strong{display:block;color:#142b4a;font-size:11px;margin-top:3px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:10px 0}.info{border:1px solid #e5ebf3;background:#f8fafd;padding:8px;border-radius:7px;min-width:0}.label{font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}.value{font-size:10px;font-weight:700;overflow-wrap:anywhere}.code{font-size:9px;color:#64748b;margin-top:3px}.amountbox{background:#102b4b;color:white;border-radius:9px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin:11px 0}.amountbox span{font-size:9px;color:#dbe7f5}.amount{font-size:22px;font-weight:900;margin-top:3px;color:#fff}.paidmark{border:1px solid rgba(255,255,255,.35);padding:6px 8px;border-radius:6px;font-size:9px;font-weight:800;white-space:nowrap}.bottomrow{display:flex;justify-content:space-between;align-items:center;gap:10px}.paymentdetails{font-size:9px;line-height:1.7;min-width:0}.balance{color:${balance>0?'#dc2626':'#087443'}}.qr{display:flex;flex-direction:column;align-items:center;flex-shrink:0;font-size:7px;color:#64748b;text-align:center}.qr img{width:68px;height:68px;object-fit:contain}.foot{margin-top:10px;padding:8px;background:#f5f8fc;border-radius:7px;text-align:center;color:#64748b;font-size:8px;line-height:1.4}.controls{display:flex;justify-content:center;gap:10px;margin:14px auto 0}.controls button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer}.print{background:#0875d1;color:#fff}.close{background:#fff;border:1px solid #dce5f0!important;color:#142b4a}@media print{@page{size:A5 landscape;margin:4mm}html,body{width:100%;height:140mm;margin:0;padding:0;background:#fff}body{display:flex;flex-direction:row;align-items:stretch;gap:0}.receipt{display:block;width:50%;height:140mm;max-width:none;flex:0 0 50%;margin:0;border:1px solid #cbd5e1;border-radius:0;box-shadow:none;overflow:hidden;break-inside:avoid}.receipt+.receipt{margin:0;border-left:1px dashed #64748b;border-top:1px solid #cbd5e1}.receipt-inner{padding:4mm 4mm}.top{gap:6px;padding-bottom:6px}.brandline{gap:5px}.mark{width:29px;height:29px;font-size:18px;border-radius:6px}.brand{font-size:11px}.muted{font-size:7.5px}.copytag{padding:4px 5px;font-size:7.5px}.heading{gap:5px;margin:7px 0 6px}.heading h1{font-size:13px}.receiptno{font-size:7.5px}.receiptno strong{font-size:9px}.grid{gap:4px;margin:6px 0}.info{padding:6px;border-radius:4px}.label{font-size:6.5px;margin-bottom:2px}.value{font-size:8.5px}.code{font-size:7.5px}.amountbox{padding:7px 8px;gap:5px;margin:6px 0;border-radius:5px}.amountbox span{font-size:7.5px}.amount{font-size:18px;margin-top:2px}.paidmark{padding:4px;font-size:7.5px}.bottomrow{gap:4px;align-items:center}.paymentdetails{font-size:7.5px;line-height:1.55}.qr{font-size:6.5px}.qr img{width:49px;height:49px}.foot{margin-top:7px;padding:6px;font-size:6.5px;line-height:1.3}.controls{display:none}.accent{print-color-adjust:exact;-webkit-print-color-adjust:exact}.amountbox,.copytag,.mark{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body>${copy("STUDENT COPY · NUQULKA ARDAYGA")}${copy("SCHOOL COPY · NUQULKA DUGSIGA")}<div class="controls"><button class="print" onclick="window.print()">Daabac labada nuqul (A5 Landscape · 2 × A6 Portrait)</button><button class="close" onclick="window.close()">Xir</button></div></body></html>`);
    w.document.close();
  }

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSessionReady(true);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!error) setSession(data.session);
      setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (session) {
      void loadStudents();
      void loadCourses();
      void loadClasses();
      void loadPayments();
      void loadCourseMaterials();
      // Staff list is loaded on demand when an Admin opens Staff & Users.
    } else {
      setStudents([]);
      setCourses([]);
      setConnected(false);
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      setLoginError("Supabase lama dejin. Hubi faylka .env.local.");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoginLoading(false);
    if (error) setLoginError("Login-ku wuu fashilmay. Hubi email-ka iyo password-ka.");
  }

  async function handleLogout() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage("Ka bixitaanku ma suurtagelin. Mar kale isku day.");
  }

  const filtered = students.filter(s => `${s.student_code} ${s.full_name} ${s.phone ?? ""} ${s.course_name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const active = students.filter(s=>s.status==="Active").length;
  const currentMonth = localMonth();
  const newThisMonth = students.filter(s=>s.registered_at?.slice(0,7)===currentMonth).length;
  const unpaid = feeLedger.filter((r:any)=>r.period_name===dashboardPeriod && Math.max(0,Number(r.amount_due||0)-Number(r.amount_waived||0)-studentPaidTotal(r.student_id,dashboardPeriod))>0).length;

  function beginEditStudent(student: Student) {
    setForm({
      full_name: student.full_name ?? "", sex: student.sex ?? "", phone: student.phone ?? "",
      whatsapp: student.whatsapp ?? "", guardian_name: student.guardian_name ?? "",
      guardian_phone: student.guardian_phone ?? "", neighborhood: student.neighborhood ?? "",
      education_level: student.education_level ?? "", course_id: (student as any).course_id ?? "",
      course_name: student.course_name ?? "", course_fee: String(student.course_fee ?? 0),
      learning_mode: student.learning_mode ?? "Full-time", shift: student.shift ?? "Subax",
      monthly_payment_status: student.monthly_payment_status ?? "Unpaid",
      book_issued: Boolean(student.book_issued), status: student.status ?? "Active"
    });
    setEditingStudentId(student.id);
    setShowForm(true);
    setPage("Register Student");
    setMessage("");
  }

  async function deleteStudent(student: Student) {
    if (!supabase) return;
    if (!window.confirm(`Ma hubtaa inaad tirtirayso ardayga ${student.full_name} (${student.student_code})? Tallaabadan lama soo celin karo.`)) return;
    setLoading(true); setMessage("");
    const { error } = await supabase.from("students").delete().eq("id", student.id);
    setLoading(false);
    if (error) { setMessage(`Ardayga lama tirtiri karin: ${error.message}`); return; }
    setMessage("Ardayga waa la tirtiray.");
    await loadStudents();
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { setMessage("Magaca ardayga waa qasab."); return; }
    if (!supabase) { setMessage("Marka hore ku dar Supabase URL iyo key gudaha .env.local, kadib dib u bilow server-ka."); return; }
    setLoading(true); setMessage("");
    const payload = {
      full_name: form.full_name.trim(), sex: form.sex || null, phone: form.phone || null,
      whatsapp: form.whatsapp || null, guardian_name: form.guardian_name || null,
      guardian_phone: form.guardian_phone || null, neighborhood: form.neighborhood || null,
      education_level: form.education_level || null, course_id: form.course_id || null,
      course_name: form.course_name || null, course_fee: Number(form.course_fee || 0),
      learning_mode: form.learning_mode, shift: form.shift,
      monthly_payment_status: form.monthly_payment_status, book_issued: form.book_issued,
      status: form.status
    };
    const result = editingStudentId
      ? await supabase.from("students").update(payload).eq("id", editingStudentId)
      : await supabase.from("students").insert({
          ...payload,
          // Supabase trigger generates the next KT-xxxxx code for a new student.
          student_code: null,
          registered_at: new Date().toISOString()
        });
    setLoading(false);
    if (result.error) { setMessage(`Ardayga lama ${editingStudentId ? "cusboonaysiin" : "kaydinin"}: ${result.error.message}`); return; }
    const wasEditing = Boolean(editingStudentId);
    setShowForm(false); setPage("Students"); setEditingStudentId(null);
    const firstCourse = courses.find(c => c.status === "Active");
    setForm({full_name:"",sex:"",phone:"",whatsapp:"",guardian_name:"",guardian_phone:"",neighborhood:"",education_level:"",course_id:firstCourse?.id ?? "",course_name:firstCourse?.name ?? "Office Programs",course_fee:String(firstCourse?.fee ?? 60),learning_mode:"Full-time",shift:"Subax",monthly_payment_status:"Unpaid",book_issued:false,status:"Active"});
    setMessage(wasEditing ? "Xogta ardayga waa la cusboonaysiiyey." : "Ardayga si guul leh ayaa loo diiwaangeliyey.");
    await loadStudents();
  }

  function resetCourseForm() {
    setCourseForm({course_code:"",name:"",description:"",fee:"0",duration_months:"2",class_capacity:"15",status:"Active"});
    setEditingCourseId(null);
    setCourseFormOpen(false);
  }

  function beginEditCourse(course: Course) {
    setCourseForm({course_code:course.course_code ?? "",name:course.name,description:course.description ?? "",fee:String(course.fee ?? 0),duration_months:String(course.duration_weeks ? Math.max(1, Math.round(course.duration_weeks / 4)) : 2),class_capacity:String(course.class_capacity ?? 15),status:course.status ?? "Active"});
    setEditingCourseId(course.id);
    setCourseFormOpen(true);
    setMessage("");
  }

  async function saveCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) { setMessage("Supabase lama dejin."); return; }
    if (!courseForm.name.trim()) { setMessage("Magaca koorsadu waa qasab."); return; }
    setCourseSaving(true); setMessage("");
    const wasEditing = Boolean(editingCourseId);
    const payload = {
      course_code: courseForm.course_code.trim() || `KT-C-${Date.now().toString().slice(-6)}`,
      name: courseForm.name.trim(),
      description: courseForm.description.trim() || null,
      fee: Number(courseForm.fee || 0),
      duration_weeks: Number(courseForm.duration_months || 0) ? Number(courseForm.duration_months) * 4 : null,
      class_capacity: Number(courseForm.class_capacity || 0) || null,
      status: courseForm.status,
      updated_at: new Date().toISOString()
    };
    const result = editingCourseId
      ? await supabase.from("courses").update(payload).eq("id", editingCourseId)
      : await supabase.from("courses").insert(payload);
    setCourseSaving(false);
    if (result.error) { setMessage(`Koorsada lama kaydin: ${result.error.message}`); return; }
    resetCourseForm();
    setMessage(wasEditing ? "Koorsada waa la cusboonaysiiyey." : "Koorsada si guul leh ayaa loo daray.");
    await loadCourses();
  }

  async function toggleCourseStatus(course: Course) {
    if (!supabase) return;
    const nextStatus = course.status === "Active" ? "Inactive" : "Active";
    const { error } = await supabase.from("courses").update({status:nextStatus,updated_at:new Date().toISOString()}).eq("id",course.id);
    if (error) { setMessage(`Xaaladda koorsada lama beddelin: ${error.message}`); return; }
    setMessage(nextStatus === "Active" ? "Koorsada waa la hawlgeliyey." : "Koorsada waa la joojiyey; xogteeda lama tirtirin.");
    await loadCourses();
  }


  function resetClassForm() {
    setClassForm({class_name:"",course_id:courses.find(c=>c.status==="Active")?.id ?? "",teacher_id:"",classroom:"",shift:"Subax",start_date:"",expected_end_date:"",status:"Active"});
    setEditingClassId(null); setClassFormOpen(false);
  }
  function beginEditClass(c: ClassRow) {
    setClassForm({class_name:c.class_name,course_id:c.course_id,teacher_id:c.teacher_id ?? "",classroom:c.classroom ?? "",shift:c.shift ?? "Subax",start_date:c.start_date ?? "",expected_end_date:c.expected_end_date ?? "",status:c.status ?? "Active"});
    setEditingClassId(c.id); setClassFormOpen(true); setMessage("");
  }
  const selectedCourse = courses.find(c => c.id === classForm.course_id);
  const classNameOptions = selectedCourse ? ["A", "B", "C", "D"].map(section => `${selectedCourse.course_code || selectedCourse.name} - ${section}`) : [];

  async function saveClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    if (!classForm.class_name.trim() || !classForm.course_id) { setMessage("Magaca fasalka iyo koorsadu waa qasab."); return; }
    const wasEditingClass = Boolean(editingClassId);
    setClassSaving(true); setMessage("");
    const payload = {class_name:classForm.class_name.trim(),course_id:classForm.course_id,teacher_id:classForm.teacher_id || null,classroom:classForm.classroom.trim() || null,shift:classForm.shift || null,start_date:classForm.start_date || null,expected_end_date:classForm.expected_end_date || null,status:classForm.status};
    const result = editingClassId
      ? await supabase.from("classes").update(payload).eq("id", editingClassId).select("id").maybeSingle()
      : await supabase.from("classes").insert(payload).select("id").maybeSingle();
    setClassSaving(false);
    if (result.error) { setMessage(`Fasalka lama kaydin: ${result.error.message}`); return; }
    if (!result.data?.id) { setMessage("Wax isbeddel ah lama kaydin. Hubi inaad Admin ku gashay iyo in Supabase RLS policy-ga classes uu oggol yahay UPDATE."); return; }
    resetClassForm(); setMessage(wasEditingClass ? "Fasalka waa la cusboonaysiiyey." : "Fasalka waa la abuuray."); await loadClasses();
  }
  async function toggleClassStatus(c: ClassRow) {
    if (!supabase) return;
    const next = c.status === "Active" ? "Inactive" : "Active";
    const {error} = await supabase.from("classes").update({status:next}).eq("id",c.id);
    if (error) { setMessage(`Xaaladda fasalka lama beddelin: ${error.message}`); return; }
    setMessage(next === "Active" ? "Fasalka waa la hawlgeliyey." : "Fasalka waa la joojiyey; xogta lama tirtirin."); await loadClasses();
  }
  async function saveSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase || !scheduleClassId) return;
    if (scheduleForm.end_time <= scheduleForm.start_time) { setMessage("Saacadda dhammaadku waa inay ka dambaysaa saacadda bilowga."); return; }
    const [sh,sm] = scheduleForm.start_time.split(":").map(Number); const [eh,em] = scheduleForm.end_time.split(":").map(Number);
    const duration = (eh*60+em)-(sh*60+sm);
    const {error} = await supabase.from("class_schedules").insert({class_id:scheduleClassId,weekday:Number(scheduleForm.weekday),start_time:scheduleForm.start_time,end_time:scheduleForm.end_time,duration_minutes:duration});
    if (error) { setMessage(`Jadwalka lama kaydin: ${error.message}`); return; }
    setMessage("Jadwalka casharka waa la kaydiyey."); setScheduleClassId(null); await loadClasses();
  }
  async function deleteSchedule(schedule: Schedule) {
    if (!supabase || !window.confirm("Ma hubtaa inaad tirtirayso jadwalkan casharka?")) return;
    const {error} = await supabase.from("class_schedules").delete().eq("id",schedule.id);
    if (error) { setMessage(`Jadwalka lama tirtiri karin: ${error.message}`); return; }
    setMessage("Jadwalka waa la tirtiray."); await loadClasses();
  }
  async function loadAttendanceRoster() {
    if (!supabase || !attendanceClassId || !attendanceDate) {
      setAttendanceRoster([]);
      return;
    }
    const selectedClass = classes.find(c => c.id === attendanceClassId);
    if (!selectedClass) { setAttendanceRoster([]); return; }
    setAttendanceLoading(true);
    setMessage("");
    const { data: studentData, error: studentError } = await supabase
      .from("students").select("*").eq("course_id", selectedClass.course_id).eq("status", "Active").order("full_name");
    if (studentError) {
      setAttendanceLoading(false);
      setAttendanceRoster([]);
      setMessage(`Ardayda fasalka lama soo qaadi karin: ${studentError.message}`);
      return;
    }
    const roster = (studentData ?? []) as Student[];
    if (!roster.length) {
      setAttendanceRoster([]);
      setAttendanceLoading(false);
      setMessage("Arday firfircoon oo koorsadan ku xiran lama helin. Hubi in ardaydu leeyihiin course_id sax ah.");
      return;
    }
    let existingQuery = supabase.from("attendance").select("student_id,status,notes")
      .eq("class_id", attendanceClassId).eq("attendance_date", attendanceDate);
    if (attendanceScheduleId) existingQuery = existingQuery.eq("schedule_id", attendanceScheduleId);
    const { data: existing, error: attendanceError } = await existingQuery;
    setAttendanceLoading(false);
    if (attendanceError) {
      setAttendanceRoster([]);
      setMessage(`Xaadirintii hore lama soo qaadi karin: ${attendanceError.message}. Hubi SQL migration-ka Attendance.`);
      return;
    }
    const byStudent = new Map((existing ?? []).map((r: any) => [r.student_id, r]));
    setAttendanceRoster(roster.map(student => {
      const old: any = byStudent.get(student.id);
      return { ...student, attendance_status: old?.status ?? "Present", attendance_note: old?.notes ?? "" };
    }));
  }

  async function saveAttendance() {
    if (!supabase || !attendanceClassId || !attendanceDate || !attendanceScheduleId) {
      setMessage("Dooro fasalka, taariikhda iyo jadwalka casharka ka hor kaydinta.");
      return;
    }
    if (!attendanceRoster.length) { setMessage("Liiska ardaydu waa madhan; wax la kaydiyo ma jiraan."); return; }
    setAttendanceSaving(true);
    setMessage("");
    const rows = attendanceRoster.map(student => ({
      class_id: attendanceClassId,
      schedule_id: attendanceScheduleId,
      student_id: student.id,
      attendance_date: attendanceDate,
      status: student.attendance_status,
      notes: student.attendance_note.trim() || null,
      recorded_by: session?.user.id ?? null
    }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "class_id,schedule_id,student_id,attendance_date" });
    setAttendanceSaving(false);
    if (error) { setMessage(`Xaadirinta lama kaydin: ${error.message}`); return; }
    setMessage(`Xaadirinta ${attendanceDate} waa la kaydiyey (${rows.length} arday).`);
  }

  async function loadAttendanceHistory() {
    if (!supabase) return;
    setAttendanceReportLoading(true); setMessage("");
    const { data, error } = await fetchAllRows("attendance", "attendance_date", false);
    setAttendanceReportLoading(false);
    if (error) { setMessage(`Warbixinta xaadirinta lama soo qaadi karin: ${error.message}`); return; }
    setAttendanceHistory(data ?? []);
  }

  function downloadReportCsv(filename: string, headers: string[], rows: (string|number)[][]) {
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"}));
    const a = document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  }

  function printSimpleReport(title: string, headers: string[], rows: (string|number)[][]) {
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) { setMessage("Daabacaadda waa la xannibay. Fadlan oggolow pop-up-ka browser-ka."); return; }
    const esc = (v: unknown) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
    const generated = new Date();
    const bodyRows = rows.length ? rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${Math.max(headers.length,1)}" class="empty">Ma jiraan diiwaanno ku jira shaandhaynta warbixintan.</td></tr>`;
    win.document.write(`<!doctype html><html lang="so"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Kaafi Tech</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:22px;color:#142b4a;font-size:11px}.brand-header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:4px solid #f7931e;padding:0 0 13px;margin-bottom:18px}.brand{font-size:19px;letter-spacing:.4px;font-weight:900;color:#102b4b}.brand-sub{font-size:10px;color:#64748b;margin-top:5px}.report-label{text-align:right;border:1px solid #dbe3ed;border-radius:8px;padding:9px 11px;line-height:1.6;color:#334155}.report-label b{color:#102b4b}.title{font-size:21px;margin:16px 0 6px;color:#102b4b}.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#64748b;margin-bottom:14px}.summary{display:flex;gap:10px;margin:12px 0 16px}.summary-card{flex:1;border:1px solid #dbe3ed;background:#f7f9fc;border-radius:8px;padding:10px}.summary-card span{display:block;color:#64748b;font-size:10px}.summary-card strong{display:block;font-size:17px;color:#102b4b;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:10px;table-layout:auto}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #dbe3ed;padding:7px 6px;text-align:left;overflow-wrap:anywhere;vertical-align:top}th{background:#102b4b;color:#fff;font-size:9px}tbody tr:nth-child(even){background:#f7f9fc}.empty{text-align:center;padding:18px;color:#64748b}.footer{border-top:2px solid #f7931e;margin-top:18px;padding-top:9px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:#64748b;font-size:9px}.footer b{color:#102b4b}@page{size:A4 landscape;margin:12mm}@media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}}@media screen and (max-width:700px){body{padding:12px}.brand{font-size:15px}.title{font-size:18px}.summary{flex-wrap:wrap}.summary-card{min-width:40%}table{font-size:9px}}
      </style></head><body><header class="brand-header"><div><div class="brand">${esc(ktProfile.shortName || "KAAFI TECH")}</div><div class="brand-sub">${esc(ktProfile.organizationName || "Kaafi Tech and Media Center")} · ${esc(ktProfile.tagline || "Student Management System")}</div><div class="brand-sub">${esc(ktProfile.phone)} ${esc(ktProfile.email)} ${esc(ktProfile.address)}</div></div><div class="report-label"><b>WARBIXIN RASMI AH</b><br/>La soo saaray: ${esc(generated.toLocaleString())}<br/>Diiwaanno: ${rows.length}</div></header><h1 class="title">${esc(title)}</h1><div class="meta"><span>Xogta waxaa laga soo saaray diiwaanka nidaamka.</span><span>Taariikhda: ${esc(generated.toLocaleDateString())}</span></div><div class="summary"><div class="summary-card"><span>Tirada diiwaannada</span><strong>${rows.length}</strong></div><div class="summary-card"><span>Tirada tiirarka</span><strong>${headers.length}</strong></div></div><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table><footer class="footer"><span><b>${esc(ktProfile.organizationName || "KAAFI TECH AND MEDIA CENTER")}</b> · Xog rasmi ah oo nidaamka laga soo saaray</span><span>Daabac ama dooro “Save as PDF” si aad PDF u kaydiso.</span></footer><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  const weekdayNames: Record<number,string> = {0:"Axad",1:"Isniin",2:"Talaado",3:"Arbaco",4:"Khamiis",5:"Jimce",6:"Sabti"};
  function courseName(id: string) { return courses.find(c=>c.id===id)?.name ?? "Koorso aan la helin"; }
  function teacherName(id: string | null) { return teachers.find(t=>t.id===id)?.full_name ?? (id ? "Macallin" : "Lama qoondeyn"); }

  const filteredCourses = courses.filter(c => `${c.course_code ?? ""} ${c.name} ${c.description ?? ""}`.toLowerCase().includes(courseSearch.toLowerCase()));

  async function printStudentProfile(student: Student) {
    const win = window.open("", "_blank", "width=1050,height=850");
    if (!win) { setMessage("Warbixinta lama furi karin. Fadlan oggolow pop-up-ka browser-ka."); return; }
    const esc = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch] as string));
    let attendance: any[] = [];
    if (supabase) {
      const { data } = await supabase.from("attendance").select("attendance_date,status,notes,class_id").eq("student_id", student.id).order("attendance_date", { ascending: false });
      attendance = data ?? [];
    }
    const studentPayments = payments.filter(p => p.student_id === student.id).sort((a,b) => b.payment_date.localeCompare(a.payment_date));
    const studentLedgers = feeLedger.filter((r:any) => r.student_id === student.id).sort((a:any,b:any) => String(b.period_name||"").localeCompare(String(a.period_name||"")));
    const course = student.course_name || courses.find(c => c.id === student.course_id)?.name || "—";
    const detailRows: [string, unknown][] = [
      ["Student ID", student.student_code], ["Magaca buuxa", student.full_name], ["Jinsiga", student.sex],
      ["Telefoon", student.phone], ["WhatsApp", student.whatsapp], ["Magaca masuulka", student.guardian_name],
      ["Telefoonka masuulka", student.guardian_phone], ["Xaafadda", student.neighborhood],
      ["Heerka waxbarashada", student.education_level], ["Koorsada", course], ["Kharashka koorsada", money(Number(student.course_fee||0))],
      ["Habka waxbarashada", student.learning_mode], ["Shift", student.shift], ["Xaaladda lacagta", student.monthly_payment_status],
      ["Buug la siiyey", student.book_issued ? "Haa" : "Maya"], ["Xaaladda ardayga", student.status],
      ["Taariikhda diiwaangelinta", student.registered_at?.slice(0,10)],
    ];
    const detailsHtml = detailRows.map(([label,value])=>`<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join("");
    const paymentHtml = studentPayments.length ? studentPayments.map(p=>`<tr><td>${esc(p.payment_date)}</td><td>${esc(p.receipt_number)}</td><td>${esc(p.period_name)}</td><td>${esc(p.payment_method)}</td><td>${esc(money(Number(p.amount||0)))}</td><td>${esc(p.notes||"—")}</td></tr>`).join("") : `<tr><td colspan="6" class="empty">Lacag-bixin la diiwaangeliyey lama helin.</td></tr>`;
    const ledgerHtml = studentLedgers.length ? studentLedgers.map((r:any)=>`<tr><td>${esc(r.period_name)}</td><td>${esc(money(Number(r.amount_due||0)))}</td><td>${esc(money(Number(r.amount_waived||0)))}</td><td>${esc(money(Number(r.amount_paid||0)))}</td><td>${esc(money(Math.max(0,Number(r.amount_due||0)-Number(r.amount_waived||0)-Number(r.amount_paid||0))))}</td><td>${esc(r.status||"—")}</td></tr>`).join("") : `<tr><td colspan="6" class="empty">Ledger lacag-bixin lama helin.</td></tr>`;
    const attendanceHtml = attendance.length ? attendance.map(r=>`<tr><td>${esc(r.attendance_date)}</td><td>${esc(classes.find(c=>c.id===r.class_id)?.class_name||"—")}</td><td>${esc(r.status === "Present" ? "Xaadir" : r.status === "Absent" ? "Maqan" : r.status === "Late" ? "Daahay" : r.status)}</td><td>${esc(r.notes||"—")}</td></tr>`).join("") : `<tr><td colspan="4" class="empty">Diiwaanka xaadirinta ardaygan lama helin.</td></tr>`;
    win.document.write(`<!doctype html><html lang="so"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Warbixinta ardayga ${esc(student.student_code)} | Kaafi Tech</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172b4d;margin:0;padding:24px;font-size:11px;background:#fff}.header{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:4px solid #f7931e;padding-bottom:14px}.brand{font-size:21px;font-weight:900;color:#102b4b}.sub{color:#64748b;margin-top:5px}.tag{border:1px solid #dbe3ed;border-radius:8px;padding:10px;line-height:1.6;text-align:right}.hero{margin:18px 0;padding:16px;border-radius:10px;background:#f5f8fc;border:1px solid #dbe3ed;display:flex;justify-content:space-between;align-items:center;gap:14px}.hero h1{font-size:22px;margin:0 0 5px}.code{font-size:12px;color:#64748b}.badge{background:#fff0e2;color:#a54c00;border-radius:20px;padding:7px 12px;font-weight:700}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.stat{border:1px solid #dbe3ed;border-radius:8px;padding:11px;background:#fff}.stat span{display:block;color:#64748b}.stat b{display:block;font-size:16px;margin-top:5px;color:#102b4b}h2{font-size:14px;margin:20px 0 8px;color:#102b4b}table{width:100%;border-collapse:collapse;margin-bottom:14px}th,td{border:1px solid #dbe3ed;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#102b4b;color:white;width:30%}thead th{width:auto}tbody tr:nth-child(even){background:#f7f9fc}.empty{text-align:center;color:#64748b;padding:12px}.footer{border-top:2px solid #f7931e;padding-top:9px;margin-top:20px;display:flex;justify-content:space-between;gap:10px;color:#64748b;font-size:9px}.actions{display:flex;gap:8px;margin:0 0 18px}.actions button{padding:9px 13px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#102b4b;font-weight:700;cursor:pointer}@page{size:A4 portrait;margin:12mm}@media print{body{padding:0}.no-print{display:none!important}tr{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media(max-width:650px){body{padding:12px}.header,.hero{align-items:flex-start;flex-direction:column}.stats{grid-template-columns:1fr}.tag{text-align:left}}
      </style></head><body><div class="actions no-print"><button onclick="window.print()">Daabac / Save as PDF</button><button onclick="window.close()">Xir</button></div><header class="header"><div><div class="brand">KAAFI TECH AND MEDIA CENTER</div><div class="sub">Student Management System · Warbixin arday oo gaar ah</div></div><div class="tag"><b>WARBIXIN RASMI AH</b><br/>La soo saaray: ${esc(new Date().toLocaleString())}<br/>Xogta: ${esc(student.student_code)}</div></header><section class="hero"><div><h1>${esc(student.full_name)}</h1><div class="code">Student ID: ${esc(student.student_code)} · Koorsada: ${esc(course)}</div></div><span class="badge">${esc(student.status||"—")}</span></section><div class="stats"><div class="stat"><span>Lacag-bixinno</span><b>${studentPayments.length}</b></div><div class="stat"><span>Wadarta la bixiyey</span><b>${esc(money(studentPayments.reduce((sum,p)=>sum+Number(p.amount||0),0)))}</b></div><div class="stat"><span>Diiwaannada xaadirinta</span><b>${attendance.length}</b></div></div><h2>1. Xogta gaarka ah ee ardayga</h2><table><tbody>${detailsHtml}</tbody></table><h2>2. Taariikhda lacag-bixinta</h2><table><thead><tr><th>Taariikh</th><th>Rasiid</th><th>Muddo</th><th>Habka</th><th>Lacag</th><th>Faallo</th></tr></thead><tbody>${paymentHtml}</tbody></table><h2>3. Ledger-ka kharashka</h2><table><thead><tr><th>Bisha</th><th>Laga rabo</th><th>Ka-dhaafis</th><th>La bixiyey</th><th>Hadhaaga</th><th>Xaalad</th></tr></thead><tbody>${ledgerHtml}</tbody></table><h2>4. Xaadirinta</h2><table><thead><tr><th>Taariikh</th><th>Fasal</th><th>Xaalad</th><th>Faallo</th></tr></thead><tbody>${attendanceHtml}</tbody></table><footer class="footer"><span><b>KAAFI TECH AND MEDIA CENTER</b> · Xogta ardayga si masuuliyad leh u ilaali.</span><span>Warbixintan waxaa laga soo saaray nidaamka.</span></footer></body></html>`);
    win.document.close();
  }

  async function exportStudentProfileCsv(student: Student) {
    let attendance: any[] = [];
    if (supabase) {
      const { data } = await supabase.from("attendance").select("attendance_date,status,notes,class_id").eq("student_id", student.id).order("attendance_date", { ascending: false });
      attendance = data ?? [];
    }
    const rows: (string|number)[][] = [
      ["Xogta ardayga", "Student ID", student.student_code], ["Xogta ardayga", "Magaca", student.full_name],
      ["Xogta ardayga", "Jinsiga", student.sex||""], ["Xogta ardayga", "Telefoon", student.phone||""],
      ["Xogta ardayga", "WhatsApp", student.whatsapp||""], ["Xogta ardayga", "Magaca masuulka", student.guardian_name||""],
      ["Xogta ardayga", "Telefoonka masuulka", student.guardian_phone||""], ["Xogta ardayga", "Xaafadda", student.neighborhood||""],
      ["Xogta ardayga", "Heerka waxbarashada", student.education_level||""], ["Xogta ardayga", "Koorsada", student.course_name||courses.find(c=>c.id===student.course_id)?.name||""],
      ["Xogta ardayga", "Kharashka koorsada", Number(student.course_fee||0)], ["Xogta ardayga", "Habka waxbarashada", student.learning_mode||""],
      ["Xogta ardayga", "Shift", student.shift||""], ["Xogta ardayga", "Xaaladda lacagta", student.monthly_payment_status||""],
      ["Xogta ardayga", "Buug la siiyey", student.book_issued ? "Haa" : "Maya"], ["Xogta ardayga", "Xaaladda", student.status],
      ["Xogta ardayga", "Taariikhda diiwaangelinta", student.registered_at||""],
      ...payments.filter(p=>p.student_id===student.id).map(p=>["Lacag-bixin",p.payment_date,p.receipt_number,p.period_name,p.payment_method,p.amount,p.notes||""]),
      ...feeLedger.filter((r:any)=>r.student_id===student.id).map((r:any)=>["Ledger",r.period_name,Number(r.amount_due||0),Number(r.amount_waived||0),Number(r.amount_paid||0),Math.max(0,Number(r.amount_due||0)-Number(r.amount_waived||0)-Number(r.amount_paid||0)),r.status||""]),
      ...attendance.map(r=>["Xaadirin",r.attendance_date,classes.find(c=>c.id===r.class_id)?.class_name||"",r.status,r.notes||""]),
    ];
    downloadReportCsv(`Kaafi_${student.student_code}_Xogta_Ardayga.csv`,["Qaybta","Faahfaahin","Qiime 1","Qiime 2","Qiime 3","Qiime 4","Qiime 5"],rows);
  }

  function printAllStudents(orientation: "portrait" | "landscape" = "landscape") {
    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) { setMessage("Daabacaadda waa la xannibay. Fadlan oggolow pop-up-ka browser-ka."); return; }
    const esc = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch] as string));
    const allStudents = [...students].sort((a,b) => String(a.full_name||"").localeCompare(String(b.full_name||"")));
    const rows = allStudents.map((st, index) => {
      const course = st.course_name || courses.find(c => c.id === st.course_id)?.name || "—";
      return `<tr><td>${index + 1}</td><td>${esc(st.student_code)}</td><td>${esc(st.full_name)}</td><td>${esc(st.phone || "—")}</td><td>${esc(course)}</td><td>${esc(money(Number(st.course_fee || 0)))}</td><td>${esc(st.monthly_payment_status || "—")}</td><td>${esc(st.status || "—")}</td><td>${esc(String(st.registered_at || "").slice(0,10) || "—")}</td></tr>`;
    }).join("");
    const orientationLabel = orientation === "landscape" ? "A4 Landscape · Jiif" : "A4 Portrait · Taagan";
    win.document.write(`<!doctype html><html lang="so"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Liiska Dhammaan Ardayda | Kaafi Tech</title><style>
      *{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#102b4b;background:#fff}body{padding:10mm;font-size:10px}.brand-header{text-align:center;border-bottom:4px solid #f7931e;padding:0 0 10px;margin-bottom:14px}.brand-mark{display:inline-grid;place-items:center;width:30px;height:30px;background:#f7931e;color:#102b4b;border-radius:8px;font-size:19px;font-weight:900;margin-bottom:5px}.brand{font-size:18px;font-weight:900;letter-spacing:.5px}.subtitle{font-size:9px;color:#64748b;margin-top:3px}.title{font-size:17px;margin:12px 0 5px;text-align:center}.meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:#64748b;font-size:9px;margin:8px 0 12px}.summary{display:flex;gap:8px;margin:10px 0}.summary div{flex:1;border:1px solid #dbe3ed;border-radius:5px;padding:7px;background:#f7f9fc}.summary b{display:block;font-size:13px;margin-top:3px}.summary span{color:#64748b;font-size:8px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5px}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #dbe3ed;padding:5px 4px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#102b4b;color:#fff;font-size:8px}tbody tr:nth-child(even){background:#f7f9fc}.footer{margin-top:12px;padding-top:7px;border-top:2px solid #f7931e;display:flex;justify-content:space-between;gap:8px;color:#64748b;font-size:8px}.controls{display:flex;justify-content:center;gap:8px;margin:14px auto}.controls button{border:0;border-radius:6px;background:#102b4b;color:#fff;padding:9px 14px;font-weight:700;cursor:pointer}.controls .secondary{background:#fff;color:#102b4b;border:1px solid #dbe3ed}@page{size:A4 ${orientation};margin:8mm}@media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.controls{display:none}.brand-header,th{print-color-adjust:exact;-webkit-print-color-adjust:exact}table{font-size:8px}th,td{padding:4px 3px}}
      </style></head><body><div class="controls"><button onclick="window.print()">Daabac / Save as PDF</button><button class="secondary" onclick="window.close()">Xir</button></div><header class="brand-header"><div class="brand-mark">K</div><div class="brand">${esc(ktProfile.shortName || "KAAFI TECH")}</div><div class="subtitle">${esc(ktProfile.organizationName || "Kaafi Tech and Media Center")} · Student Management System</div></header><h1 class="title">Liiska Dhammaan Ardayda</h1><div class="meta"><span>Qaabka: ${orientationLabel}</span><span>Taariikhda: ${esc(new Date().toLocaleDateString())}</span><span>Wadarta ardayda: ${allStudents.length}</span></div><div class="summary"><div><span>Wadarta ardayda</span><b>${allStudents.length}</b></div><div><span>Arday firfircoon</span><b>${allStudents.filter(st=>String(st.status||"").toLowerCase()==="active").length}</b></div><div><span>Koorsado kala duwan</span><b>${new Set(allStudents.map(st=>st.course_id).filter(Boolean)).size}</b></div></div><table><thead><tr><th style="width:4%">#</th><th style="width:10%">Student ID</th><th style="width:19%">Magaca</th><th style="width:11%">Telefoon</th><th style="width:18%">Koorsada</th><th style="width:9%">Fee</th><th style="width:11%">Xaaladda lacagta</th><th style="width:8%">Status</th><th style="width:10%">Diiwaangelin</th></tr></thead><tbody>${rows || `<tr><td colspan="9" style="text-align:center;padding:18px">Arday lama helin.</td></tr>`}</tbody></table><footer class="footer"><span><b>KAAFI TECH AND MEDIA CENTER</b> · Warbixin rasmi ah</span><span>La soo saaray: ${esc(new Date().toLocaleString())}</span></footer><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    win.document.close();
  }

  function exportCsv() {
    const cols: (keyof Student)[] = ["student_code","registered_at","full_name","sex","phone","whatsapp","guardian_name","guardian_phone","neighborhood","education_level","course_name","course_fee","learning_mode","shift","monthly_payment_status","book_issued","status"];
    const csv = [cols.join(","), ...filtered.map(s=>cols.map(c=>`"${String(s[c] ?? "").replaceAll('"','""')}"`).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"}));
    const a = document.createElement("a"); a.href=url; a.download="kaafi-students.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const titles: Record<string,string> = {"Dashboard":"Dashboard","Students":"Ardayda","Register Student":"Diiwaangelinta Ardayga","Courses":"Koorsooyinka","Classes & Timetable":"Fasallada & Jadwalka","Attendance":"Xaadirinta","Fees & Payments":"Lacagaha & Bixinta","Student Reports":"Warbixinnada Ardayda","Attendance Reports":"Warbixinta Xaadirinta","Books Management":"Maamulka Buugaagta","Staff & Users":"Shaqaalaha & Isticmaalayaasha","Settings":"Dejinta","KT Profile":"KT Profile"};
  const registrationMonths = Array.from({length:10},(_,i)=>{
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-(9-i));
    const key = localMonth(d);
    const label = d.toLocaleDateString("en-US",{month:"short"});
    const count = students.filter(s=>s.registered_at?.slice(0,7)===key).length;
    return {key,label,count};
  });
  const registrationMax = Math.max(1,...registrationMonths.map(m=>m.count));
  const metricCards = [
    {label:"Dhammaan ardayda",value:students.length,icon:Users,note:"Diiwaanka hadda jira"},
    {label:"Ardayda firfircoon",value:active,icon:GraduationCap,note:"Status: Active"},
    {label:"Diiwaangelin bishan",value:newThisMonth,icon:Activity,note:"Bisha hadda"},
    {label:"Aan bixin · "+dashboardPeriod,value:unpaid,icon:CircleDollarSign,note:"Ku salaysan ledger-ka bisha la doortay"},
  ];

  const filteredCourseMaterials = courseMaterials.filter((item:any) => (materialsCourseFilter === "all" || item.course_id === materialsCourseFilter) && `${item.title??""} ${item.description??""} ${item.content??""} ${item.material_type??""}`.toLowerCase().includes(materialsSearch.toLowerCase()));
  const studentReportRows = students.filter(st => (studentReportStatus === "all" || st.status === studentReportStatus) && `${st.student_code} ${st.full_name} ${st.phone||""}`.toLowerCase().includes(studentReportSearch.toLowerCase()));
  const attendanceReportRows = attendanceHistory.filter((r:any) => (attendanceReportClass === "all" || r.class_id === attendanceReportClass) && (attendanceReportStatus === "all" || r.status === attendanceReportStatus) && (!attendanceReportFrom || r.attendance_date >= attendanceReportFrom) && (!attendanceReportTo || r.attendance_date <= attendanceReportTo)).map((r:any)=>({...r,student:students.find(st=>st.id===r.student_id)}));
  const attendanceSummaryRows = students.map(student => { const rows=attendanceReportRows.filter((r:any)=>r.student_id===student.id); const present=rows.filter((r:any)=>r.status==="Present").length; const late=rows.filter((r:any)=>r.status==="Late").length; const absent=rows.filter((r:any)=>r.status==="Absent").length; const total=rows.length; return {student,present,late,absent,total,percent:total?Math.round(((present+late)/total)*100):0}; }).filter(r=>r.total>0);

  if (!sessionReady) {
    return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f3f6fb",fontFamily:"Arial, sans-serif"}}><p>Kaafi Tech — Waa la furayaa...</p></main>;
  }

  if (!session) {
    return (
      <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:20,boxSizing:"border-box",background:"#f3f6fb",fontFamily:"Arial, sans-serif"}}>
        <form onSubmit={handleLogin} style={{width:"100%",maxWidth:390,boxSizing:"border-box",background:"#fff",padding:30,borderRadius:16,boxShadow:"0 8px 30px rgba(0,0,0,0.08)"}}>
          <h1 style={{color:"#142b4a",marginBottom:6}}>KAAFI TECH</h1>
          <p style={{color:"#64748b",marginBottom:24}}>Student Management System</p>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Geli email-kaaga" autoComplete="username" required style={{display:"block",width:"100%",boxSizing:"border-box",padding:12,marginTop:8,marginBottom:18,border:"1px solid #cbd5e1",borderRadius:8}} />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Geli password-ka" autoComplete="current-password" required style={{display:"block",width:"100%",boxSizing:"border-box",padding:12,marginTop:8,marginBottom:18,border:"1px solid #cbd5e1",borderRadius:8}} />
          {loginError && <p role="alert" style={{color:"#dc2626"}}>{loginError}</p>}
          <button type="submit" disabled={loginLoading} style={{width:"100%",padding:13,border:0,borderRadius:8,background:"#f28c28",color:"#fff",fontWeight:"bold",cursor:loginLoading?"wait":"pointer"}}>{loginLoading?"Waa la gelinayaa...":"Login"}</button>
        </form>
      </main>
    );
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">K</div><div><div className="brand-name">KAAFI TECH</div><div className="brand-sub">AND MEDIA CENTER</div></div></div>
      <div className="nav">{nav.map(([label,Icon])=><button key={label} className={page===label?"active":""} onClick={()=>{setPage(label);setShowForm(label==="Register Student");}}><Icon size={17}/><span>{label}</span></button>)}</div>
      <div className="side-note"><strong>Kaafi Student System</strong><br/>Nidaam maamul arday oo hal meel ku xiran.<br/><br/><span style={{color:connected?"#9ee6b1":"#f7c58a"}}>● {connected?"Supabase waa la helay":"Demo / Supabase lama dejin"}</span></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><h1>{titles[page] ?? page}</h1><p>Kaafi Tech and Media Center · Maamulka ardayda</p></div><div className="top-actions"><button className="btn" onClick={()=>void (page === "Dashboard" ? refreshDashboardData() : Promise.all([loadStudents(),loadPayments()]))} disabled={dashboardRefreshing || paymentLoading || loading}><Activity size={15}/> {dashboardRefreshing || paymentLoading || loading ? "Waa la cusboonaysiinayaa..." : "Cusboonaysii"}</button><button className="btn" onClick={()=>void handleLogout()}>Ka bax</button><button
        type="button"
        className="avatar"
        onClick={() => { setPage("KT Profile"); setShowForm(false); setMessage(""); setKtProfileSaved(false); }}
        title="Fur KT Profile"
        aria-label="Fur KT Profile"
        style={{ cursor: "pointer", border: "none", font: "inherit" }}
      >KT</button></div></header>
      <div className="content">
        {!connected && <div className="notice info"><strong>Dejinta koowaad:</strong> App-kan wuxuu u baahan yahay Supabase. Raac README-ga ku jira mashruuca, ku dar `.env.local`, kadibna geli SQL migration-ka. Ma jiro xog demo ah oo lagu qariyey xogta production-ka.</div>}
        {message && <div className="notice">{message}</div>}
        {page==="Dashboard" && <>
          <style>{`
            .dashboard-finance{margin:18px 0 24px;padding:18px;border:1px solid #dce5f0;border-radius:20px;background:linear-gradient(145deg,#ffffff 0%,#f8faff 100%);box-shadow:0 8px 24px rgba(16,43,75,.045);position:relative;overflow:hidden}
            .dashboard-finance:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#f7931e}
            .dashboard-finance-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 15px;padding-left:4px}
            .dashboard-finance-title{display:flex;align-items:center;gap:11px}
            .dashboard-finance-icon{width:42px;height:42px;border-radius:13px;background:#fff0df;color:#b85b00;display:grid;place-items:center;flex:0 0 auto}
            .dashboard-finance-title h3{font-size:17px;line-height:1.25;margin:0;color:#102b4b;font-weight:850;letter-spacing:-.02em}
            .dashboard-finance-title p{font-size:12px;color:#64748b;margin:5px 0 0;line-height:1.45}
            .dashboard-finance-period{font-size:11px;font-weight:800;color:#102b4b;background:#eef3fa;border:1px solid #dce5f0;padding:8px 11px;border-radius:999px;white-space:nowrap}
            .dashboard-finance .metrics{gap:13px}
            .dashboard-finance .metric{position:relative;overflow:hidden;border:1px solid #e1e8f1;border-radius:15px;padding:17px;background:#fff;box-shadow:0 3px 12px rgba(16,43,75,.035);transition:transform .18s ease,box-shadow .18s ease}
            .dashboard-finance .metric:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(16,43,75,.08)}
            .dashboard-finance .metric:before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:#f7931e}
            .dashboard-finance .finance-waived:before{background:#64748b}
            .dashboard-finance .finance-collected:before{background:#0c8a5a}
            .dashboard-finance .finance-outstanding:before{background:#dc4545}
            .dashboard-finance .metric-top{gap:10px;align-items:flex-start;color:#536780;font-size:12px;font-weight:650;line-height:1.4}
            .dashboard-finance .metric-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:#fff1e2;color:#c76500;flex:0 0 auto}
            .dashboard-finance .finance-waived .metric-icon{background:#eef2f7;color:#586a80}
            .dashboard-finance .finance-collected .metric-icon{background:#e5f8ee;color:#087443}
            .dashboard-finance .finance-outstanding .metric-icon{background:#fff0ef;color:#c43131}
            .dashboard-finance .metric-value{font-size:clamp(21px,2vw,29px);line-height:1.2;margin:14px 0 8px;font-weight:850;letter-spacing:-.035em;color:#102b4b;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
            .dashboard-finance .metric-note{font-size:11px;line-height:1.45;color:#7b8ba1;min-height:30px}
            .dashboard-finance-debt{margin-top:14px;border:1px solid #e1e8f1;border-radius:15px;background:#fff;overflow:hidden}
            .dashboard-finance-debt .panel-head{padding:16px 18px;border-bottom:1px solid #edf1f6}
            .dashboard-finance-debt .panel-head h3{font-size:14px;font-weight:800}
            .dashboard-finance-debt .fees-empty{padding:20px;text-align:left;background:#fbfcfe}
            .dashboard-finance-debt .fees-table th{background:#f6f8fc}
            .dashboard-finance-debt-total{display:flex;align-items:center;gap:8px;border-radius:12px;background:#f0f8f3;color:#087443;padding:9px 12px;font-size:17px;font-weight:850;font-variant-numeric:tabular-nums;white-space:nowrap}
            .dashboard-operational-metrics{margin-top:22px}
            .dashboard-operational-title{font-size:14px;color:#102b4b;font-weight:800;margin:0 0 12px;display:flex;align-items:center;gap:8px}
            @media(max-width:700px){.dashboard-finance{padding:14px 12px;margin:14px 0 20px;border-radius:16px}.dashboard-finance-head{align-items:flex-start}.dashboard-finance-title h3{font-size:15px}.dashboard-finance .metric{padding:13px}.dashboard-finance .metric-value{font-size:20px;margin:12px 0 6px}.dashboard-finance .metric-note{font-size:10px}.dashboard-finance-debt .panel-head{padding:13px;align-items:flex-start}}
          `}</style>
          <div className="welcome"><div><h2>Ku soo dhowow, Maamulaha 👋</h2><p>Halkan ka eeg xaaladda guud ee xaruntaada iyo lacagaha bil kasta.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><label style={{fontSize:12,fontWeight:700,color:"#64748b"}}>Bisha <input type="month" value={dashboardPeriod} onChange={e=>setDashboardPeriod(e.target.value)} style={{padding:"10px 12px",border:"1px solid #dbe4f0",borderRadius:9,background:"#fff",color:"#142b4a"}} /></label><button className="btn btn-primary" onClick={()=>{setPage("Register Student");setShowForm(true);}}><Plus size={16}/> Diiwaangeli arday</button></div></div>
          {(() => {
            const monthLedger = feeLedger.filter((r:any)=>r.period_name===dashboardPeriod);
            const charged = monthLedger.reduce((n:number,r:any)=>n+Number(r.amount_due||0),0);
            const waived = monthLedger.reduce((n:number,r:any)=>n+Number(r.amount_waived||0),0);
            const collected = monthLedger.reduce((n:number,r:any)=>n+studentPaidTotal(r.student_id,dashboardPeriod),0);
            const outstanding = monthLedger.reduce((n:number,r:any)=>n+Math.max(0,Number(r.amount_due||0)-Number(r.amount_waived||0)-studentPaidTotal(r.student_id,dashboardPeriod)),0);
            const priorLedger = feeLedger.filter((r:any)=>String(r.period_name)<dashboardPeriod);
            const priorRows = priorLedger.map((r:any)=>({ledger:r,student:students.find(x=>x.id===r.student_id),paid:studentPaidTotal(r.student_id,r.period_name),due:Math.max(0,Number(r.amount_due||0)-Number(r.amount_waived||0)-studentPaidTotal(r.student_id,r.period_name))})).filter((r:any)=>r.due>0).sort((a:any,b:any)=>String(b.ledger.period_name).localeCompare(String(a.ledger.period_name)));
            const priorOutstanding = priorRows.reduce((n:number,r:any)=>n+r.due,0);
            return <div className="dashboard-finance">
              <div className="dashboard-finance-head">
                <div className="dashboard-finance-title"><span className="dashboard-finance-icon"><CircleDollarSign size={21}/></span><div><h3>Maamulka Maaliyadda</h3><p>Koobanaha lacagaha bisha, ka-dhaafista iyo hadhaaga ardayda.</p></div></div>
                <span className="dashboard-finance-period">Muddada: {dashboardPeriod}</span>
              </div>
              <div className="metrics" style={{gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))"}}>
                <div className="metric finance-charged"><div className="metric-top"><span>Lacagta la rabay</span><span className="metric-icon"><CircleDollarSign size={18}/></span></div><div className="metric-value">{money(charged)}</div><div className="metric-note">{monthLedger.length ? `${monthLedger.length} diiwaan ledger` : "Ledger-ka bisha lama abuurin"}</div></div>
                <div className="metric finance-waived"><div className="metric-top"><span>Ka-dhaafis</span><span className="metric-icon"><CircleDollarSign size={18}/></span></div><div className="metric-value">{money(waived)}</div><div className="metric-note">Ka-dhaafista ku jirta ledger-ka</div></div>
                <div className="metric finance-collected"><div className="metric-top"><span>La bixiyey</span><span className="metric-icon"><CircleDollarSign size={18}/></span></div><div className="metric-value" style={{color:"#087443"}}>{money(collected)}</div><div className="metric-note">Lacagta saafiga ah ee la helay</div></div>
                <div className="metric finance-outstanding"><div className="metric-top"><span>Hadhaaga bisha</span><span className="metric-icon"><CircleDollarSign size={18}/></span></div><div className="metric-value" style={{color:outstanding>0?"#c43131":"#087443"}}>{money(outstanding)}</div><div className="metric-note">Laga rabo − ka-dhaafis − lacagta saafiga ah</div></div>
              </div>
              <section className="dashboard-finance-debt">
                <div className="panel-head"><div><h3>Daynta bilihii hore ee weli taagan</h3><div className="panel-sub">Dhammaan bilihii ka horreeyey {dashboardPeriod}; lacag-bixinnada iyo lacag-celinnada la fuliyey waa la tixgeliyey.</div></div><div className="dashboard-finance-debt-total">{money(priorOutstanding)}</div></div>
                {priorRows.length===0 ? <div className="fees-empty">Ma jiro hadhaag dayn hore oo ku jira ledger-ka la soo qaaday.</div> : <div style={{padding:"0 18px 16px",overflowX:"auto"}}><table className="fees-table"><thead><tr><th>Bisha</th><th>Arday</th><th>Laga rabay</th><th>Ka-dhaafis</th><th>La bixiyey</th><th>Hadhaaga taagan</th></tr></thead><tbody>{priorRows.map((r:any)=><tr key={r.ledger.id}><td>{r.ledger.period_name}</td><td>{r.student?.full_name??"Arday"}<small style={{display:"block",color:"#64748b"}}>{r.student?.student_code??r.ledger.student_id}</small></td><td>{money(Number(r.ledger.amount_due||0))}</td><td>{money(Number(r.ledger.amount_waived||0))}</td><td>{money(r.paid)}</td><td style={{color:r.due>0?"#dc2626":"#087443",fontWeight:800}}>{money(r.due)}</td></tr>)}</tbody></table></div>}
              </section>
            </div>;
          })()}
          <div className="dashboard-operational-metrics"><h3 className="dashboard-operational-title"><Users size={17}/> Xaaladda guud ee ardayda iyo xarunta</h3><div className="metrics">{metricCards.map(m=><div className="metric" key={m.label}><div className="metric-top"><span>{m.label}</span><span className="metric-icon"><m.icon size={18}/></span></div><div className="metric-value">{m.value}</div><div className="metric-note">{m.note}</div></div>)}</div></div>
          <div className="panels">
            <section className="panel"><div className="panel-head"><div><h3>Diiwaanka ardayda</h3><div className="panel-sub">Ardayda ugu dambaysay ee la diiwaangeliyey</div></div><button className="btn" onClick={()=>setPage("Students")}>Dhammaan <ChevronDown size={14}/></button></div>
              <div className="bars">{registrationMonths.map(m=><div className="bar-wrap" key={m.key} title={`${m.key}: ${m.count} arday`}><div className={`bar ${m.key===currentMonth?"current":""}`} style={{height:`${Math.max(m.count ? 8 : 2,(m.count/registrationMax)*100)}%`}}/><span>{m.label}</span></div>)}</div>
              <div className="panel-sub">Tirada ardayda dhab ahaan loo diiwaangeliyey 10-kii bilood ee ugu dambeeyey.</div>
            </section>
            <section className="panel"><div className="panel-head"><div><h3>Hawlaha degdegga ah</h3><div className="panel-sub">Waxyaabaha inta badan la isticmaalo</div></div></div><div className="activity">
              {[["Diiwaangeli arday","Samee student profile","Students"],["Diiwaangeli lacag","Ku dar payment iyo receipt","Fees & Payments"],["Qaado xaadirin","Dooro fasalka iyo taariikhda","Attendance"],["Jadwal fasal","Maamul waqtiga iyo macallinka","Classes & Timetable"]].map(([t,s,p])=><button className="activity-row" key={t} onClick={()=>setPage(p)} style={{textAlign:"left",background:"transparent",border:0}}><div><div className="activity-title">{t}</div><div className="activity-sub">{s}</div></div><Plus size={16}/></button>)}
            </div></section>
          </div>
          <section className="panel" style={{marginBottom:20,borderTop:"4px solid #f7931e"}}>
            <div className="panel-head"><div><h3><Printer size={17} style={{display:"inline",verticalAlign:"middle",marginRight:7}}/>Warbixinta guud ee ardayda</h3><div className="panel-sub">Dooro shuruudaha, kadib daabac warbixin A4 PDF ah. Warbixintu waxay ka shaqaynaysaa xogta ardayda hadda ku jirta nidaamka.</div></div><span className="pill">{students.filter(st => (dashboardReportCourse === "all" || st.course_id === dashboardReportCourse) && (dashboardReportStatus === "all" || st.status === dashboardReportStatus) && (dashboardReportSex === "all" || String(st.sex || "").toLowerCase() === dashboardReportSex.toLowerCase()) && (!dashboardReportFrom || String(st.registered_at || "").slice(0,10) >= dashboardReportFrom) && (!dashboardReportTo || String(st.registered_at || "").slice(0,10) <= dashboardReportTo)).length} arday</span></div>
            <div className="form-grid">
              <Field label="Koorsada"><select value={dashboardReportCourse} onChange={e=>setDashboardReportCourse(e.target.value)}><option value="all">Dhammaan koorsooyinka</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Xaaladda ardayga"><select value={dashboardReportStatus} onChange={e=>setDashboardReportStatus(e.target.value)}><option value="all">Dhammaan xaaladaha</option><option value="Active">Firfircoon</option><option value="Inactive">Aan firfircoonayn</option><option value="Completed">Dhammaystiray</option></select></Field>
              <Field label="Jinsiga"><select value={dashboardReportSex} onChange={e=>setDashboardReportSex(e.target.value)}><option value="all">Dhammaan</option><option value="Male">Lab</option><option value="Female">Dhedig</option></select></Field>
              <Field label="Diiwaangelin laga bilaabo"><input type="date" value={dashboardReportFrom} onChange={e=>setDashboardReportFrom(e.target.value)}/></Field>
              <Field label="Diiwaangelin ilaa"><input type="date" value={dashboardReportTo} onChange={e=>setDashboardReportTo(e.target.value)}/></Field>
            </div>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:12,marginBottom:14}}>
              <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13}}><input type="checkbox" checked={dashboardReportIncludePhone} onChange={e=>setDashboardReportIncludePhone(e.target.checked)}/> Ku dar telefoon</label>
              <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13}}><input type="checkbox" checked={dashboardReportIncludeFees} onChange={e=>setDashboardReportIncludeFees(e.target.checked)}/> Ku dar fee</label>
              <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13}}><input type="checkbox" checked={dashboardReportIncludeRegistration} onChange={e=>setDashboardReportIncludeRegistration(e.target.checked)}/> Ku dar taariikhda diiwaangelinta</label>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn btn-primary" onClick={printDashboardStudentReport}><Printer size={15}/> Daabac / Save as PDF</button><button className="btn" onClick={()=>{const reportStudents=students.filter(st => (dashboardReportCourse === "all" || st.course_id === dashboardReportCourse) && (dashboardReportStatus === "all" || st.status === dashboardReportStatus) && (dashboardReportSex === "all" || String(st.sex || "").toLowerCase() === dashboardReportSex.toLowerCase()) && (!dashboardReportFrom || String(st.registered_at || "").slice(0,10) >= dashboardReportFrom) && (!dashboardReportTo || String(st.registered_at || "").slice(0,10) <= dashboardReportTo));const headers=["Student ID","Magaca ardayga",...(dashboardReportIncludePhone?["Telefoon"]:[]),"Koorsada","Xaaladda",...(dashboardReportIncludeFees?["Fee"]:[]),...(dashboardReportIncludeRegistration?["Diiwaangelin"]:[])];const rows=reportStudents.map(st=>[st.student_code,st.full_name,...(dashboardReportIncludePhone?[st.phone||""]:[]),st.course_name||courses.find(c=>c.id===st.course_id)?.name||"",st.status,...(dashboardReportIncludeFees?[money(Number(st.course_fee||0))]:[]),...(dashboardReportIncludeRegistration?[String(st.registered_at||"").slice(0,10)]:[])]);downloadReportCsv("Kaafi_Warbixin_Guud_Ardayda.csv",headers,rows);}}><FileSpreadsheet size={15}/> Export CSV/Excel</button><button className="btn" onClick={()=>{setDashboardReportCourse("all");setDashboardReportStatus("all");setDashboardReportSex("all");setDashboardReportFrom("");setDashboardReportTo("");setDashboardReportIncludePhone(true);setDashboardReportIncludeFees(true);setDashboardReportIncludeRegistration(true);}}><X size={15}/> Nadiifi shuruudaha</button></div>
          </section>
          <section className="table-panel"><div className="table-head"><div><h3>Ardaydii ugu dambaysay</h3><div className="panel-sub">Liiska xogta la kaydiyey</div></div><button className="btn" onClick={()=>setPage("Students")}>Arag dhammaan</button></div><StudentTable students={filtered.slice(0,5)} onEdit={beginEditStudent} onDelete={deleteStudent} onReport={printStudentProfile} onExport={exportStudentProfileCsv}/></section>
        </>}
        {page==="Students" && <><div className="welcome"><div><h2>Diiwaanka ardayda</h2><p>Raadi, eeg oo soo saar liiska ardayda.</p></div><button className="btn btn-primary" onClick={()=>{setPage("Register Student");setShowForm(true);}}><Plus size={16}/> Arday cusub</button></div><section className="table-panel"><div className="table-head" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Raadi magac, ID ama tel..."/><div style={{display:"flex",gap:8,flexWrap:"wrap",marginLeft:"auto"}}><button className="btn" onClick={()=>printAllStudents("portrait")}><Printer size={15}/> Print All · A4 Portrait</button><button className="btn btn-primary" onClick={()=>printAllStudents("landscape")}><Printer size={15}/> Print All · A4 Landscape</button><button className="btn" onClick={exportCsv}><Download size={15}/> Export CSV/Excel</button></div></div><StudentTable students={filtered} onEdit={beginEditStudent} onDelete={deleteStudent} onReport={printStudentProfile} onExport={exportStudentProfileCsv}/></section></>}
        {(page==="Register Student" || showForm) && <section className="panel"><div className="panel-head"><div><h3>{editingStudentId ? "Wax ka beddel xogta ardayga" : "Foomka diiwaangelinta ardayga"}</h3><div className="panel-sub">Xogta waxaa lagu kaydinayaa Supabase marka la dejiyo.</div></div><button className="btn" onClick={()=>{setShowForm(false);setEditingStudentId(null);setPage("Students");}}><X size={15}/> Xir</button></div><form onSubmit={addStudent}>
          <div className="form-grid">
            <Field label="Magaca ardayga *"><input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Magaca oo buuxa"/></Field>
            <Field label="Jinsiga"><select value={form.sex} onChange={e=>setForm({...form,sex:e.target.value})}><option value="">Dooro</option><option>Male</option><option>Female</option></select></Field>
            <Field label="Telefoonka"><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+252..."/></Field>
            <Field label="WhatsApp"><input value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})}/></Field>
            <Field label="Magaca masuulka"><input value={form.guardian_name} onChange={e=>setForm({...form,guardian_name:e.target.value})}/></Field>
            <Field label="Telefoonka masuulka"><input value={form.guardian_phone} onChange={e=>setForm({...form,guardian_phone:e.target.value})}/></Field>
            <Field label="Xaafadda"><input value={form.neighborhood} onChange={e=>setForm({...form,neighborhood:e.target.value})}/></Field>
            <Field label="Heerka waxbarashada"><input value={form.education_level} onChange={e=>setForm({...form,education_level:e.target.value})}/></Field>
            <Field label="Koorso"><select required value={form.course_id} onChange={e=>{const c=courses.find(x=>x.id===e.target.value);setForm({...form,course_id:c?.id ?? "",course_name:c?.name ?? "",course_fee:c?String(c.fee ?? 0):"0"});}}>{courses.filter(c=>c.status==="Active").length ? courses.filter(c=>c.status==="Active").map(c=><option key={c.id} value={c.id}>{c.course_code ? `${c.course_code} — ` : ""}{c.name}</option>) : <option value="">Koorso firfircoon ma jiro — marka hore ku dar koorso</option>}</select></Field>
            <Field label="Wadarta lacagta koorsada ($)"><input type="number" min="0" step="0.01" value={form.course_fee} onChange={e=>setForm({...form,course_fee:e.target.value})}/></Field>
            <Field label="Habka waxbarashada"><select value={form.learning_mode} onChange={e=>setForm({...form,learning_mode:e.target.value})}><option>Full-time</option><option>Part-time</option></select></Field>
            <Field label="Xilliga"><select value={form.shift} onChange={e=>setForm({...form,shift:e.target.value})}><option>Subax</option><option>Galab</option><option>Habeen</option></select></Field>
            <Field label="Lacagta bishan"><select value={form.monthly_payment_status} onChange={e=>setForm({...form,monthly_payment_status:e.target.value})}><option>Unpaid</option><option>Partially Paid</option><option>Paid</option></select></Field>
            <Field label="Xaaladda"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Active</option><option>Completed</option><option>Suspended</option><option>Withdrawn</option></select></Field>
            <Field label="Buugga la siiyey"><select value={form.book_issued?"yes":"no"} onChange={e=>setForm({...form,book_issued:e.target.value==="yes"})}><option value="no">Maya</option><option value="yes">Haa</option></select></Field>
          </div><div className="form-actions"><button type="button" className="btn" onClick={()=>{setShowForm(false);setEditingStudentId(null);setPage("Students");}}>Jooji</button><button className="btn btn-primary" disabled={loading}><Check size={16}/>{loading?"Waa la kaydinayaa...":editingStudentId?"Cusboonaysii xogta":"Kaydi ardayga"}</button></div>
        </form></section>}
        {page==="Courses" && <>
          <div className="welcome"><div><h2>Maamulka koorsooyinka</h2><p>Koorsooyinka waxaa laga akhriyaa laguna kaydiyaa Supabase.</p></div><button className="btn btn-primary" onClick={()=>{setCourseForm({course_code:"",name:"",description:"",fee:"0",duration_months:"2",class_capacity:"15",status:"Active"});setEditingCourseId(null);setCourseFormOpen(true);setMessage("");}}><Plus size={16}/> Ku dar koorso</button></div>
          {courseFormOpen && <section className="panel"><div className="panel-head"><div><h3>{editingCourseId?"Wax ka beddel koorsada":"Koorso cusub"}</h3><div className="panel-sub">Geli xogta koorsada. Lama tirtirayo koorso hore marka la joojiyo.</div></div><button type="button" className="btn" onClick={resetCourseForm}><X size={15}/> Xir</button></div>
            <form onSubmit={saveCourse}><div className="form-grid">
              <Field label="Code-ka koorsada"><input value={courseForm.course_code} onChange={e=>setCourseForm({...courseForm,course_code:e.target.value})} placeholder="CV1, GD1, ama HN"/></Field>
              <Field label="Magaca koorsada *"><input required value={courseForm.name} onChange={e=>setCourseForm({...courseForm,name:e.target.value})} placeholder="Tusaale: Graphic Design"/></Field>
              <Field label="Kharashka ($)"><input type="number" min="0" step="0.01" required value={courseForm.fee} onChange={e=>setCourseForm({...courseForm,fee:e.target.value})}/></Field>
              <Field label="Muddada (bilood) "><input type="number" min="1" value={courseForm.duration_months} onChange={e=>setCourseForm({...courseForm,duration_months:e.target.value})}/></Field>
              <Field label="Awoodda fasalka (arday) "><input type="number" min="1" value={courseForm.class_capacity} onChange={e=>setCourseForm({...courseForm,class_capacity:e.target.value})}/></Field>
              <Field label="Xaaladda"><select value={courseForm.status} onChange={e=>setCourseForm({...courseForm,status:e.target.value})}><option value="Active">Active — Firfircoon</option><option value="Inactive">Inactive — Joojin</option></select></Field>
              <Field label="Faahfaahin"><input value={courseForm.description} onChange={e=>setCourseForm({...courseForm,description:e.target.value})} placeholder="Faahfaahin kooban"/></Field>
            </div><div className="form-actions"><button type="button" className="btn" onClick={resetCourseForm}>Jooji</button><button className="btn btn-primary" disabled={courseSaving}><Check size={16}/>{courseSaving?"Waa la kaydinayaa...":editingCourseId?"Kaydi isbeddelka":"Kaydi koorsada"}</button></div></form>
          </section>}
          <section className="table-panel"><div className="table-head"><input className="search" value={courseSearch} onChange={e=>setCourseSearch(e.target.value)} placeholder="Raadi koorso..."/><button className="btn" onClick={()=>void loadCourses()} disabled={courseLoading}><Activity size={15}/>{courseLoading?"Waa la soo qaadayaa...":"Cusboonaysii"}</button></div>
            {courseLoading && courses.length===0 ? <div className="empty">Koorsooyinka waa la soo qaadanayaa...</div> : filteredCourses.length===0 ? <div className="empty">Koorso lama helin. Guji “Ku dar koorso” si aad mid cusub u samayso.</div> : <div className="table-scroll"><table><thead><tr><th>Code</th><th>Magaca koorsada</th><th>Kharashka</th><th>Muddada</th><th>Awoodda fasalka</th><th>Xaaladda</th><th>Hawlgal</th></tr></thead><tbody>{filteredCourses.map(c=><tr key={c.id}><td>{c.course_code||"—"}</td><td><div className="student-name">{c.name}</div><div className="student-id">{c.description||""}</div></td><td>{money(Number(c.fee||0))}</td><td>{c.duration_weeks?`${Math.max(1, Math.round(c.duration_weeks / 4))} bilood`:"—"}</td><td>{c.class_capacity??"—"}</td><td><span className={`pill ${c.status==="Active"?"":"warn"}`}>{c.status}</span></td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn" onClick={()=>beginEditCourse(c)}>Wax ka beddel</button><button className="btn" onClick={()=>void toggleCourseStatus(c)}>{c.status==="Active"?"Jooji":"Hawl geli"}</button></div></td></tr>)}</tbody></table></div>}
          </section>
        </>}
        {page==="Classes & Timetable" && <>
          <div className="welcome"><div><h2>Maamulka fasallada</h2><p>Ku xiro fasallada koorsooyinka iyo macallimiinta, kuna samee jadwal casharro.</p></div><button className="btn btn-primary" onClick={()=>{resetClassForm();setClassFormOpen(true);setMessage("");}}><Plus size={16}/> Ku dar fasal</button></div>
          {classFormOpen && <section className="panel"><div className="panel-head"><div><h3>{editingClassId?"Wax ka beddel fasalka":"Fasal cusub"}</h3><div className="panel-sub">Xogta waxaa lagu kaydinayaa Supabase.</div></div><button type="button" className="btn" onClick={resetClassForm}><X size={15}/> Xir</button></div>
            <form onSubmit={saveClass}><div className="form-grid">
              <Field label="Koorso *"><select required value={classForm.course_id} onChange={e=>{const nextCourseId=e.target.value;setClassForm({...classForm,course_id:nextCourseId,class_name:nextCourseId===classForm.course_id?classForm.class_name:""});}}><option value="">Dooro koorso</option>{courses.filter(c=>c.status==="Active").map(c=><option key={c.id} value={c.id}>{c.course_code ? `${c.course_code} — ` : ""}{c.name}</option>)}</select></Field>
              <Field label="Magaca fasalka *"><select required value={classForm.class_name} disabled={!classForm.course_id} onChange={e=>setClassForm({...classForm,class_name:e.target.value})}><option value="">{classForm.course_id ? "Dooro qaybta fasalka (A–D)" : "Marka hore dooro koorso"}</option>{classForm.class_name && !classNameOptions.includes(classForm.class_name) && <option value={classForm.class_name}>{classForm.class_name}</option>}{classNameOptions.map(name=><option key={name} value={name}>{name}</option>)}</select><small>Magacyada fasalka waxaa laga abuuraa koorsada la doortay: A, B, C ama D.</small></Field>
              <Field label="Macallinka fasalka"><select value={classForm.teacher_id} onChange={e=>setClassForm({...classForm,teacher_id:e.target.value})}><option value="">Dooro macallin diiwaangashan</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select>{teachers.length===0 && <small style={{color:"#b45309"}}>Liiska macallimiintu waa madhan. Marka hore ka diiwaangeli macallinka Staff & Users, doorarkiisana ka dhig teacher, kadibna riix Cusboonaysii.</small>}</Field>
              <Field label="Qolka / Lab-ka"><select value={classForm.classroom} onChange={e=>setClassForm({...classForm,classroom:e.target.value})}><option value="">Dooro Lab</option><option value="Lab 1">Lab 1</option><option value="Lab 2">Lab 2</option></select></Field>
              <Field label="Xilliga"><select value={classForm.shift} onChange={e=>setClassForm({...classForm,shift:e.target.value})}><option>Subax</option><option>Galab</option><option>Habeen</option></select></Field>
              <Field label="Taariikhda bilowga"><input type="date" value={classForm.start_date} onChange={e=>setClassForm({...classForm,start_date:e.target.value})}/></Field>
              <Field label="Taariikhda dhammaadka la filayo"><input type="date" value={classForm.expected_end_date} onChange={e=>setClassForm({...classForm,expected_end_date:e.target.value})}/></Field>
              <Field label="Xaaladda"><select value={classForm.status} onChange={e=>setClassForm({...classForm,status:e.target.value})}><option>Active</option><option>Inactive</option><option>Completed</option></select></Field>
            </div><div className="form-actions"><button type="button" className="btn" onClick={resetClassForm}>Jooji</button><button className="btn btn-primary" disabled={classSaving}><Check size={16}/>{classSaving?"Waa la kaydinayaa...":editingClassId?"Cusboonaysii fasalka":"Kaydi fasalka"}</button></div></form>
          </section>}
          {scheduleClassId && <section className="panel"><div className="panel-head"><div><h3>Ku dar jadwal cashar</h3><div className="panel-sub">Fasal: {classes.find(c=>c.id===scheduleClassId)?.class_name}</div></div><button className="btn" onClick={()=>setScheduleClassId(null)}><X size={15}/> Xir</button></div><form onSubmit={saveSchedule}><div className="form-grid"><Field label="Maalinta"><select value={scheduleForm.weekday} onChange={e=>setScheduleForm({...scheduleForm,weekday:e.target.value})}>{Object.entries(weekdayNames).map(([n,label])=><option key={n} value={n}>{label}</option>)}</select></Field><Field label="Saacadda bilowga"><input required type="time" value={scheduleForm.start_time} onChange={e=>setScheduleForm({...scheduleForm,start_time:e.target.value})}/></Field><Field label="Saacadda dhammaadka"><input required type="time" value={scheduleForm.end_time} onChange={e=>setScheduleForm({...scheduleForm,end_time:e.target.value})}/></Field></div><div className="form-actions"><button className="btn btn-primary"><Check size={16}/> Kaydi jadwalka</button></div></form></section>}
          <section className="table-panel"><div className="table-head"><div><h3>Fasallada iyo jadwalkooda</h3><div className="panel-sub">{classes.length} fasal</div></div><button className="btn" onClick={()=>void loadClasses()} disabled={classLoading}><Activity size={15}/> {classLoading?"Cusboonaysiin...":"Cusboonaysii"}</button></div>
            {classLoading && classes.length===0 ? <div className="empty">Fasallada waa la soo qaadanayaa...</div> : classes.length===0 ? <div className="empty">Weli fasal lama abuurin. Guji “Ku dar fasal”.</div> : <div className="table-scroll"><table><thead><tr><th>Fasalka</th><th>Koorso</th><th>Macallin</th><th>Qolka</th><th>Xilliga</th><th>Taariikhaha</th><th>Xaaladda</th><th>Hawlgal</th></tr></thead><tbody>{classes.map(c=><tr key={c.id}><td><div className="student-name">{c.class_name}</div></td><td>{courseName(c.course_id)}</td><td>{teacherName(c.teacher_id)}</td><td>{c.classroom||"—"}</td><td>{c.shift||"—"}</td><td>{c.start_date||"—"} – {c.expected_end_date||"—"}</td><td><span className={`pill ${c.status==="Active"?"":"warn"}`}>{c.status}</span></td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn" onClick={()=>beginEditClass(c)}>Wax ka beddel</button><button className="btn" onClick={()=>{setScheduleClassId(c.id);setMessage("");}}>Jadwal</button><button className="btn" onClick={()=>void toggleClassStatus(c)}>{c.status==="Active"?"Jooji":"Hawl geli"}</button></div></td></tr>)}</tbody></table></div>}
          </section>
          <section className="table-panel"><div className="table-head"><div><h3>Jadwalka casharrada</h3><div className="panel-sub">Jadwallada fasallada oo dhan</div></div></div>{schedules.length===0?<div className="empty">Weli jadwal cashar lama diiwaangelin.</div>:<div className="table-scroll"><table><thead><tr><th>Fasalka</th><th>Maalinta</th><th>Bilowga</th><th>Dhammaadka</th><th>Muddada</th><th>Hawlgal</th></tr></thead><tbody>{schedules.map(sc=><tr key={sc.id}><td>{classes.find(c=>c.id===sc.class_id)?.class_name??"Fasal"}</td><td>{weekdayNames[sc.weekday]??sc.weekday}</td><td>{String(sc.start_time).slice(0,5)}</td><td>{String(sc.end_time).slice(0,5)}</td><td>{sc.duration_minutes??"—"} daqiiqo</td><td><button className="btn" onClick={()=>void deleteSchedule(sc)}>Tirtir jadwalka</button></td></tr>)}</tbody></table></div>}</section>
        </>}
        {page==="Attendance" && <>
          <div className="welcome"><div><h2>Xaadirinta ardayda</h2><p>Dooro fasal iyo cashar; xaadirinta waxaa lagu kaydinayaa Supabase.</p></div><button className="btn" onClick={()=>void loadAttendanceRoster()} disabled={attendanceLoading}><Activity size={15}/> Cusboonaysii liiska</button></div>
          <section className="panel"><div className="form-grid">
            <Field label="Fasalka *"><select value={attendanceClassId} onChange={e=>{setAttendanceClassId(e.target.value);setAttendanceScheduleId("");setAttendanceRoster([]);setMessage("");}}><option value="">Dooro fasal</option>{classes.filter(c=>c.status==="Active").map(c=><option key={c.id} value={c.id}>{c.class_name} — {courseName(c.course_id)}</option>)}</select></Field>
            <Field label="Taariikhda *"><input type="date" required value={attendanceDate} onChange={e=>{setAttendanceDate(e.target.value);setAttendanceRoster([]);}}/></Field>
            <Field label="Casharka / Jadwalka *"><select value={attendanceScheduleId} onChange={e=>{setAttendanceScheduleId(e.target.value);setAttendanceRoster([]);}} disabled={!attendanceClassId}><option value="">Dooro jadwal cashar</option>{schedules.filter(sc=>sc.class_id===attendanceClassId).map(sc=><option key={sc.id} value={sc.id}>{weekdayNames[sc.weekday]} · {String(sc.start_time).slice(0,5)}–{String(sc.end_time).slice(0,5)}</option>)}</select></Field>
          </div><div className="form-actions"><button type="button" className="btn btn-primary" onClick={()=>void loadAttendanceRoster()} disabled={attendanceLoading || !attendanceClassId || !attendanceScheduleId}>{attendanceLoading?"Waa la soo qaadanayaa...":"Soo bandhig ardayda"}</button></div></section>
          <section className="table-panel"><div className="table-head"><div><h3>Liiska xaadirinta</h3><div className="panel-sub">{attendanceRoster.length} arday · {attendanceDate}</div></div><button className="btn btn-primary" onClick={()=>void saveAttendance()} disabled={attendanceSaving || attendanceRoster.length===0}>{attendanceSaving?"Waa la kaydinayaa...":"Kaydi xaadirinta"}</button></div>
            {attendanceLoading?<div className="empty">Ardayda waa la soo qaadanayaa...</div>:attendanceRoster.length===0?<div className="empty">Dooro fasal, taariikh iyo jadwal cashar, kadib guji “Soo bandhig ardayda”.</div>:<div className="table-scroll"><table><thead><tr><th>ID</th><th>Magaca ardayga</th><th>Telefoon</th><th>Xaaladda</th><th>Faallo</th></tr></thead><tbody>{attendanceRoster.map(student=><tr key={student.id}><td>{student.student_code}</td><td><div className="student-name">{student.full_name}</div></td><td>{student.phone||"—"}</td><td><select aria-label={`Xaaladda ${student.full_name}`} value={student.attendance_status} onChange={e=>setAttendanceRoster(current=>current.map(r=>r.id===student.id?{...r,attendance_status:e.target.value}:r))}><option value="Present">Xaadir</option><option value="Absent">Maqan</option><option value="Late">Daahay</option></select></td><td><input aria-label={`Faallo ${student.full_name}`} value={student.attendance_note} onChange={e=>setAttendanceRoster(current=>current.map(r=>r.id===student.id?{...r,attendance_note:e.target.value}:r))} placeholder="Faallo (ikhtiyaari)"/></td></tr>)}</tbody></table></div>}
          </section>
        </>}
        {page==="Fees & Payments" && <>
          <style>{`
            .fees-page{display:flex;flex-direction:column;gap:18px;color:#142b4a}
            .fees-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
            .fees-toolbar h2{font-size:25px;margin:0 0 5px;font-weight:800;letter-spacing:-.025em}
            .fees-toolbar p{margin:0;color:#64748b;font-size:14px}
            .fees-toolbar-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
            .fees-select-period{padding:10px 12px;border:1px solid #dbe4ef;border-radius:10px;background:#fff;color:#142b4a;font-weight:600}
            .fees-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
            .payment-report-kpis{grid-template-columns:repeat(4,minmax(0,1fr));align-items:stretch}
            .payment-report-kpis .fees-kpi{padding:14px;min-width:0;display:flex;align-items:center;justify-content:center}
            .payment-report-kpis .fees-kpi>div{min-width:0;width:100%}
            .payment-report-kpis .fees-kpi span{display:block;font-size:12px;line-height:1.35;color:#64748b;overflow-wrap:anywhere}
            .payment-report-kpis .fees-kpi strong{display:block;font-size:clamp(14px,1.25vw,20px);line-height:1.25;margin-top:5px;white-space:normal;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
            .payment-report-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end;max-width:100%}
            .payment-report-actions select{min-width:0;max-width:100%;flex:1 1 125px}
            .payment-report-actions button{white-space:nowrap;flex:0 0 auto}
            .fees-kpi{background:#fff;border:1px solid #e5ebf3;border-radius:15px;padding:18px;display:flex;gap:13px;align-items:center;min-width:0;box-shadow:0 3px 12px rgba(20,43,74,.035)}
            .fees-kpi-icon{width:44px;height:44px;flex:0 0 44px;border-radius:12px;display:grid;place-items:center}
            .fees-kpi-label{font-size:12px;color:#64748b;font-weight:600;margin-bottom:6px}
            .fees-kpi-value{font-size:24px;font-weight:800;line-height:1.15;color:#102746;overflow-wrap:anywhere}
            .fees-kpi-note{font-size:11px;color:#7b8ba1;margin-top:5px}
            .fees-columns{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,1fr);gap:16px;align-items:start}
            .fees-stack{display:flex;flex-direction:column;gap:16px;min-width:0}
            .fees-card{background:#fff;border:1px solid #e3eaf3;border-radius:16px;box-shadow:0 3px 14px rgba(20,43,74,.035);overflow:hidden;min-width:0}
            .fees-card-head{padding:18px 20px;border-bottom:1px solid #edf1f6;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
            .fees-card-head h3{font-size:16px;margin:0 0 5px;font-weight:800;color:#142b4a}
            .fees-card-head p{font-size:12px;color:#718096;margin:0}
            .fees-card-body{padding:18px 20px}
            .fees-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
            .fees-form-grid .field{min-width:0}
            .fees-form-grid .field input,.fees-form-grid .field select{width:100%;min-width:0;box-sizing:border-box}
            .fees-student-summary{margin:0 0 16px;padding:13px 15px;border:1px solid #dceaf9;background:#f4f8fe;border-radius:12px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}
            .fees-summary-name{font-weight:800;font-size:14px;color:#142b4a}
            .fees-summary-meta{font-size:12px;color:#64748b;margin-top:4px}
            .fees-summary-amount{font-size:12px;color:#64748b}
            .fees-summary-amount strong{display:block;font-size:18px;color:#dc2626;margin-top:3px}
            .fees-table-wrap{overflow-x:auto;overflow-y:hidden;width:100%;max-width:100%;-webkit-overflow-scrolling:touch}
            .fees-table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px}
            .fees-table th{background:#f7f9fc;color:#62738b;font-size:11px;text-align:left;font-weight:700;padding:12px 13px;border-bottom:1px solid #e8edf4}
            .fees-table td{padding:12px 13px;border-bottom:1px solid #edf1f6;color:#263b56;vertical-align:middle}
            .fees-table tr:last-child td{border-bottom:0}
            .fees-student-name{font-weight:700;color:#142b4a}
            .fees-muted{font-size:11px;color:#718096;margin-top:3px}
            .fees-status{display:inline-flex;border-radius:20px;padding:4px 8px;font-size:10px;font-weight:800}
            .fees-status-paid{color:#087443;background:#dff8ec}.fees-status-partial{color:#9a5800;background:#fff0cf}.fees-status-due{color:#b42318;background:#fee4e2}
            .fees-debt-amount{color:#dc2626;font-weight:800}
            .fees-link{border:0;background:#eff6ff;color:#075ec8;font-weight:800;border-radius:9px;padding:9px 11px;cursor:pointer}
            .fees-quick-list{display:flex;flex-direction:column;gap:0}
            .fees-quick-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid #edf1f6}
            .fees-quick-row:last-child{border-bottom:0}
            .fees-quick-row span{font-size:12px;color:#64748b}.fees-quick-row strong{display:block;color:#142b4a;font-size:16px;margin-top:4px}
            .fees-empty{padding:22px;text-align:center;color:#718096;font-size:13px}
            @media(max-width:1100px){.fees-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.payment-report-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.fees-columns{grid-template-columns:1fr}}
            @media(max-width:700px){.fees-kpis{grid-template-columns:1fr 1fr;gap:9px}.payment-report-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.payment-report-kpis .fees-kpi{padding:12px;min-height:86px}.payment-report-kpis .fees-kpi strong{font-size:16px}.fees-kpi{padding:12px;gap:9px}.fees-kpi-icon{width:36px;height:36px;flex-basis:36px}.fees-kpi-value{font-size:19px}.fees-form-grid{grid-template-columns:1fr}.fees-card-body{padding:14px}.fees-card-head{padding:14px}.fees-toolbar h2{font-size:22px}.payment-report-actions{width:100%;justify-content:flex-start}.payment-report-actions select{flex:1 1 135px}.payment-report-actions button{flex:1 1 150px;justify-content:center}}
            @media(max-width:420px){.fees-kpis{grid-template-columns:1fr 1fr}.payment-report-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.payment-report-kpis .fees-kpi{padding:10px}.payment-report-kpis .fees-kpi span{font-size:11px}.payment-report-kpis .fees-kpi strong{font-size:15px}.fees-toolbar-actions{width:100%}.fees-toolbar-actions>*{flex:1}}
          `}</style>
          {(() => {
            const periodPayments = payments.filter(p => p.period_name === debtPeriod);
            const activeStudents = students.filter(s=>s.status==="Active");
            const periodLedger = feeLedger.filter((r:any)=>r.period_name===debtPeriod);
            const collected = periodLedger.reduce((sum:number,r:any)=>sum+studentPaidTotal(r.student_id,debtPeriod),0);
            const debtRows = activeStudents.map(s=>{const ledger=periodLedger.find((r:any)=>r.student_id===s.id);const fee=ledger?Math.max(0,Number(ledger.amount_due||0)-Number(ledger.amount_waived||0)):0;const paid=studentPaidTotal(s.id,debtPeriod);return {student:s,fee,paid,due:Math.max(0,fee-paid),ledgerExists:Boolean(ledger)};}).filter(x=>x.ledgerExists && x.due>0);
            const selectedStudent = students.find(s=>s.id===paymentForm.student_id);
            const selectedLedger = selectedStudent ? feeLedger.find((r:any)=>r.student_id===selectedStudent.id && r.period_name===paymentForm.period_name) : null;
            const selectedFee = selectedLedger ? Math.max(0,Number(selectedLedger.amount_due||0)-Number(selectedLedger.amount_waived||0)) : 0;
            const selectedPaid = selectedStudent ? studentPaidTotal(selectedStudent.id,paymentForm.period_name) : 0;
            const selectedDue = Math.max(0,selectedFee-selectedPaid);
            const filteredPayments = payments.filter(p=>{const st=students.find(x=>x.id===p.student_id);return `${st?.full_name??""} ${st?.student_code??""} ${p.receipt_number} ${p.period_name}`.toLowerCase().includes(paymentSearch.toLowerCase())});
            const allPaymentReportRows = activeStudents.map(student => {
              const ledger = periodLedger.find((r:any)=>r.student_id===student.id);
              const charged = Math.max(0, Number(ledger?.amount_due ?? 0));
              const waived = Math.max(0, Number(ledger?.amount_waived ?? 0));
              const paid = studentPaidTotal(student.id, debtPeriod);
              const netDue = Math.max(0, charged - waived);
              const balance = Math.max(0, netDue - paid);
              const status = !ledger ? "Ledger lama abuurin" : netDue === 0 ? "Ka-dhaafis / Free" : balance <= 0 ? "La bixiyey" : paid > 0 ? "Qayb ahaan la bixiyey" : "Aan la bixin";
              const latest = periodPayments.filter(p=>p.student_id===student.id).sort((a,b)=>String(b.payment_date).localeCompare(String(a.payment_date)))[0];
              return {student, charged, waived, paid, balance, status, latest};
            });
            const statusFilteredRows = allPaymentReportRows.filter(r => reportStatus === "all" || (reportStatus === "paid" && (r.status === "La bixiyey" || r.status === "Ka-dhaafis / Free")) || (reportStatus === "partial" && r.status === "Qayb ahaan la bixiyey") || (reportStatus === "unpaid" && r.status === "Aan la bixin") || (reportStatus === "debt" && r.balance > 0) || (reportStatus === "missing" && r.status === "Ledger lama abuurin"));
            const paymentReportRows = reportLimit === "all" ? statusFilteredRows : statusFilteredRows.slice(0, Number(reportLimit));
            const reportTotals = paymentReportRows.reduce((a,r)=>({charged:a.charged+r.charged,waived:a.waived+r.waived,paid:a.paid+r.paid,balance:a.balance+r.balance}),{charged:0,waived:0,paid:0,balance:0});
            const exportPaymentReport = (format:"csv"|"pdf") => {
              const headers = ["Student Code","Student Name","Phone","Course","Period","Fee Charged (USD)","Waived (USD)","Paid (USD)","Balance (USD)","Status","Last Payment Date","Payment Method","Receipt Number"];
              const rows = paymentReportRows.map(r=>[r.student.student_code,r.student.full_name,r.student.phone||"",r.student.course_name||courses.find(c=>c.id===r.student.course_id)?.name||"",debtPeriod,r.charged.toFixed(2),r.waived.toFixed(2),r.paid.toFixed(2),r.balance.toFixed(2),r.status,r.latest?.payment_date||"",r.latest?.payment_method||"",r.latest?.receipt_number||""]);
              if(format==="csv") {
                const csv = "\uFEFF"+[headers,...rows,["TOTAL","", "", "", debtPeriod,reportTotals.charged.toFixed(2),reportTotals.waived.toFixed(2),reportTotals.paid.toFixed(2),reportTotals.balance.toFixed(2),"", "", "", ""]].map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
                const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`Kaafi_Lacag-bixin_${debtPeriod}.csv`; a.click(); URL.revokeObjectURL(url); return;
              }
              const esc=(v:any)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
              const htmlRows=rows.map(row=>`<tr>${row.map((v,i)=>`<td>${esc([5,6,7,8].includes(i)?`$${v}`:v)}</td>`).join("")}</tr>`).join("");
              const w=window.open("","_blank","width=1200,height=800"); if(!w){alert("Fadlan oggolow pop-up si aad PDF u daabacdo.");return;}
              w.document.write(`<!doctype html><html><head><title>Kaafi Tech - Warbixinta lacag-bixinta ${esc(debtPeriod)}</title><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;color:#172b4d;padding:0;margin:0;font-size:10px}.report-header{border-bottom:4px solid #f7931e;padding:0 0 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:12px}.brand{font-size:20px;font-weight:900;color:#102b4b}.subtitle{font-size:10px;color:#64748b;margin-top:4px}.report-tag{border:1px solid #dce5f0;border-radius:8px;padding:8px 10px;text-align:right;font-size:9px}h1{font-size:17px;margin:12px 0 4px;color:#102b4b}p{color:#52657f;font-size:10px;margin:4px 0}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0;font-size:10px}.total-card{border:1px solid #dce5f0;border-radius:6px;padding:8px;background:#f7f9fc}.total-card b{display:block;font-size:12px;margin-top:4px;color:#102b4b}table{border-collapse:collapse;width:100%;font-size:8px;margin-top:12px;table-layout:auto}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #d8e0eb;padding:5px 4px;text-align:left;overflow-wrap:anywhere}th{background:#102b4b;color:#fff;font-size:8px}tbody tr:nth-child(even){background:#f7f9fc}tfoot{font-weight:bold;background:#eef3f9}.report-footer{border-top:2px solid #f7931e;margin-top:14px;padding-top:7px;display:flex;justify-content:space-between;color:#64748b;font-size:8px}.report-footer .page-note{font-weight:700;color:#102b4b}@media print{button{display:none}body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4 ${printOrientation};margin:12mm 10mm 14mm;@bottom-right{content:"Bogga " counter(page) " / " counter(pages);font:8px Arial;color:#64748b}}}</style></head><body><header class="report-header"><div><div class="brand">KAAFI TECH AND MEDIA CENTER</div><div class="subtitle">Student Management System · Lacag-bixin & Maamulka Maaliyadda</div></div><div class="report-tag"><b>WARBIXIN RASMI AH</b><br/>Muddada: ${esc(debtPeriod)}<br/>Taariikhda: ${new Date().toLocaleDateString()}</div></header><h1>Warbixinta Lacag-bixinta Ardayda</h1><p>Diiwaannada: ${paymentReportRows.length}</p><div class="totals"><div class="total-card">Lacagta la rabay<b>${money(reportTotals.charged)}</b></div><div class="total-card">Ka-dhaafis<b>${money(reportTotals.waived)}</b></div><div class="total-card">La bixiyey<b>${money(reportTotals.paid)}</b></div><div class="total-card">Hadhaaga guud<b>${money(reportTotals.balance)}</b></div></div><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${htmlRows}</tbody><tfoot><tr><td>TOTAL</td><td colspan="4"></td><td>${money(reportTotals.charged)}</td><td>${money(reportTotals.waived)}</td><td>${money(reportTotals.paid)}</td><td>${money(reportTotals.balance)}</td><td colspan="4"></td></tr></tfoot></table><footer class="report-footer"><span><b>KAAFI TECH AND MEDIA CENTER</b> · Warbixin maaliyadeed · Xog rasmi ah</span><span>La soo saaray: ${new Date().toLocaleString()}</span></footer><script>window.onload=()=>window.print()</script></body></html>`); w.document.close();
            };
            return <div className="fees-page">
              <div className="fees-toolbar"><div><h2>Lacagaha & Bixinta</h2><p>Maamul lacag-bixinta, la soco deynta, una soo saar rasiid rasmi ah.</p></div><div className="fees-toolbar-actions"><label style={{fontSize:12,color:"#64748b",fontWeight:700}}>Muddada <input className="fees-select-period" type="month" value={debtPeriod} onChange={e=>setDebtPeriod(e.target.value)} aria-label="Dooro muddada"/></label><button className="btn" onClick={()=>{void loadPayments();void loadStudents();}} disabled={paymentLoading}><Activity size={15}/>{paymentLoading?"Waa la cusboonaysiinayaa...":"Cusboonaysii"}</button></div></div>
              <section className="fees-card"><div className="fees-card-head"><div><h3>Maamulka kharashka bil kasta</h3><p>Abuur ledger-ka bisha, hubi xaaladdiisa, oo xir bisha marka xisaabtu dhammaato.</p></div><span className={`fees-status ${(feePeriods.find((p:any)=>p.period_name===debtPeriod)?.status === "Closed") ? "fees-status-due" : "fees-status-paid"}`}>{feePeriods.find((p:any)=>p.period_name===debtPeriod)?.status ?? "Aan la furin"}</span></div><div className="fees-card-body"><div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}><button type="button" className="btn btn-primary" disabled={!isAdmin || feeActionLoading || feePeriods.some((p:any)=>p.period_name===debtPeriod && p.status==="Closed")} onClick={()=>void generateMonthlyFees()}><CircleDollarSign size={15}/>{feeActionLoading?"Fadlan sug...":"Abuur kharashka bisha"}</button><span className="fees-muted">Waxay abuureysaa kharashka ardayda Active; diiwaannadii hore lama dul-qoro.</span></div><div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}><input aria-label="Faallo xiritaanka bisha" value={closingNotes} onChange={e=>setClosingNotes(e.target.value)} placeholder="Faallo xiritaanka bisha (ikhtiyaari)" style={{flex:"1 1 240px",minWidth:0}}/><button type="button" className="btn" disabled={!isAdmin || feeActionLoading || feePeriods.find((p:any)=>p.period_name===debtPeriod)?.status!=="Open"} onClick={()=>void closeMonthlyFees()}>Xir bisha</button></div>{!isAdmin && <p className="fees-muted" style={{marginTop:10}}>Akoonka hadda jira ma muujinayo role Admin; abuurista iyo xiritaanka bisha waxaa qaban kara Admin oo keliya.</p>}</div></section>
              <section className="fees-card"><div className="fees-card-head"><div><h3>Codsiyada ka-dhaafista lacagta</h3><p>Shaqaaluhu way codsan karaan; Admin ayaa ansixin ama diidi kara.</p></div><span className="fees-status fees-status-partial">{waiverRequests.filter((r:any)=>r.status==="Pending").length} sugaya</span></div><div className="fees-card-body"><form onSubmit={submitWaiverRequest}><div className="fees-form-grid"><Field label="Ardayga *"><select required value={waiverForm.student_id} onChange={e=>setWaiverForm(v=>({...v,student_id:e.target.value}))}><option value="">Dooro arday</option>{students.filter(s=>s.status==="Active").map(s=><option key={s.id} value={s.id}>{s.student_code} — {s.full_name}</option>)}</select></Field><Field label="Bisha *"><input required type="month" value={waiverForm.period_name} onChange={e=>setWaiverForm(v=>({...v,period_name:e.target.value}))}/></Field><Field label="Lacagta laga dhaafayo ($) *"><input required type="number" min="0.01" step="0.01" value={waiverForm.amount_requested} onChange={e=>setWaiverForm(v=>({...v,amount_requested:e.target.value}))}/></Field><Field label="Sababta *"><input required value={waiverForm.reason} onChange={e=>setWaiverForm(v=>({...v,reason:e.target.value}))} placeholder="Sababta codsiga"/></Field></div><div className="form-actions" style={{marginTop:12}}><button className="btn btn-primary" disabled={feeActionLoading}>Gudbi codsiga ka-dhaafista</button></div></form>{waiverRequests.length>0 && <div className="fees-table-wrap" style={{marginTop:16}}><table className="fees-table"><thead><tr><th>Arday</th><th>Bisha</th><th>Lacagta</th><th>Sababta</th><th>Xaalad</th><th>Go'aan</th></tr></thead><tbody>{waiverRequests.map((r:any)=>{const st=students.find(s=>s.id===r.student_id);return <tr key={r.id}><td>{st?.full_name ?? r.student_id}</td><td>{r.period_name}</td><td>{money(Number(r.amount_requested||0))}</td><td>{r.reason}</td><td>{r.status}</td><td>{isAdmin && r.status==="Pending"?<div style={{display:"flex",gap:6}}><button className="btn" disabled={feeActionLoading} onClick={()=>void reviewRequest("fee_waiver_requests",r.id,"Approved")}>Ansixi</button><button className="btn" disabled={feeActionLoading} onClick={()=>void reviewRequest("fee_waiver_requests",r.id,"Rejected")}>Diid</button></div>:r.review_note||"—"}</td></tr>})}</tbody></table></div>}</div></section>
              <section className="fees-card"><div className="fees-card-head"><div><h3>Codsiyada lacag-celinta</h3><p>Lacag-bixinta asalka ah waa la ilaaliyaa; codsi kasta wuxuu leeyahay go'aan gaar ah.</p></div><span className="fees-status fees-status-partial">{refundRequests.filter((r:any)=>r.status==="Pending").length} sugaya</span></div><div className="fees-card-body"><form onSubmit={submitRefundRequest}><div className="fees-form-grid"><Field label="Lacag-bixinta *"><select required value={refundForm.payment_transaction_id} onChange={e=>{const p=payments.find(x=>x.id===e.target.value);setRefundForm(v=>({...v,payment_transaction_id:e.target.value,amount_requested:p?String(p.amount):v.amount_requested}));}}><option value="">Dooro rasiid</option>{payments.map(p=>{const st=students.find(s=>s.id===p.student_id);return <option key={p.id} value={p.id}>{p.receipt_number} — {st?.full_name??"Arday"} — {money(Number(p.amount))}</option>})}</select></Field><Field label="Lacagta la codsanayo ($) *"><input required type="number" min="0.01" step="0.01" value={refundForm.amount_requested} onChange={e=>setRefundForm(v=>({...v,amount_requested:e.target.value}))}/></Field><Field label="Sababta *"><input required value={refundForm.reason} onChange={e=>setRefundForm(v=>({...v,reason:e.target.value}))} placeholder="Sababta lacag-celinta"/></Field></div><div className="form-actions" style={{marginTop:12}}><button className="btn btn-primary" disabled={feeActionLoading}>Gudbi codsiga lacag-celinta</button></div></form>{refundRequests.length>0 && <div className="fees-table-wrap" style={{marginTop:16}}><table className="fees-table"><thead><tr><th>Rasiid</th><th>Lacagta la codsaday</th><th>Sababta</th><th>Xaalad</th><th>Go'aan</th></tr></thead><tbody>{refundRequests.map((r:any)=>{const p=payments.find(x=>x.id===r.payment_transaction_id);return <tr key={r.id}><td>{p?.receipt_number??r.payment_transaction_id}</td><td>{money(Number(r.amount_requested||0))}</td><td>{r.reason}</td><td>{r.status}</td><td>{isAdmin && r.status==="Pending"?<div style={{display:"flex",gap:6}}><button className="btn" disabled={feeActionLoading} onClick={()=>void reviewRequest("refund_requests",r.id,"Approved")}>Ansixi</button><button className="btn" disabled={feeActionLoading} onClick={()=>void reviewRequest("refund_requests",r.id,"Rejected")}>Diid</button></div>:isAdmin && r.status==="Approved"?<button className="btn btn-primary" disabled={feeActionLoading} onClick={()=>void markRefundAsPaid(r.id)}>Xaqiiji in la celiyey</button>:r.review_note||r.refund_reference||"—"}</td></tr>})}</tbody></table></div>}</div></section>
              <div className="fees-kpis">
                <div className="fees-kpi"><div className="fees-kpi-icon" style={{background:"#e2f8ec",color:"#0b9b5b"}}><Users size={22}/></div><div><div className="fees-kpi-label">Dhammaan ardayda</div><div className="fees-kpi-value">{activeStudents.length}</div><div className="fees-kpi-note">Arday firfircoon</div></div></div>
                <div className="fees-kpi"><div className="fees-kpi-icon" style={{background:"#e3f0ff",color:"#0875d1"}}><CircleDollarSign size={22}/></div><div><div className="fees-kpi-label">Lacagta la ururiyey</div><div className="fees-kpi-value">{money(collected)}</div><div className="fees-kpi-note">Muddada {debtPeriod}</div></div></div>
                <div className="fees-kpi"><div className="fees-kpi-icon" style={{background:"#fff0db",color:"#ed8615"}}><Clock3 size={22}/></div><div><div className="fees-kpi-label">Lacagta weli la filayo</div><div className="fees-kpi-value">{money(debtRows.reduce((sum,x)=>sum+x.due,0))}</div><div className="fees-kpi-note">Qiyaasta deynta muddadan</div></div></div>
                <div className="fees-kpi"><div className="fees-kpi-icon" style={{background:"#ffe8e8",color:"#dc2626"}}><UserRound size={22}/></div><div><div className="fees-kpi-label">Ardayda deynta leh</div><div className="fees-kpi-value">{debtRows.length}</div><div className="fees-kpi-note">Waxaa loo baahan yahay dabagal</div></div></div>
              </div>
              <div className="fees-columns"><div className="fees-stack">
                <section className="fees-card"><div className="fees-card-head"><div><h3>Diiwaangeli lacag-bixin</h3><p>Buuxi xogta, kaydi lacagta, kadib soo saar rasiidka.</p></div><span style={{fontSize:11,fontWeight:800,color:"#087443",background:"#e0f8eb",padding:"6px 9px",borderRadius:20}}>Supabase</span></div><div className="fees-card-body">
                  {selectedStudent && <div className="fees-student-summary"><div><div className="fees-summary-name">{selectedStudent.full_name} · {selectedStudent.student_code}</div><div className="fees-summary-meta">Koorso: {selectedStudent.course_name||"—"} · Lacagta bisha: {money(selectedFee)}</div></div><div className="fees-summary-amount">Hadhaaga muddadan<strong>{money(selectedDue)}</strong></div></div>}
                  <form onSubmit={savePayment}><div className="fees-form-grid">
                    <Field label="Ardayga *"><select required value={paymentForm.student_id} onChange={e=>{const id=e.target.value;const ledger=feeLedger.find((r:any)=>r.student_id===id && r.period_name===paymentForm.period_name);const fee=ledger?Math.max(0,Number(ledger.amount_due||0)-Number(ledger.amount_waived||0)):0;const paid=id?studentPaidTotal(id,paymentForm.period_name):0;setPaymentForm(v=>({...v,student_id:id,amount:ledger?String(Math.max(0,fee-paid)||""):""}));}}><option value="">Dooro arday</option>{students.filter(s=>s.status==="Active").map(s=><option key={s.id} value={s.id}>{s.student_code} — {s.full_name}</option>)}</select></Field>
                    <Field label="Bisha / muddada *"><input required type="month" value={paymentForm.period_name} onChange={e=>{const period=e.target.value;const st=students.find(s=>s.id===paymentForm.student_id);const ledger=st?feeLedger.find((r:any)=>r.student_id===st.id && r.period_name===period):null;const fee=ledger?Math.max(0,Number(ledger.amount_due||0)-Number(ledger.amount_waived||0)):0;const paid=st?studentPaidTotal(st.id,period):0;setPaymentForm(v=>({...v,period_name:period,amount:st&&ledger?String(Math.max(0,fee-paid)||""):""}));}}/></Field>
                    <Field label="Taariikhda bixinta *"><input required type="date" value={paymentForm.payment_date} onChange={e=>setPaymentForm({...paymentForm,payment_date:e.target.value})}/></Field>
                    <Field label="Lacagta la bixiyey (USD) *"><input required type="number" min="0.01" step="0.01" max={selectedDue>0?selectedDue:undefined} value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})} placeholder="Tusaale: 25.00"/></Field>
                    <Field label="Habka bixinta *"><select required value={paymentForm.payment_method} onChange={e=>setPaymentForm({...paymentForm,payment_method:e.target.value})}><option value="Cash">Lacag caddaan ah</option><option value="Mobile Money">Mobile Money</option><option value="Bank Transfer">Bank Transfer</option><option value="Other">Kale</option></select></Field>
                    <Field label="Faallo (ikhtiyaari)"><input value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm,notes:e.target.value})} placeholder="Tusaale: Lacagta bisha October"/></Field>
                  </div><div className="form-actions" style={{display:"flex",gap:10,marginTop:18,flexWrap:"wrap"}}><button className="btn btn-primary" disabled={paymentSaving || !students.length}><Check size={16}/>{paymentSaving?"Waa la kaydinayaa...":"Kaydi lacag-bixinta"}</button><button type="button" className="btn" onClick={()=>setPaymentForm(v=>({...v,student_id:"",amount:"",notes:""}))}>Nadiifi</button></div></form>
                </div></section>
                <section className="fees-card"><div className="fees-card-head"><div><h3>Taariikhda lacag-bixinta</h3><p>{payments.length} diiwaan · Rasiid kasta waa la daabici karaa.</p></div><input aria-label="Raadi lacag-bixin" value={paymentSearch} onChange={e=>setPaymentSearch(e.target.value)} placeholder="Raadi arday ama rasiid..." style={{maxWidth:280,width:"100%"}}/></div>
                  {paymentLoading?<div className="fees-empty">Lacag-bixinnada waa la soo qaadanayaa...</div>:filteredPayments.length===0?<div className="fees-empty">Weli lacag-bixin lama diiwaangelin ama raadintu natiijo ma helin.</div>:<div className="fees-table-wrap"><table className="fees-table"><thead><tr><th>Taariikh</th><th>Rasiid No.</th><th>Ardayga</th><th>Muddada</th><th>Habka</th><th>Lacagta</th><th>Xaalad</th><th>Rasiid</th></tr></thead><tbody>{filteredPayments.map(p=>{const st=students.find(x=>x.id===p.student_id);const paid=studentPaidTotal(p.student_id,p.period_name);const ledger=feeLedger.find((r:any)=>r.student_id===p.student_id && r.period_name===p.period_name);const fee=Math.max(0,Number(ledger?.amount_due||0)-Number(ledger?.amount_waived||0));const due=Math.max(0,fee-paid);const status=!ledger?"Ledger ma jiro":due===0?"La bixiyey":paid>0?"Qayb ahaan":"Lama bixin";return <tr key={p.id}><td>{p.payment_date}</td><td><strong>{p.receipt_number}</strong></td><td><div className="fees-student-name">{st?.full_name??"Arday aan la helin"}</div><div className="fees-muted">{st?.student_code??p.student_id}</div></td><td>{p.period_name}</td><td>{p.payment_method}</td><td><strong>{money(Number(p.amount||0))}</strong></td><td><span className={`fees-status ${status==="La bixiyey"?"fees-status-paid":status==="Qayb ahaan"?"fees-status-partial":"fees-status-due"}`}>{status}</span></td><td><button type="button" className="btn btn-primary" onClick={()=>printReceipt(p)}><Download size={14}/> Daabac</button></td></tr>})}</tbody></table></div>}
                </section>
              </div><div className="fees-stack">
                <section className="fees-card"><div className="fees-card-head"><div><h3>Warbixinta lacag-bixinta</h3><p>Dhammaan ardayda firfircoon, lacagta laga rabo, bixinta, hadhaaga iyo xaaladda bisha {debtPeriod}.</p></div><div className="payment-report-actions"><select aria-label="Shaandhee xaaladda lacagta" value={reportStatus} onChange={e=>setReportStatus(e.target.value)} style={{maxWidth:190}}><option value="all">Dhammaan xaaladaha</option><option value="paid">La bixiyey</option><option value="partial">Qayb ahaan la bixiyey</option><option value="unpaid">Aan la bixin</option><option value="debt">Dayn leh</option><option value="missing">Ledger lama abuurin</option></select><select aria-label="Tirada diiwaannada" value={reportLimit} onChange={e=>setReportLimit(e.target.value)} style={{maxWidth:150}}><option value="all">Dhammaan</option><option value="10">10 diiwaan</option><option value="25">25 diiwaan</option><option value="50">50 diiwaan</option><option value="100">100 diiwaan</option></select><select aria-label="Jihada warqadda PDF" value={printOrientation} onChange={e=>setPrintOrientation(e.target.value)} style={{maxWidth:135}}><option value="landscape">A4 jiif ah</option><option value="portrait">A4 taagan</option></select><button className="btn" onClick={()=>exportPaymentReport("pdf")}><Printer size={15}/> Daabac / PDF</button><button className="btn btn-primary" onClick={()=>exportPaymentReport("csv")}><FileSpreadsheet size={15}/> Soo dejiso Excel</button></div></div><div className="fees-card-body"><div className="fees-kpis payment-report-kpis"><div className="fees-kpi"><div><span>Lacagta la rabay</span><strong>{money(reportTotals.charged)}</strong></div></div><div className="fees-kpi"><div><span>Ka-dhaafis</span><strong>{money(reportTotals.waived)}</strong></div></div><div className="fees-kpi"><div><span>La bixiyey</span><strong>{money(reportTotals.paid)}</strong></div></div><div className="fees-kpi"><div><span>Hadhaaga guud</span><strong className="fees-debt-amount">{money(reportTotals.balance)}</strong></div></div></div><div className="fees-table-wrap" style={{marginTop:14}}><table className="fees-table"><thead><tr><th>Lambarka</th><th>Magaca ardayga</th><th>Telefoon</th><th>Koorsada</th><th>Laga rabo</th><th>Ka-dhaafis</th><th>La bixiyey</th><th>Hadhaaga</th><th>Xaaladda</th></tr></thead><tbody>{paymentReportRows.map(r=><tr key={r.student.id}><td>{r.student.student_code}</td><td><div className="fees-student-name">{r.student.full_name}</div></td><td>{r.student.phone||"—"}</td><td>{r.student.course_name||courses.find(c=>c.id===r.student.course_id)?.name||"—"}</td><td>{money(r.charged)}</td><td>{money(r.waived)}</td><td>{money(r.paid)}</td><td><span className={r.balance>0?"fees-debt-amount":""}>{money(r.balance)}</span></td><td><span className={`fees-status ${r.status==="Ledger lama abuurin"?"fees-status-partial":r.balance===0?"fees-status-paid":r.paid>0?"fees-status-partial":"fees-status-due"}`}>{r.status}</span></td></tr>)}</tbody><tfoot><tr><td colSpan={4}><b>WADARTA GUUD</b></td><td><b>{money(reportTotals.charged)}</b></td><td><b>{money(reportTotals.waived)}</b></td><td><b>{money(reportTotals.paid)}</b></td><td><b>{money(reportTotals.balance)}</b></td><td></td></tr></tfoot></table></div></div></section>
                <section className="fees-card"><div className="fees-card-head"><div><h3>Ledger-ka kharashka bisha</h3><p>Diiwaanka rasmi ah ee kharashka iyo ka-dhaafista {debtPeriod}.</p></div><span className="fees-status fees-status-paid">{feeLedger.filter((r:any)=>r.period_name===debtPeriod).length} diiwaan</span></div>{feeLedger.filter((r:any)=>r.period_name===debtPeriod).length===0?<div className="fees-empty">Ledger lama abuurin bishan. Isticmaal “Abuur kharashka bisha”.</div>:<div className="fees-table-wrap"><table className="fees-table"><thead><tr><th>Arday</th><th>Laga rabo</th><th>Laga dhaafay</th><th>La bixiyey</th><th>Hadhaag</th><th>Xaalad</th></tr></thead><tbody>{feeLedger.filter((r:any)=>r.period_name===debtPeriod).map((r:any)=>{const st=students.find(s=>s.id===r.student_id);const paid=studentPaidTotal(r.student_id,debtPeriod);const due=Math.max(0,Number(r.amount_due||0)-Number(r.amount_waived||0)-paid);return <tr key={r.id}><td><div className="fees-student-name">{st?.full_name??"Arday"}</div><div className="fees-muted">{st?.student_code??r.student_id}</div></td><td>{money(Number(r.amount_due||0))}</td><td>{money(Number(r.amount_waived||0))}</td><td>{money(paid)}</td><td><span className={due>0?"fees-debt-amount":""}>{money(due)}</span></td><td>{due===0?(Number(r.amount_due||0)-Number(r.amount_waived||0)<=0?"Free":"Paid"):paid>0?"Partial":"Unpaid"}</td></tr>})}</tbody></table></div>}</section>
                <section className="fees-card"><div className="fees-card-head"><div><h3>Ardayda lacagta lagu leeyahay</h3><p>Hadhaaga arday kasta ee {debtPeriod}.</p></div><span style={{background:"#fff0cf",color:"#9a5800",fontWeight:800,borderRadius:8,padding:"5px 9px",fontSize:12}}>{debtRows.length}</span></div>
                  {debtRows.length===0?<div className="fees-empty">Ma jiro arday deyn ku leh muddadan.</div>:<div className="fees-table-wrap"><table className="fees-table"><thead><tr><th>Ardayga</th><th>Laga rabo</th><th>Bixiyey</th><th>Hadhaag</th></tr></thead><tbody>{debtRows.map(({student:st,fee,paid,due})=><tr key={st.id}><td><div className="fees-student-name">{st.full_name}</div><div className="fees-muted">{st.student_code}</div></td><td>{money(fee)}</td><td>{money(paid)}</td><td><span className="fees-debt-amount">{money(due)}</span></td></tr>)}</tbody></table></div>}
                </section>
                <section className="fees-card"><div className="fees-card-head"><div><h3>Soo koobid</h3><p>Koobid lacag-bixinta muddada la doortay.</p></div></div><div className="fees-card-body"><div className="fees-quick-list"><div className="fees-quick-row"><div><span>Lacagta la ururiyey</span><strong>{money(collected)}</strong></div><CircleDollarSign size={22} color="#0b9b5b"/></div><div className="fees-quick-row"><div><span>Lacag-bixinno la kaydiyey</span><strong>{periodPayments.length}</strong></div><ClipboardList size={22} color="#0875d1"/></div><div className="fees-quick-row"><div><span>Arday lacag bixiyey</span><strong>{new Set(periodPayments.map(p=>p.student_id)).size}</strong></div><Users size={22} color="#7c3aed"/></div><div className="fees-quick-row"><div><span>Hadhaaga deynta</span><strong style={{color:"#dc2626"}}>{money(debtRows.reduce((sum,x)=>sum+x.due,0))}</strong></div><Clock3 size={22} color="#ed8615"/></div></div><button type="button" className="fees-link" style={{width:"100%",marginTop:14}} onClick={()=>{setPaymentSearch("");setMessage("Soo koobidda waxaa lagu xisaabiyey diiwaanka lacag-bixinta ee Supabase.");}}>Eeg soo koobidda lacagaha →</button></div></section>
              </div></div>
            </div>;
          })()}
        </>}
        {page === "Books Management" && <>
          <div className="welcome"><div><h2>Buugaagta iyo casharrada koorsooyinka</h2><p>Ku qor cashar cusub ama buug, kuna xiro koorsada uu ka tirsan yahay.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn" onClick={()=>void loadCourseMaterials()} disabled={materialsLoading}><Activity size={15}/> Cusboonaysii</button><button className="btn btn-primary" onClick={()=>{setMaterialForm({course_id:courses[0]?.id??"",title:"",material_type:"Lesson",lesson_number:String(filteredCourseMaterials.length+1),description:"",content:"",reference_url:""});setEditingMaterialId(null);setMaterialFormOpen(v=>!v);}}><Plus size={15}/> Ku dar buug/cashar</button></div></div>
          <section className="panel" style={{borderTop:"4px solid #f7931e"}}>
            {materialFormOpen && <form onSubmit={saveCourseMaterial}>
              <div className="panel-head"><div><h3>{editingMaterialId?"Wax ka beddel agabka":"Ku dar agab koorso"}</h3><div className="panel-sub">Waxaad gelin kartaa qoraal cashar oo buuxa ama tixraac buug.</div></div><button type="button" className="btn" onClick={resetMaterialForm}><X size={15}/> Xir</button></div>
              <div className="form-grid">
                <Field label="Koorsada *"><select required value={materialForm.course_id} onChange={e=>setMaterialForm(v=>({...v,course_id:e.target.value}))}><option value="">Dooro koorso</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Nooca agabka"><select value={materialForm.material_type} onChange={e=>setMaterialForm(v=>({...v,material_type:e.target.value}))}><option value="Lesson">Cashar</option><option value="Book">Buug</option><option value="Handout">Qoraal / Handout</option><option value="Link">Link waxbarasho</option><option value="Assignment">Layli / Homework</option></select></Field>
                <Field label="Lambarka casharka"><input type="number" min="1" value={materialForm.lesson_number} onChange={e=>setMaterialForm(v=>({...v,lesson_number:e.target.value}))}/></Field>
                <Field label="Magaca buugga/casharka *"><input required value={materialForm.title} onChange={e=>setMaterialForm(v=>({...v,title:e.target.value}))} placeholder="Tusaale: Lesson 1 — Introduction to Computers"/></Field>
                <Field label="Sharaxaad / Ujeeddo"><input value={materialForm.description} onChange={e=>setMaterialForm(v=>({...v,description:e.target.value}))} placeholder="Waxa ardaygu casharkan ka baranayo"/></Field>
                <Field label="Link (ikhtiyaari)"><input type="url" value={materialForm.reference_url} onChange={e=>setMaterialForm(v=>({...v,reference_url:e.target.value}))} placeholder="https://..."/></Field>
              </div>
              <Field label="Qoraalka casharka / faahfaahinta"><textarea rows={7} value={materialForm.content} onChange={e=>setMaterialForm(v=>({...v,content:e.target.value}))} placeholder="Halkan ku qor casharka, qodobada muhiimka ah, tusaalooyinka iyo shaqada guriga..." style={{width:"100%",marginTop:6,boxSizing:"border-box"}}/></Field>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}><button type="button" className="btn" onClick={resetMaterialForm}>Jooji</button><button type="submit" className="btn btn-primary" disabled={materialsSaving}>{materialsSaving?"Waa la kaydinayaa...":editingMaterialId?"Kaydi isbeddelka":"Kaydi agabka"}</button></div>
            </form>}
            <div className="form-grid" style={{marginTop:materialFormOpen?22:0}}><Field label="Raadi buug/cashar"><input value={materialsSearch} onChange={e=>setMaterialsSearch(e.target.value)} placeholder="Magac, sharaxaad ama qoraal"/></Field><Field label="Shaandhee koorsada"><select value={materialsCourseFilter} onChange={e=>setMaterialsCourseFilter(e.target.value)}><option value="all">Dhammaan koorsooyinka</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
            <div className="panel-sub" style={{margin:"14px 0"}}>Agab la helay: {filteredCourseMaterials.length} · Agabku wuxuu ku xiran yahay koorsada la doortay.</div>
            {materialsLoading?<div className="empty">Agabka waa la soo qaadanayaa...</div>:filteredCourseMaterials.length===0?<div className="empty">Weli buug ama cashar lama diiwaangelin. Riix “Ku dar buug/cashar” si aad u bilowdo.</div>:<div className="table-scroll"><table><thead><tr><th>Koorsada</th><th>Nooca</th><th>#</th><th>Magaca</th><th>Sharaxaad</th><th>Qoraal</th><th>Hawlgal</th></tr></thead><tbody>{filteredCourseMaterials.map((item:any)=><tr key={item.id}><td>{courses.find(c=>c.id===item.course_id)?.name??"Koorsada lama helin"}</td><td>{({Lesson:"Cashar",Book:"Buug",Handout:"Qoraal",Link:"Link",Assignment:"Layli"} as Record<string,string>)[item.material_type]??item.material_type}</td><td>{item.lesson_number??"—"}</td><td><strong>{item.title}</strong>{item.reference_url&&<div><a href={item.reference_url} target="_blank" rel="noreferrer">Fur link-ga</a></div>}</td><td>{item.description||"—"}</td><td><details><summary>Akhriso qoraalka</summary><div style={{whiteSpace:"pre-wrap",maxWidth:360,padding:8}}>{item.content||"Qoraal lama gelin."}</div></details></td><td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button type="button" className="btn" onClick={()=>editCourseMaterial(item)}>Edit</button><button type="button" className="btn" onClick={()=>void deleteCourseMaterial(item)}>Tirtir</button></div></td></tr>)}</tbody></table></div>}
          </section>
        </>}
        {page === "Student Reports" && <>
          <div className="welcome"><div><h2>Warbixinnada ardayda</h2><p>Warbixin laga soo xisaabiyey diiwaanka ardayda ee Supabase.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn" onClick={()=>void loadStudents()} disabled={loading}><Activity size={15}/> Cusboonaysii</button><button className="btn" onClick={()=>printSimpleReport("Warbixinta Ardayda",["Student ID","Magaca","Telefoon","Koorsada","Xaaladda","Taariikhda diiwaangelinta"],studentReportRows.map(st=>[st.student_code,st.full_name,st.phone||"",st.course_name||courses.find(c=>c.id===st.course_id)?.name||"",st.status,st.registered_at?.slice(0,10)||""]))}><Printer size={15}/> Daabac / PDF</button><button className="btn btn-primary" onClick={()=>downloadReportCsv("Kaafi_Student_Report.csv",["Student ID","Full Name","Phone","Course","Status","Registered Date"],studentReportRows.map(st=>[st.student_code,st.full_name,st.phone||"",st.course_name||courses.find(c=>c.id===st.course_id)?.name||"",st.status,st.registered_at?.slice(0,10)||""]))}><FileSpreadsheet size={15}/> Excel / CSV</button></div></div>
          {(() => { return <section className="panel"><div className="form-grid"><Field label="Raadi arday"><input value={studentReportSearch} onChange={e=>setStudentReportSearch(e.target.value)} placeholder="Magac, Student ID ama telefoon"/></Field><Field label="Xaaladda"><select value={studentReportStatus} onChange={e=>setStudentReportStatus(e.target.value)}><option value="all">Dhammaan</option><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Completed">Completed</option></select></Field></div><div className="panel-sub" style={{margin:"12px 0"}}>Natiijooyinka: {studentReportRows.length} arday · Xogtu waa diiwaanka hadda jira, ma aha xog tusaale ah.</div><div className="table-scroll"><table><thead><tr><th>Student ID</th><th>Magaca ardayga</th><th>Telefoon</th><th>Koorsada</th><th>Fee</th><th>Xaaladda</th><th>Diiwaangelin</th><th>Warbixin qofeed</th></tr></thead><tbody>{studentReportRows.map(st=><tr key={st.id}><td>{st.student_code}</td><td>{st.full_name}</td><td>{st.phone||"—"}</td><td>{st.course_name||courses.find(c=>c.id===st.course_id)?.name||"—"}</td><td>{money(Number(st.course_fee||0))}</td><td>{st.status}</td><td>{st.registered_at?.slice(0,10)||"—"}</td><td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button type="button" className="btn" onClick={()=>void printStudentProfile(st)}><Printer size={14}/> PDF</button><button type="button" className="btn" onClick={()=>void exportStudentProfileCsv(st)}><Download size={14}/> Export</button></div></td></tr>)}</tbody></table></div></section>; })()}
        </>}
        {page === "Attendance Reports" && <>
          <div className="welcome"><div><h2>Warbixinta xaadirinta</h2><p>Taariikhda xaadirinta, xaaladaha iyo boqolleyda arday kasta.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn" onClick={()=>void loadAttendanceHistory()} disabled={attendanceReportLoading}><Activity size={15}/> {attendanceReportLoading?"Waa la soo qaadanayaa...":"Soo qaad xogta"}</button><button className="btn" onClick={()=>printSimpleReport("Warbixinta Xaadirinta",["Taariikh","Fasal","Student ID","Magaca","Xaaladda","Faallo"],attendanceReportRows.map(r=>[r.attendance_date,classes.find(c=>c.id===r.class_id)?.class_name||"",r.student?.student_code||"",r.student?.full_name||"",r.status,r.notes||""]))}><Printer size={15}/> Daabac / PDF</button><button className="btn btn-primary" onClick={()=>downloadReportCsv("Kaafi_Attendance_Report.csv",["Date","Class","Student ID","Student Name","Status","Notes"],attendanceReportRows.map(r=>[r.attendance_date,classes.find(c=>c.id===r.class_id)?.class_name||"",r.student?.student_code||"",r.student?.full_name||"",r.status,r.notes||""]))}><FileSpreadsheet size={15}/> Excel / CSV</button></div></div>
          <section className="panel"><div className="form-grid"><Field label="Fasalka"><select value={attendanceReportClass} onChange={e=>setAttendanceReportClass(e.target.value)}><option value="all">Dhammaan fasallada</option>{classes.map(c=><option key={c.id} value={c.id}>{c.class_name}</option>)}</select></Field><Field label="Xaaladda"><select value={attendanceReportStatus} onChange={e=>setAttendanceReportStatus(e.target.value)}><option value="all">Dhammaan xaaladaha</option><option value="Present">Xaadir</option><option value="Absent">Maqan</option><option value="Late">Daahay</option></select></Field><Field label="Laga bilaabo"><input type="date" value={attendanceReportFrom} onChange={e=>setAttendanceReportFrom(e.target.value)}/></Field><Field label="Ilaa"><input type="date" value={attendanceReportTo} onChange={e=>setAttendanceReportTo(e.target.value)}/></Field></div><div className="panel-sub" style={{margin:"12px 0"}}>Diiwaanno: {attendanceReportRows.length} · Xaadir: {attendanceReportRows.filter(r=>r.status==="Present").length} · Maqan: {attendanceReportRows.filter(r=>r.status==="Absent").length} · Daahay: {attendanceReportRows.filter(r=>r.status==="Late").length}</div>{attendanceReportLoading?<div className="empty">Warbixinta waa la soo qaadanayaa...</div>:attendanceReportRows.length===0?<div className="empty">Xog lama helin ama wali lama soo qaadin. Riix “Soo qaad xogta”; hubi in attendance table-ku leeyahay diiwaanno.</div>:<div className="table-scroll"><table><thead><tr><th>Taariikh</th><th>Fasal</th><th>Student ID</th><th>Magaca</th><th>Xaaladda</th><th>Faallo</th></tr></thead><tbody>{attendanceReportRows.map((r:any)=><tr key={r.id}><td>{r.attendance_date}</td><td>{classes.find(c=>c.id===r.class_id)?.class_name||"—"}</td><td>{r.student?.student_code||"—"}</td><td>{r.student?.full_name||"Arday aan la helin"}</td><td>{r.status==="Present"?"Xaadir":r.status==="Absent"?"Maqan":r.status==="Late"?"Daahay":r.status}</td><td>{r.notes||"—"}</td></tr>)}</tbody></table></div>}</section>
          <section className="panel"><h3>Boqolleyda xaadirinta ardayda</h3><div className="panel-sub">Waxaa lagu xisaabiyaa diiwaannada ku jira shaandhaynta hadda. Daahay waxaa loo tirinayaa inuu yimid, maqanna looma tirinayo.</div><div className="table-scroll"><table><thead><tr><th>Student ID</th><th>Magaca</th><th>Xaadir</th><th>Daahay</th><th>Maqan</th><th>Diiwaanno</th><th>Boqolley</th></tr></thead><tbody>{attendanceSummaryRows.map((r:any)=><tr key={r.student.id}><td>{r.student.student_code}</td><td>{r.student.full_name}</td><td>{r.present}</td><td>{r.late}</td><td>{r.absent}</td><td>{r.total}</td><td><strong>{r.percent}%</strong></td></tr>)}</tbody></table></div></section>
        </>}
        {page === "Staff & Users" && <>
          <div className="welcome"><div><h2>Shaqaalaha iyo rukhsadaha</h2><p>Admin-ka keliya ayaa abuuri kara akoonnada, dooran kara role-ka, kuna maamuli kara isticmaalayaasha.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn btn-primary" onClick={()=>setStaffCreateOpen(v=>!v)} disabled={!isAdmin}><Plus size={15}/>{staffCreateOpen?"Xir foomka":"Abuur isticmaale"}</button><button className="btn" onClick={()=>void loadStaffProfiles()} disabled={staffLoading || !isAdmin}><Activity size={15}/>{staffLoading?"Waa la soo qaadanayaa...":"Cusboonaysii liiska"}</button></div></div>
          {!isAdmin ? <section className="panel"><div className="notice info">Qaybtan waxaa geli kara Admin oo keliya. Hubi in role-ka akoonkaaga ee profiles uu yahay `admin`.</div><button className="btn btn-primary" onClick={()=>void loadStaffProfiles()} disabled={staffLoading}>Xaqiiji Admin oo fur</button></section> : <>
          {staffCreateOpen && <section className="panel" style={{borderTop:"4px solid #f7931e",marginBottom:16}}><div className="panel-head"><div><h3>Abuur akoon cusub</h3><div className="panel-sub">Akoonka waxaa laga abuuraa Supabase Auth; password-ku lama soo bandhigayo kadib kaydinta.</div></div></div><form onSubmit={createStaffAccount}><div className="form-grid"><Field label="Magaca buuxa"><input required value={staffCreateForm.full_name} onChange={e=>setStaffCreateForm({...staffCreateForm,full_name:e.target.value})} placeholder="Magaca qofka"/></Field><Field label="Email-ka login-ka"><input required type="email" autoComplete="off" value={staffCreateForm.email} onChange={e=>setStaffCreateForm({...staffCreateForm,email:e.target.value})} placeholder="qof@example.com"/></Field><Field label="Password bilow ah (ugu yaraan 8 xaraf)"><input required minLength={8} type="password" autoComplete="new-password" value={staffCreateForm.password} onChange={e=>setStaffCreateForm({...staffCreateForm,password:e.target.value})} placeholder="Samee password adag"/></Field><Field label="Role / rukhsad"><select value={staffCreateForm.role} onChange={e=>setStaffCreateForm({...staffCreateForm,role:e.target.value})}><option value="admin">Admin — maamul buuxa</option><option value="registration_staff">Staff — diiwaangelinta ardayda</option><option value="teacher">Teacher — fasallo iyo xaadirin</option><option value="finance_staff">Accountant — lacagaha</option><option value="student">Student — akoon arday</option></select></Field></div><div className="notice info" style={{marginTop:12}}>Doorashada role-ka waxay kaydinaysaa role-ka qofka. Rukhsadaha database-ka waa in sidoo kale lagu xakameeyaa RLS ka hor inta aan la siin isticmaalayaasha dhabta ah.</div><div style={{display:"flex",gap:8,marginTop:14}}><button className="btn btn-primary" type="submit" disabled={staffCreateSaving}>{staffCreateSaving?"Akoonka waa la abuurayaa...":"Abuur akoon"}</button><button className="btn" type="button" onClick={()=>setStaffCreateOpen(false)}>Ka noqo</button></div></form></section>}
          <section className="panel" style={{borderTop:"4px solid #f7931e"}}>
            <div className="form-grid"><Field label="Raadi qof"><input value={staffSearch} onChange={e=>setStaffSearch(e.target.value)} placeholder="Magac, role ama ID"/></Field><Field label="Shaandhee role"><select value={staffRoleFilter} onChange={e=>setStaffRoleFilter(e.target.value)}><option value="all">Dhammaan doorarka</option><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="registration_staff">Staff</option><option value="finance_staff">Accountant</option><option value="student">Student</option></select></Field></div>
            <div className="panel-sub" style={{margin:"14px 0"}}>Akoonno: {staffProfiles.length} · Natiijooyin: {filteredStaffProfiles.length}. Isbeddel kasta waxa lagu kaydiyaa profiles ee Supabase.</div>
            {staffLoading ? <div className="empty">Liiska shaqaalaha waa la soo qaadanayaa...</div> : filteredStaffProfiles.length===0 ? <div className="empty">Akoon lama helin ama raadintaadu natiijo ma leh. Hubi profiles table iyo RLS.</div> : <div className="table-scroll"><table><thead><tr><th>Magaca</th><th>User ID</th><th>Role hadda</th><th>Role cusub</th><th>Rukhsadaha</th><th>Xaalad</th></tr></thead><tbody>{filteredStaffProfiles.map((profile:any)=><tr key={profile.id}><td><strong>{profile.full_name||"Magac lama gelin"}</strong>{profile.id===session?.user.id&&<div className="student-id">Akoonka aad hadda ku jirto</div>}</td><td><code style={{fontSize:11}}>{profile.id}</code></td><td>{profile.role||"staff"}</td><td><select aria-label={`Role-ka ${profile.full_name||profile.id}`} value={profile.role||"staff"} disabled={staffSavingId===profile.id || profile.id===session?.user.id} onChange={e=>void updateStaffRole(profile,e.target.value)}><option value="admin">Admin</option><option value="registration_staff">Staff — diiwaangelin</option><option value="teacher">Teacher — macallin</option><option value="finance_staff">Accountant — maaliyad</option><option value="student">Student — arday</option></select>{staffSavingId===profile.id&&<div className="student-id">Waa la kaydinayaa...</div>}</td><td><button type="button" className="btn" disabled={permissionsLoading} onClick={()=>void loadUserPermissions(profile)}>Maamul rukhsadaha</button></td><td>{profile.id===session?.user.id?"Adiga (lagama beddeli karo)":"Firfircoon haddii Auth account-ku jiro"}</td></tr>)}</tbody></table></div>}
            {permissionProfile && <section className="panel" style={{marginTop:18,borderTop:"4px solid #f7931e"}}>
              <div className="panel-head"><div><h3>Rukhsadaha gaarka ah</h3><div className="panel-sub">Isticmaale: {permissionProfile.full_name || permissionProfile.id} · Role: {permissionProfile.role}</div></div><button type="button" className="btn" onClick={()=>setPermissionProfile(null)}><X size={15}/> Xir</button></div>
              {permissionsLoading ? <div className="empty">Rukhsadaha waa la soo qaadanayaa...</div> : <>
                {permissionProfile.role === "admin" && <div className="notice info" style={{marginBottom:12}}>Akoonka Admin-ku wuxuu leeyahay awood maamul oo buuxda. Rukhsadahan gaarka ahi ma xaddidayaan awoodda Admin-ka.</div>}
                <div className="table-scroll"><table><thead><tr><th>Qaybta nidaamka</th>{permissionActions.map(action=><th key={action.key}>{action.label}</th>)}</tr></thead><tbody>
                  {permissionModules.map(module=><tr key={module.key}><td><strong>{module.label}</strong></td>{permissionActions.map(action=><td key={action.key}><input type="checkbox" aria-label={`${module.label}: ${action.label}`} checked={userPermissions[module.key]?.[action.key] === true} disabled={permissionsSaving || permissionProfile.role === "admin"} onChange={event=>setUserPermissions(current=>({...current,[module.key]:{...(current[module.key]||{}),[action.key]:event.target.checked}}))}/></td>)}</tr>)}
                </tbody></table></div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}><button type="button" className="btn" onClick={()=>void loadUserPermissions(permissionProfile)} disabled={permissionsSaving}>Dib u soo qaad</button><button type="button" className="btn btn-primary" onClick={()=>void saveUserPermissions()} disabled={permissionsSaving || permissionsLoading || permissionProfile.role === "admin"}>{permissionsSaving?"Waa la kaydinayaa...":"Kaydi rukhsadaha"}</button></div>
              </>}
            </section>}
            <div className="notice info" style={{marginTop:16}}><strong>Amniga:</strong> Ha siin qof role-ka Admin haddii aanu u baahnayn dhammaan awoodaha maamulka. Role-ka oo la beddelo keligiis ma abuuro login cusub, mana xaqiijinayo rukhsadaha bog kasta ilaa RLS iyo hubinta role-ka lagu dabaqo tables-kaas.</div>
          </section>
          </>}
        </>}
        {page === "KT Profile" && <>
          <div className="welcome"><div><h2>KT Profile</h2><p>Maamul magaca, xiriirka iyo xogta rasmiga ah ee Kaafi Tech ee warbixinnada.</p></div><button className="btn" onClick={()=>setPage("Dashboard")}>Ku noqo Dashboard</button></div>
          <section className="panel" style={{borderTop:"4px solid #f7931e"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}><div style={{width:64,height:64,borderRadius:18,background:"#fff0e2",color:"#c45b00",display:"grid",placeItems:"center",fontWeight:900,fontSize:22,border:"1px solid #fed7aa"}}>KT</div><div><h3 style={{margin:0}}>{ktProfile.organizationName || "Kaafi Tech and Media Center"}</h3><div className="panel-sub">{ktProfile.tagline || "Technology · Training · Media"}</div><div className="panel-sub">Profile-ka ururka · Settings-ka qalabkan</div></div></div>
            <form onSubmit={e=>{e.preventDefault();saveKtProfile();}}>
              <div className="form-grid">
                <Field label="Magaca buuxa ee xarunta"><input value={ktProfile.organizationName} onChange={e=>setKtProfile({...ktProfile,organizationName:e.target.value})} required/></Field>
                <Field label="Magaca gaaban / Brand"><input value={ktProfile.shortName} onChange={e=>setKtProfile({...ktProfile,shortName:e.target.value})} required/></Field>
                <Field label="Telefoonka rasmiga ah"><input type="tel" value={ktProfile.phone} onChange={e=>setKtProfile({...ktProfile,phone:e.target.value})} placeholder="+252..."/></Field>
                <Field label="Email-ka xarunta"><input type="email" value={ktProfile.email} onChange={e=>setKtProfile({...ktProfile,email:e.target.value})} placeholder="info@example.com"/></Field>
                <Field label="Cinwaanka xarunta"><input value={ktProfile.address} onChange={e=>setKtProfile({...ktProfile,address:e.target.value})} placeholder="Magaalo, xaafad, waddo"/></Field>
                <Field label="Website ama baraha bulshada"><input value={ktProfile.website} onChange={e=>setKtProfile({...ktProfile,website:e.target.value})} placeholder="https://..."/></Field>
                <Field label="Lambarka diiwaangelinta (haddii jiro)"><input value={ktProfile.registrationNumber} onChange={e=>setKtProfile({...ktProfile,registrationNumber:e.target.value})}/></Field>
                <Field label="Hal-ku-dhegga xarunta"><input value={ktProfile.tagline} onChange={e=>setKtProfile({...ktProfile,tagline:e.target.value})} placeholder="Technology · Training · Media"/></Field>
              </div>
              <div className="notice info" style={{marginTop:14}}>Fiiro gaar ah: noocan KT Profile waxaa lagu kaydiyaa browser-ka qalabkan oo keliya. Weli kuma xirna Supabase, mana wadaagaan si toos ah kombiyuutarro kale.</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}><button className="btn btn-primary" type="submit"><Check size={15}/> Kaydi KT Profile</button><button className="btn" type="button" onClick={()=>{setKtProfile({organizationName:"Kaafi Tech and Media Center",shortName:"KAAFI TECH",phone:"",email:"",address:"",website:"",registrationNumber:"",tagline:"Technology · Training · Media"});setKtProfileSaved(false);}}><X size={15}/> Dib u deji</button>{ktProfileSaved&&<span className="pill">Waa la kaydiyey</span>}</div>
            </form>
          </section>
        </>}
        {page === "Settings" && <>
          <div className="welcome"><div><h2>Dejinta nidaamka</h2><p>Meel dhexe oo aad ka maamusho xogta xarunta, akoonkaaga iyo diyaargarowga online-ka.</p></div><button className="btn" onClick={()=>void refreshDashboardData()} disabled={dashboardRefreshing}>{dashboardRefreshing ? "Waa la cusboonaysiinayaa…" : "Cusboonaysii xogta"}</button></div>
          <section className="panel" style={{borderTop:"4px solid #f7931e"}}>
            <div className="panel-head"><div><h3>Xaaladda nidaamka</h3><div className="panel-sub">Xogta hoose waxay ka tarjumaysaa xaaladda app-kan hadda furan.</div></div></div>
            <div className="metric-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
              <div className="metric-card"><div className="panel-sub">Akoonka</div><strong>{session?.user?.email || "Lama xaqiijin"}</strong><div className="panel-sub">{session ? "Login waa shaqaynayaa" : "Ma jiro session firfircoon"}</div></div>
              <div className="metric-card"><div className="panel-sub">Xiriirka xogta</div><strong>{connected ? "Xogta waa la helay" : "Xiriirka lama xaqiijin"}</strong><div className="panel-sub">{connected ? `${students.length} arday ayaa la soo qaaday` : "Isticmaal Cusboonaysii xogta si aad u tijaabiso"}</div></div>
              <div className="metric-card"><div className="panel-sub">Awoodda maamulka</div><strong>{isAdmin ? "Admin" : "Isticmaale caadi ah"}</strong><div className="panel-sub">Qaybaha maamulka waxay ku xiran yihiin role-kaaga.</div></div>
            </div>
            <div className="notice info" style={{marginTop:14}}>Ogow: calaamadaha kore waxay xaqiijinayaan kaliya xaaladda app-ka ee hadda; ma aha tijaabo buuxda oo deployment-ka, domain-ka ama Supabase RLS ah.</div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><h3>Dejimaha muhiimka ah</h3><div className="panel-sub">Fur qaybta aad rabto adigoon lumin xogta hadda jirta.</div></div></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
              <button className="btn" style={{height:"auto",minHeight:92,padding:16,display:"block",textAlign:"left"}} onClick={()=>{setPage("KT Profile");setMessage("");}}><strong style={{display:"block",marginBottom:6}}>KT Profile</strong><span className="panel-sub">Magaca xarunta, telefoonka, email-ka, cinwaanka iyo xogta brand-ka.</span></button>
              <button className="btn" style={{height:"auto",minHeight:92,padding:16,display:"block",textAlign:"left"}} onClick={()=>{setPage("Staff & Users");setMessage("");void loadStaffProfiles();}}><strong style={{display:"block",marginBottom:6}}>Shaqaalaha iyo rukhsadaha</strong><span className="panel-sub">Maamul akoonnada iyo rukhsadaha. Admin oo keliya ayaa heli kara.</span></button>
              <button className="btn" style={{height:"auto",minHeight:92,padding:16,display:"block",textAlign:"left"}} onClick={()=>setPage("Dashboard")}><strong style={{display:"block",marginBottom:6}}>Dashboard</strong><span className="panel-sub">Ku noqo warbixinta guud iyo tirakoobka xarunta.</span></button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><h3>Liiska hubinta ka hor inta aan online la gelin</h3><div className="panel-sub">Qodobadan ka xaqiiji deployment-kaaga; boggan si toos ah uma beddelayo server settings-ka.</div></div></div>
            <ul style={{paddingLeft:20,lineHeight:1.9,marginBottom:12}}>
              <li><strong>Environment variables:</strong> geli Supabase URL iyo anon/publishable key gudaha hosting provider-ka.</li>
              <li><strong>Service role key:</strong> ha gelin `NEXT_PUBLIC_` variables, browser code, ama Git repository; ku hay server-side secret oo keliya.</li>
              <li><strong>Supabase Auth URLs:</strong> deji Site URL iyo Redirect URLs si waafaqsan domain-ka online-ka.</li>
              <li><strong>Database security:</strong> hubi RLS policies iyo rukhsadaha tables-ka, gaar ahaan students, payments iyo profiles.</li>
              <li><strong>Build test:</strong> ka hor publish, ku orod `npm run build` oo sax khaladaadka TypeScript/build-ka.</li>
              <li><strong>Profile-ka xarunta:</strong> KT Profile hadda waxa lagu kaydiyaa browser-kan oo keliya; ma wadaago dejimaha kombiyuutarrada kale ilaa kaydinta Supabase lagu xiro.</li>
            </ul>
            <div className="notice info">Amni: ha ku qorin password, Supabase service role key, ama sir kale meel ka mid ah Settings-ka browser-ka. Boggan ma kaydinayo sirahaas.</div>
          </section>
        </>}
        {! ["Dashboard","Students","Register Student","Classes & Timetable","Attendance","Fees & Payments","Student Reports","Attendance Reports","Books Management","Staff & Users","Settings","KT Profile"].includes(page) && !showForm && <section className="panel"><div className="panel-head"><div><h3>{titles[page]}</h3><div className="panel-sub">Qaybtan lama hirgelin.</div></div></div><button className="btn" onClick={()=>setPage("Dashboard")}>Ku laabo Dashboard</button></section>}
      </div>
    </main>
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="field"><span>{label}</span>{children}</label>; }
function StudentTable({students,onEdit,onDelete,onReport,onExport}:{students:Student[];onEdit:(student:Student)=>void;onDelete:(student:Student)=>void|Promise<void>;onReport:(student:Student)=>void|Promise<void>;onExport:(student:Student)=>void|Promise<void>}) {
  if(!students.length) return <div className="empty">Weli arday kuma jiro database-ka, ama raadintaadu wax natiijo ah ma helin.</div>;
  return <div className="table-scroll"><table><thead><tr><th>Student ID</th><th>Magaca</th><th>Tel</th><th>Koorso</th><th>Fee</th><th>Lacagta bishan</th><th>Status</th><th>Hawlgal</th></tr></thead><tbody>{students.map(s=><tr key={s.id}><td>{s.student_code}</td><td><div className="student-name">{s.full_name}</div><div className="student-id">{s.neighborhood||"—"}</div></td><td>{s.phone||"—"}</td><td>{s.course_name||"—"}</td><td>{money(Number(s.course_fee||0))}</td><td><span className={`pill ${s.monthly_payment_status==="Paid"?"":"warn"}`}>{s.monthly_payment_status||"Unpaid"}</span></td><td>{s.status}</td><td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button type="button" className="btn" onClick={()=>onEdit(s)}>Edit</button><button type="button" className="btn" onClick={()=>void onReport(s)} title="Daabac warbixinta ardayga"><Printer size={14}/> Report</button><button type="button" className="btn" onClick={()=>void onExport(s)} title="Soo dejiso xogta ardayga"><Download size={14}/> Export</button><button type="button" className="btn" onClick={()=>void onDelete(s)}>Delete</button></div></td></tr>)}</tbody></table></div>;
}