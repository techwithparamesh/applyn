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

type Order = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentStatus: string;
  createdAt: string;
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

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey(appId)));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentProvider, setPaymentProvider] = useState<"cod" | "razorpay">("cod");

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

  async function loadProducts() {
    const data = await runtimeFetch<Product[]>(`/api/runtime/${appId}/products`);
    setProducts(data);
  }

  async function loadOrders() {
    if (!token) return;
    const data = await runtimeFetch<Order[]>(`/api/runtime/${appId}/orders`, { token });
    setOrders(data);
  }

  useEffect(() => {
    loadProducts().catch((e) => toast({ title: "Load failed", description: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  useEffect(() => {
    loadOrders().catch(() => void 0);
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
  }

  async function login() {
    const data = await runtimeFetch<{ token: string }>(`/api/runtime/${appId}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    toast({ title: "Logged in" });
    await loadOrders().catch(() => void 0);
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
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Runtime App Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!token ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Register</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                    <Button onClick={() => register().catch((e) => toast({ title: "Register failed", description: e.message }))}
                      disabled={!email || !password}
                    >
                      Register
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Login</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button onClick={() => login().catch((e) => toast({ title: "Login failed", description: e.message }))}
                      disabled={!email || !password}
                    >
                      Login
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Logged in</div>
                  <Button variant="outline" onClick={logout}>
                    Logout
                  </Button>
                </div>
                <Separator />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Catalog</CardTitle>
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
                      {!products.length && (
                        <div className="text-sm text-muted-foreground">No products available</div>
                      )}
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
                        <div className="font-medium">
                          Total: {(cartTotal / 100).toFixed(2)} {products[0]?.currency ?? "INR"}
                        </div>
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
                          <Button
                            onClick={() => placeOrder().catch((e) => toast({ title: "Order failed", description: e.message }))}
                            disabled={!cartItems.length}
                          >
                            {paymentProvider === "cod" ? "Place COD Order" : "Pay with Razorpay"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

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
                              <TableCell>
                                {(o.totalCents / 100).toFixed(2)} {o.currency}
                              </TableCell>
                              <TableCell>{o.status}</TableCell>
                              <TableCell>
                                {o.paymentProvider ?? "-"} / {o.paymentStatus}
                              </TableCell>
                            </TableRow>
                          ))}
                          {!orders.length && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-muted-foreground">
                                No orders yet
                              </TableCell>
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
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
