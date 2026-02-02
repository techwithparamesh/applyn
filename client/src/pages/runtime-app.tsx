import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  currency: string;
  priceCents: number;
};

type AppPublic = {
  id: string;
  name: string;
  industry?: string | null;
  primaryColor?: string | null;
};

type Service = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  currency: string;
  priceCents: number;
  durationMinutes: number;
};

type Appointment = {
  id: string;
  status: string;
  serviceId: string;
  serviceName: string | null;
  currency: string;
  priceCents: number;
  startAt: string;
  endAt: string;
  paymentProvider: string | null;
  paymentStatus: string;
};

type Order = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentStatus: string;
  createdAt: string;
};

type Post = {
  id: string;
  type: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string | null;
  category: string | null;
  publishedAt: string | null;
};

type RestaurantReservation = {
  id: string;
  status: string;
  partySize: number;
  reservedAt: string;
  notes: string;
};

type FitnessClass = {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
};

type FitnessBooking = {
  id: string;
  status: string;
  classId: string;
  className: string | null;
  startsAt: string | null;
};

type Course = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
};

type Lesson = {
  id: string;
  courseId: string;
  title: string;
  contentUrl: string | null;
  sortOrder: number;
};

type Enrollment = {
  id: string;
  status: string;
  courseId: string;
  courseTitle: string | null;
};

type Listing = {
  id: string;
  title: string;
  description: string;
  address: string;
  currency: string;
  priceCents: number;
  imageUrl: string | null;
};

type SavedItem = {
  id: string;
  kind: string;
  itemId: string;
  createdAt: string;
};

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  imageUrl: string | null;
};

type DoctorAppointment = {
  id: string;
  status: string;
  doctorId: string;
  doctorName: string | null;
  specialty: string | null;
  startAt: string;
  endAt: string;
};

type RadioStation = {
  id: string;
  name: string;
  streamUrl: string;
  imageUrl: string | null;
};

type PodcastEpisode = {
  id: string;
  showTitle: string | null;
  title: string;
  description: string;
  audioUrl: string | null;
  publishedAt: string | null;
};

type MusicAlbum = {
  id: string;
  title: string;
  artist: string;
  imageUrl: string | null;
  releasedAt: string | null;
};

type MusicTrack = {
  id: string;
  albumId: string;
  title: string;
  trackNumber: number;
  durationSeconds: number;
  audioUrl: string | null;
};

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

function tokenKey(appId: string) {
  return `runtime_token:${appId}`;
}

async function runtimeFetch<T>(url: string, opts?: RequestInit & { token?: string | null }) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts?.headers ?? {}),
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = res.statusText || "Request failed";
    try {
      const json = text ? JSON.parse(text) : null;
      if (json?.message) msg = json.message;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export default function RuntimeApp() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();

  const [appMeta, setAppMeta] = useState<AppPublic | null>(null);

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey(appId)));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentProvider, setPaymentProvider] = useState<"cod" | "razorpay">("cod");

  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [bookingStartAt, setBookingStartAt] = useState<string>("");

  const [posts, setPosts] = useState<Post[]>([]);
  const [bookmarks, setBookmarks] = useState<Post[]>([]);

  const [reservations, setReservations] = useState<RestaurantReservation[]>([]);
  const [reservationAt, setReservationAt] = useState<string>("");
  const [partySize, setPartySize] = useState<number>(2);

  const [classes, setClasses] = useState<FitnessClass[]>([]);
  const [classBookings, setClassBookings] = useState<FitnessBooking[]>([]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [listings, setListings] = useState<Listing[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [inquiryName, setInquiryName] = useState<string>("");
  const [inquiryEmail, setInquiryEmail] = useState<string>("");
  const [inquiryPhone, setInquiryPhone] = useState<string>("");
  const [inquiryMessage, setInquiryMessage] = useState<string>("");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorAppointments, setDoctorAppointments] = useState<DoctorAppointment[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [doctorStartAt, setDoctorStartAt] = useState<string>("");

  const [stations, setStations] = useState<RadioStation[]>([]);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);

  const [albums, setAlbums] = useState<MusicAlbum[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);

  const [leadName, setLeadName] = useState<string>("");
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadPhone, setLeadPhone] = useState<string>("");
  const [leadMessage, setLeadMessage] = useState<string>("");

  const cartItems = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return Object.entries(cart)
      .map(([productId, quantity]) => ({ product: byId.get(productId)!, productId, quantity }))
      .filter((x) => !!x.product);
  }, [cart, products]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem(tokenKey(appId), token ?? "");
  }, [appId, token]);

  async function loadAppMeta() {
    const data = await runtimeFetch<AppPublic>(`/api/apps/${appId}/public-preview`);
    setAppMeta({ id: data.id, name: data.name, industry: data.industry ?? null, primaryColor: data.primaryColor ?? null });
  }

  async function loadProducts() {
    const data = await runtimeFetch<Product[]>(`/api/runtime/${appId}/products`);
    setProducts(data);
  }

  async function loadServices() {
    const data = await runtimeFetch<Service[]>(`/api/runtime/${appId}/services`);
    setServices(data);
    if (!selectedServiceId && data.length) setSelectedServiceId(data[0].id);
  }

  async function loadAppointments() {
    if (!token) return;
    const data = await runtimeFetch<Appointment[]>(`/api/runtime/${appId}/appointments`, { token });
    setAppointments(data);
  }

  async function loadPosts(type?: string) {
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    const data = await runtimeFetch<Post[]>(`/api/runtime/${appId}/posts${qs}`);
    setPosts(data);
  }

  async function loadBookmarks() {
    if (!token) return;
    const data = await runtimeFetch<Post[]>(`/api/runtime/${appId}/bookmarks`, { token });
    setBookmarks(data);
  }

  async function loadReservations() {
    if (!token) return;
    const data = await runtimeFetch<RestaurantReservation[]>(`/api/runtime/${appId}/reservations`, { token });
    setReservations(data);
  }

  async function loadClasses() {
    const data = await runtimeFetch<FitnessClass[]>(`/api/runtime/${appId}/classes`);
    setClasses(data);
  }

  async function loadClassBookings() {
    if (!token) return;
    const data = await runtimeFetch<FitnessBooking[]>(`/api/runtime/${appId}/class-bookings`, { token });
    setClassBookings(data);
  }

  async function loadCourses() {
    const data = await runtimeFetch<Course[]>(`/api/runtime/${appId}/courses`);
    setCourses(data);
    if (!selectedCourseId && data.length) setSelectedCourseId(data[0].id);
  }

  async function loadLessons(courseId: string) {
    const data = await runtimeFetch<Lesson[]>(`/api/runtime/${appId}/courses/${courseId}/lessons`);
    setLessons(data);
  }

  async function loadEnrollments() {
    if (!token) return;
    const data = await runtimeFetch<Enrollment[]>(`/api/runtime/${appId}/enrollments`, { token });
    setEnrollments(data);
  }

  async function loadListings() {
    const data = await runtimeFetch<Listing[]>(`/api/runtime/${appId}/listings`);
    setListings(data);
  }

  async function loadSaved() {
    if (!token) return;
    const data = await runtimeFetch<SavedItem[]>(`/api/runtime/${appId}/saved`, { token });
    setSavedItems(data);
  }

  async function loadDoctors() {
    const data = await runtimeFetch<Doctor[]>(`/api/runtime/${appId}/doctors`);
    setDoctors(data);
    if (!selectedDoctorId && data.length) setSelectedDoctorId(data[0].id);
  }

  async function loadDoctorAppointments() {
    if (!token) return;
    const data = await runtimeFetch<DoctorAppointment[]>(`/api/runtime/${appId}/doctor-appointments`, { token });
    setDoctorAppointments(data);
  }

  async function loadRadio() {
    const [s, e] = await Promise.all([
      runtimeFetch<RadioStation[]>(`/api/runtime/${appId}/radio/stations`),
      runtimeFetch<PodcastEpisode[]>(`/api/runtime/${appId}/radio/episodes`),
    ]);
    setStations(s);
    setEpisodes(e);
  }

  async function loadMusic() {
    const a = await runtimeFetch<MusicAlbum[]>(`/api/runtime/${appId}/music/albums`);
    setAlbums(a);
    if (!selectedAlbumId && a.length) setSelectedAlbumId(a[0].id);
  }

  async function loadTracks(albumId: string) {
    const t = await runtimeFetch<MusicTrack[]>(`/api/runtime/${appId}/music/albums/${albumId}/tracks`);
    setTracks(t);
  }

  async function loadOrders() {
    if (!token) return;
    const data = await runtimeFetch<Order[]>(`/api/runtime/${appId}/orders`, { token });
    setOrders(data);
  }

  useEffect(() => {
    loadAppMeta().catch(() => void 0);
    // Most modules are public; they should load even when not logged in.
    loadProducts().catch(() => void 0);
    loadServices().catch(() => void 0);
    loadPosts().catch(() => void 0);
    loadClasses().catch(() => void 0);
    loadCourses().catch(() => void 0);
    loadListings().catch(() => void 0);
    loadDoctors().catch(() => void 0);
    loadRadio().catch(() => void 0);
    loadMusic().catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  useEffect(() => {
    if (selectedCourseId) loadLessons(selectedCourseId).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedAlbumId) loadTracks(selectedAlbumId).catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbumId]);

  useEffect(() => {
    loadOrders().catch(() => void 0);
    loadAppointments().catch(() => void 0);
    loadBookmarks().catch(() => void 0);
    loadReservations().catch(() => void 0);
    loadClassBookings().catch(() => void 0);
    loadEnrollments().catch(() => void 0);
    loadSaved().catch(() => void 0);
    loadDoctorAppointments().catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function register() {
    const data = await runtimeFetch<{ token: string }>(`/api/runtime/${appId}/auth/register`, {
      method: "POST",
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    setToken(data.token);
    toast({ title: "Registered" });
    await loadOrders().catch(() => void 0);
    await loadAppointments().catch(() => void 0);
  }

  async function login() {
    const data = await runtimeFetch<{ token: string }>(`/api/runtime/${appId}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    toast({ title: "Logged in" });
    await loadOrders().catch(() => void 0);
    await loadAppointments().catch(() => void 0);
  }

  async function bookAppointment() {
    if (!token) throw new Error("Login required");
    if (!selectedServiceId) throw new Error("Select a service");
    if (!bookingStartAt) throw new Error("Select a time");

    await runtimeFetch(`/api/runtime/${appId}/appointments`, {
      method: "POST",
      token,
      body: JSON.stringify({
        serviceId: selectedServiceId,
        startAt: new Date(bookingStartAt).toISOString(),
        paymentProvider: "cod",
      }),
    });
    toast({ title: "Booking requested" });
    setBookingStartAt("");
    await loadAppointments();
  }

  async function toggleBookmark(postId: string, on: boolean) {
    if (!token) throw new Error("Login required");
    await runtimeFetch(`/api/runtime/${appId}/posts/${postId}/bookmark`, {
      method: "POST",
      token,
      body: JSON.stringify({ on }),
    });
    await loadBookmarks();
  }

  async function createReservation() {
    if (!token) throw new Error("Login required");
    if (!reservationAt) throw new Error("Select a time");
    await runtimeFetch(`/api/runtime/${appId}/reservations`, {
      method: "POST",
      token,
      body: JSON.stringify({ reservedAt: new Date(reservationAt).toISOString(), partySize }),
    });
    toast({ title: "Reservation requested" });
    setReservationAt("");
    await loadReservations();
  }

  async function bookClass(classId: string) {
    if (!token) throw new Error("Login required");
    await runtimeFetch(`/api/runtime/${appId}/classes/${classId}/book`, {
      method: "POST",
      token,
    });
    toast({ title: "Class booked" });
    await loadClassBookings();
  }

  async function enroll(courseId: string) {
    if (!token) throw new Error("Login required");
    await runtimeFetch(`/api/runtime/${appId}/courses/${courseId}/enroll`, {
      method: "POST",
      token,
    });
    toast({ title: "Enrolled" });
    await loadEnrollments();
  }

  async function sendInquiry(listingId: string) {
    await runtimeFetch(`/api/runtime/${appId}/listings/${listingId}/inquiries`, {
      method: "POST",
      body: JSON.stringify({
        name: inquiryName || undefined,
        email: inquiryEmail || undefined,
        phone: inquiryPhone || undefined,
        message: inquiryMessage || undefined,
      }),
      token,
    });
    toast({ title: "Inquiry sent" });
    setInquiryMessage("");
  }

  async function toggleSaved(kind: string, itemId: string, on: boolean) {
    if (!token) throw new Error("Login required");
    await runtimeFetch(`/api/runtime/${appId}/saved`, {
      method: "POST",
      token,
      body: JSON.stringify({ kind, itemId, on }),
    });
    await loadSaved();
  }

  async function bookDoctor() {
    if (!token) throw new Error("Login required");
    if (!selectedDoctorId) throw new Error("Select a doctor");
    if (!doctorStartAt) throw new Error("Select a time");
    await runtimeFetch(`/api/runtime/${appId}/doctor-appointments`, {
      method: "POST",
      token,
      body: JSON.stringify({ doctorId: selectedDoctorId, startAt: new Date(doctorStartAt).toISOString() }),
    });
    toast({ title: "Appointment requested" });
    setDoctorStartAt("");
    await loadDoctorAppointments();
  }

  async function submitLead() {
    await runtimeFetch(`/api/runtime/${appId}/leads`, {
      method: "POST",
      body: JSON.stringify({
        name: leadName || undefined,
        email: leadEmail || undefined,
        phone: leadPhone || undefined,
        message: leadMessage || undefined,
      }),
    });
    toast({ title: "Message sent" });
    setLeadMessage("");
  }

  async function placeOrder() {
    if (!token) throw new Error("Login required");
    const items = cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const data = await runtimeFetch<any>(`/api/runtime/${appId}/orders`, {
      method: "POST",
      token,
      body: JSON.stringify({ items, paymentProvider }),
    });

    if (paymentProvider === "cod") {
      toast({ title: "Order placed", description: data?.id });
      setCart({});
      await loadOrders();
      return;
    }

    // Razorpay flow
    const createdOrderId = String(data?.id || "");
    if (!createdOrderId) throw new Error("Order creation failed");

    const pay = await runtimeFetch<any>(`/api/runtime/${appId}/orders/${createdOrderId}/pay/razorpay`, {
      method: "POST",
      token,
    });

    await loadRazorpayScript();
    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) throw new Error("Razorpay is unavailable");

    const rzp = new Razorpay({
      key: pay?.keyId,
      amount: pay?.order?.amount,
      currency: pay?.order?.currency,
      order_id: pay?.order?.id,
      name: "Checkout",
      prefill: { email },
      handler: async (response: any) => {
        try {
          await runtimeFetch(`/api/runtime/${appId}/orders/${createdOrderId}/pay/razorpay/verify`, {
            method: "POST",
            token,
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          toast({ title: "Payment successful" });
          setCart({});
          await loadOrders();
        } catch (e: any) {
          toast({ title: "Verify failed", description: e?.message || "Please refresh", variant: "destructive" });
          await loadOrders().catch(() => void 0);
        }
      },
    });

    rzp.open();
  }

  function addToCart(productId: string) {
    setCart((c) => ({ ...c, [productId]: (c[productId] ?? 0) + 1 }));
  }

  function logout() {
    setToken(null);
    localStorage.removeItem(tokenKey(appId));
    setOrders([]);
    setAppointments([]);
  }

  const industry = String(appMeta?.industry || "").toLowerCase();
  const mode = useMemo(() => {
    if (["salon", "photography"].includes(industry)) return "booking";
    if (industry === "business") return "business";
    if (industry === "restaurant") return "restaurant";
    if (industry === "news") return "news";
    if (industry === "church") return "church";
    if (industry === "radio") return "radio";
    if (industry === "fitness") return "fitness";
    if (industry === "education") return "education";
    if (industry === "realestate") return "realestate";
    if (industry === "healthcare") return "healthcare";
    if (industry === "music") return "music";
    return "ecommerce";
  }, [industry]);

  const supportsOrders = mode === "ecommerce" || mode === "restaurant" || mode === "music";
  const supportsServices = mode === "booking";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 md:px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Runtime App Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!token ? (
                    <>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Name (optional)</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => register().catch((e) => toast({ title: "Register failed", description: e.message }))}
                          disabled={!email || !password}
                        >
                          Register
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => login().catch((e) => toast({ title: "Login failed", description: e.message }))}
                          disabled={!email || !password}
                        >
                          Login
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Logged in</div>
                      <Button variant="outline" onClick={logout}>
                        Logout
                      </Button>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">Industry: {industry || "(unknown)"}</div>
                </CardContent>
              </Card>

              {supportsServices ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Book a Service</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Service</Label>
                      <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Date & time</Label>
                      <Input type="datetime-local" value={bookingStartAt} onChange={(e) => setBookingStartAt(e.target.value)} />
                    </div>

                    <Button
                      onClick={() => bookAppointment().catch((e) => toast({ title: "Booking failed", description: e.message, variant: "destructive" }))}
                      disabled={!selectedServiceId || !bookingStartAt}
                    >
                      Book
                    </Button>

                    {!!token && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="font-medium">My appointments</div>
                          {!appointments.length ? (
                            <div className="text-sm text-muted-foreground">No bookings yet</div>
                          ) : (
                            <div className="space-y-2">
                              {appointments.slice(0, 6).map((a) => (
                                <div key={a.id} className="border rounded-md p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium truncate">{a.serviceName || "Service"}</div>
                                    <div className="text-xs text-muted-foreground">{a.status}</div>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {new Date(a.startAt).toLocaleString()} – {new Date(a.endAt).toLocaleTimeString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : mode === "healthcare" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Book Doctor</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Doctor</Label>
                      <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a doctor" />
                        </SelectTrigger>
                        <SelectContent>
                          {doctors.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} {d.specialty ? `• ${d.specialty}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date & time</Label>
                      <Input type="datetime-local" value={doctorStartAt} onChange={(e) => setDoctorStartAt(e.target.value)} />
                    </div>
                    <Button
                      onClick={() => bookDoctor().catch((e) => toast({ title: "Booking failed", description: e.message, variant: "destructive" }))}
                      disabled={!selectedDoctorId || !doctorStartAt}
                    >
                      Request Appointment
                    </Button>
                  </CardContent>
                </Card>
              ) : mode === "restaurant" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Reserve a Table</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Date & time</Label>
                      <Input type="datetime-local" value={reservationAt} onChange={(e) => setReservationAt(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Party size</Label>
                      <Input type="number" value={partySize} onChange={(e) => setPartySize(Number(e.target.value || 2))} />
                    </div>
                    <Button
                      onClick={() => createReservation().catch((e) => toast({ title: "Reservation failed", description: e.message, variant: "destructive" }))}
                      disabled={!reservationAt}
                    >
                      Request Reservation
                    </Button>

                    {!!token && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="font-medium">My reservations</div>
                          {!reservations.length ? (
                            <div className="text-sm text-muted-foreground">No reservations yet</div>
                          ) : (
                            <div className="space-y-2">
                              {reservations.slice(0, 6).map((r) => (
                                <div key={r.id} className="border rounded-md p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium">Party of {r.partySize}</div>
                                    <div className="text-xs text-muted-foreground">{r.status}</div>
                                  </div>
                                  <div className="text-sm text-muted-foreground">{new Date(r.reservedAt).toLocaleString()}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : mode === "fitness" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Classes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {classes.map((c) => (
                      <div key={c.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-sm text-muted-foreground truncate">{c.description}</div>
                          <div className="text-sm text-muted-foreground">{new Date(c.startsAt).toLocaleString()}</div>
                        </div>
                        <Button variant="outline" onClick={() => bookClass(c.id).catch((e) => toast({ title: "Booking failed", description: e.message }))}>
                          Book
                        </Button>
                      </div>
                    ))}
                    {!classes.length && <div className="text-sm text-muted-foreground">No classes available</div>}
                    {!!token && (
                      <>
                        <Separator />
                        <div className="font-medium">My bookings</div>
                        {!classBookings.length ? (
                          <div className="text-sm text-muted-foreground">No bookings yet</div>
                        ) : (
                          <div className="space-y-2">
                            {classBookings.slice(0, 6).map((b) => (
                              <div key={b.id} className="border rounded-md p-3">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium truncate">{b.className ?? "Class"}</div>
                                  <div className="text-xs text-muted-foreground">{b.status}</div>
                                </div>
                                {!!b.startsAt && <div className="text-sm text-muted-foreground">{new Date(b.startsAt).toLocaleString()}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : mode === "education" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Courses</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Course</Label>
                      <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a course" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => enroll(selectedCourseId).catch((e) => toast({ title: "Enroll failed", description: e.message }))}
                      disabled={!selectedCourseId}
                    >
                      Enroll
                    </Button>
                    <Separator />
                    <div className="space-y-2">
                      <div className="font-medium">Lessons</div>
                      {!lessons.length ? (
                        <div className="text-sm text-muted-foreground">No lessons</div>
                      ) : (
                        <div className="space-y-2">
                          {lessons.map((l) => (
                            <div key={l.id} className="border rounded-md p-3">
                              <div className="font-medium">{l.title}</div>
                              {l.contentUrl && (
                                <a className="text-sm text-primary underline" href={l.contentUrl} target="_blank" rel="noreferrer">
                                  Open content
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {!!token && (
                      <>
                        <Separator />
                        <div className="font-medium">My enrollments</div>
                        {!enrollments.length ? (
                          <div className="text-sm text-muted-foreground">No enrollments yet</div>
                        ) : (
                          <div className="space-y-2">
                            {enrollments.slice(0, 6).map((e) => (
                              <div key={e.id} className="border rounded-md p-3 flex items-center justify-between">
                                <div className="font-medium truncate">{e.courseTitle ?? e.courseId}</div>
                                <div className="text-xs text-muted-foreground">{e.status}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : mode === "realestate" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Properties</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {listings.slice(0, 4).map((l) => {
                      const isSaved = savedItems.some((s) => s.kind === "listing" && s.itemId === l.id);
                      return (
                        <div key={l.id} className="border rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium truncate">{l.title}</div>
                            <Button
                              variant="outline"
                              onClick={() => toggleSaved("listing", l.id, !isSaved).catch((e) => toast({ title: "Save failed", description: e.message }))}
                            >
                              {isSaved ? "Unsave" : "Save"}
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{l.address}</div>
                          <div className="text-sm">{(l.priceCents / 100).toFixed(2)} {l.currency}</div>
                          <Separator />
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Inquiry</div>
                            <Input placeholder="Your name" value={inquiryName} onChange={(e) => setInquiryName(e.target.value)} />
                            <Input placeholder="Email" value={inquiryEmail} onChange={(e) => setInquiryEmail(e.target.value)} />
                            <Input placeholder="Phone" value={inquiryPhone} onChange={(e) => setInquiryPhone(e.target.value)} />
                            <Input placeholder="Message" value={inquiryMessage} onChange={(e) => setInquiryMessage(e.target.value)} />
                            <Button onClick={() => sendInquiry(l.id).catch((e) => toast({ title: "Inquiry failed", description: e.message }))}>
                              Send
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {!listings.length && <div className="text-sm text-muted-foreground">No listings available</div>}
                  </CardContent>
                </Card>
              ) : mode === "radio" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Radio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="font-medium">Stations</div>
                      {!stations.length ? (
                        <div className="text-sm text-muted-foreground">No stations</div>
                      ) : (
                        <div className="space-y-3">
                          {stations.map((s) => (
                            <div key={s.id} className="border rounded-md p-3 space-y-2">
                              <div className="font-medium">{s.name}</div>
                              <audio controls src={s.streamUrl} className="w-full" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="font-medium">Podcasts</div>
                      {!episodes.length ? (
                        <div className="text-sm text-muted-foreground">No episodes</div>
                      ) : (
                        <div className="space-y-3">
                          {episodes.slice(0, 5).map((e) => (
                            <div key={e.id} className="border rounded-md p-3 space-y-2">
                              <div className="font-medium">{e.title}</div>
                              <div className="text-sm text-muted-foreground">{e.showTitle ?? "Podcast"}</div>
                              {e.audioUrl && <audio controls src={e.audioUrl} className="w-full" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : mode === "music" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Music</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Album</Label>
                      <Select value={selectedAlbumId} onValueChange={setSelectedAlbumId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an album" />
                        </SelectTrigger>
                        <SelectContent>
                          {albums.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium">Tracks</div>
                      {!tracks.length ? (
                        <div className="text-sm text-muted-foreground">No tracks</div>
                      ) : (
                        <div className="space-y-2">
                          {tracks.map((t) => (
                            <div key={t.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{t.trackNumber}. {t.title}</div>
                                <div className="text-xs text-muted-foreground">{Math.round(t.durationSeconds / 60)} min</div>
                              </div>
                              {t.audioUrl && <audio controls src={t.audioUrl} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : mode === "news" || mode === "church" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{mode === "news" ? "News" : "Content"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {posts.slice(0, 6).map((p) => {
                      const isBookmarked = bookmarks.some((b) => b.id === p.id);
                      return (
                        <div key={p.id} className="border rounded-md p-3 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{p.title}</div>
                              <div className="text-sm text-muted-foreground line-clamp-2">{p.excerpt}</div>
                            </div>
                            {mode === "news" && (
                              <Button
                                variant="outline"
                                onClick={() => toggleBookmark(p.id, !isBookmarked).catch((e) => toast({ title: "Bookmark failed", description: e.message }))}
                              >
                                {isBookmarked ? "Unsave" : "Save"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!posts.length && <div className="text-sm text-muted-foreground">No posts yet</div>}
                    {mode === "news" && !!token && (
                      <>
                        <Separator />
                        <div className="font-medium">Saved</div>
                        {!bookmarks.length ? (
                          <div className="text-sm text-muted-foreground">No saved posts</div>
                        ) : (
                          <div className="space-y-2">
                            {bookmarks.slice(0, 5).map((b) => (
                              <div key={b.id} className="border rounded-md p-3">
                                <div className="font-medium truncate">{b.title}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : mode === "business" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input placeholder="Your name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
                    <Input placeholder="Email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
                    <Input placeholder="Phone" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} />
                    <Input placeholder="Message" value={leadMessage} onChange={(e) => setLeadMessage(e.target.value)} />
                    <Button onClick={() => submitLead().catch((e) => toast({ title: "Send failed", description: e.message }))}>Send</Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            {supportsOrders && (
              <>
                <Separator />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{mode === "restaurant" ? "Menu" : "Catalog"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {products.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-sm text-muted-foreground truncate">{p.description}</div>
                            <div className="text-sm">
                              {(p.priceCents / 100).toFixed(2)} {p.currency}
                            </div>
                          </div>
                          <Button onClick={() => addToCart(p.id)}>Add</Button>
                        </div>
                      ))}
                      {!products.length && <div className="text-sm text-muted-foreground">No items available</div>}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Cart</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cartItems.map((i) => (
                              <TableRow key={i.productId}>
                                <TableCell className="font-medium">{i.product.name}</TableCell>
                                <TableCell>{i.quantity}</TableCell>
                                <TableCell>
                                  {((i.product.priceCents * i.quantity) / 100).toFixed(2)} {i.product.currency}
                                </TableCell>
                              </TableRow>
                            ))}
                            {!cartItems.length && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-muted-foreground">
                                  Cart is empty
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Total: {(cartTotal / 100).toFixed(2)} {products[0]?.currency ?? "INR"}</div>
                        <div className="flex items-center gap-3">
                          <Select value={paymentProvider} onValueChange={(v) => setPaymentProvider(v as any)}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cod">COD</SelectItem>
                              <SelectItem value="razorpay">Razorpay</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button onClick={() => placeOrder().catch((e) => toast({ title: "Order failed", description: e.message }))} disabled={!cartItems.length}>
                            {paymentProvider === "cod" ? "Place COD Order" : "Pay with Razorpay"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {supportsOrders && !!token && (
              <>
                <Separator />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">My Orders</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Payment</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((o) => (
                            <TableRow key={o.id}>
                              <TableCell className="font-mono text-xs">{o.id}</TableCell>
                              <TableCell>{(o.totalCents / 100).toFixed(2)} {o.currency}</TableCell>
                              <TableCell>{o.status}</TableCell>
                              <TableCell>{o.paymentProvider ?? "-"} / {o.paymentStatus}</TableCell>
                            </TableRow>
                          ))}
                          {!orders.length && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-muted-foreground">No orders yet</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <Button variant="outline" onClick={() => loadOrders().catch((e) => toast({ title: "Refresh failed", description: e.message }))}>
                      Refresh
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {mode === "healthcare" && !!token && (
              <>
                <Separator />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">My Doctor Appointments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!doctorAppointments.length ? (
                      <div className="text-sm text-muted-foreground">No appointments yet</div>
                    ) : (
                      <div className="space-y-2">
                        {doctorAppointments.slice(0, 6).map((a) => (
                          <div key={a.id} className="border rounded-md p-3">
                            <div className="flex items-center justify-between">
                              <div className="font-medium truncate">{a.doctorName ?? "Doctor"}</div>
                              <div className="text-xs text-muted-foreground">{a.status}</div>
                            </div>
                            <div className="text-sm text-muted-foreground">{new Date(a.startAt).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
